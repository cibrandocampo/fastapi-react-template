"""/api/auth: login with a one-time code or a password, sessions, own profile."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import otp, sessions
from app.auth.deps import CurrentUser
from app.auth.disposable import is_disposable
from app.auth.models import FailedLogin
from app.auth.schemas import (
    AuthConfig,
    ChangePassword,
    LoginResult,
    LoginStart,
    LoginStartResult,
    LoginVerify,
    SessionOut,
)
from app.core import ratelimit
from app.core.config import get_settings
from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import hash_password_async, validate_password, verify_password_async
from app.emails.sender import LANGUAGES, send_email
from app.users.models import AuthMethod, Language, Role, User, normalise_email
from app.users.schemas import ProfileUpdate, UserOut

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

Db = Annotated[AsyncSession, Depends(get_session)]
RefreshCookie = Annotated[str | None, Cookie(alias=sessions.REFRESH_COOKIE)]

INVALID_CREDENTIALS = AppError(400, "invalid_credentials", "Wrong email, code or password")


def _now() -> datetime:
    return datetime.now(UTC)


def preferred_language(accept_language: str | None) -> Language:
    """First supported language of an Accept-Language header, by quality; English otherwise."""
    choices = []
    for index, part in enumerate((accept_language or "").split(",")):
        tag, _, params = part.strip().partition(";")
        quality = 1.0
        if params.strip().startswith("q="):
            try:
                quality = float(params.strip()[2:])
            except ValueError:
                quality = 0.0
        choices.append((-quality, index, tag.split("-")[0].lower()))
    for _, _, lang in sorted(choices):
        if lang in LANGUAGES:
            return Language(lang)
    return Language.en


async def _user_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(User.email == normalise_email(email)))


async def _send_code(db: AsyncSession, user: User, template: str) -> None:
    ratelimit.LOGIN_EMAIL.hit(user.email)
    code = await otp.issue_code(db, user)
    context = {"code": code, "minutes": get_settings().otp_minutes, "first_name": user.first_name}
    await send_email(user.email, template, user.language.value, context)


def _session_body(response: Response, session: sessions.Session, **extra) -> dict:
    sessions.set_refresh_cookie(response, session.refresh_token)
    return {"access_token": session.access_token, "user": session.user, **extra}


@router.get("/config")
async def config() -> AuthConfig:
    return AuthConfig(allow_self_signup=get_settings().allow_self_signup)


@router.post("/login/start")
async def login_start(body: LoginStart, request: Request, db: Db) -> LoginStartResult:
    ratelimit.LOGIN_START_IP.hit(ratelimit.client_ip(request))
    settings = get_settings()
    user = await _user_by_email(db, body.email)
    if user is None:
        if not settings.allow_self_signup:
            raise AppError(404, "user_not_found", "No account with this email")
        if is_disposable(body.email):
            raise AppError(400, "disposable_email", "Disposable email addresses are not accepted")
        user = User(
            email=body.email,
            auth_method=AuthMethod.otp,
            role=Role.none,
            is_active=True,
            language=preferred_language(request.headers.get("accept-language")),
        )
        db.add(user)
        await db.commit()
        await _send_code(db, user, "welcome_signup")
        return LoginStartResult(method="otp")
    if not user.is_active:
        raise AppError(403, "account_disabled", "This account is disabled")
    if user.auth_method is AuthMethod.password:
        return LoginStartResult(method="password")
    template = "login_code" if user.email_verified_at else "welcome_signup"
    await _send_code(db, user, template)
    return LoginStartResult(method="otp")


@router.post("/login/verify")
async def login_verify(
    body: LoginVerify, request: Request, response: Response, db: Db
) -> LoginResult:
    ip = ratelimit.client_ip(request)
    ratelimit.LOGIN_VERIFY_IP.hit(ip)
    if (body.code is None) == (body.password is None):
        raise AppError(400, "invalid_request", "Send either a code or a password")
    user = await _user_by_email(db, body.email)
    if user is None:
        raise INVALID_CREDENTIALS
    if not user.is_active:
        raise AppError(403, "account_disabled", "This account is disabled")
    if body.code is not None:
        if user.auth_method is not AuthMethod.otp:
            raise AppError(400, "method_mismatch", "This account signs in with a password")
        if not await otp.verify_code(db, user, body.code):
            raise INVALID_CREDENTIALS
    else:
        if user.auth_method is not AuthMethod.password:
            raise AppError(400, "method_mismatch", "This account signs in with a code")
        await _check_password(db, user, body.password or "", ip)
    user.last_login_at = _now()
    user.email_verified_at = user.email_verified_at or user.last_login_at
    await db.commit()
    session = await sessions.issue(db, user)
    is_new = not user.first_name and not user.last_name
    return LoginResult(**_session_body(response, session, is_new=is_new))


async def _check_password(db: AsyncSession, user: User, password: str, ip: str) -> None:
    """Check a password under the lockout. The user's row is locked for the whole check, so
    concurrent attempts on one account are handled one at a time and cannot exceed the limit.
    FOR NO KEY UPDATE does not block foreign-key checks (the user's own token refreshes)."""
    settings = get_settings()
    await db.execute(
        select(User)
        .where(User.id == user.id)
        .with_for_update(key_share=True)
        .execution_options(populate_existing=True)  # re-read: it may have changed while waiting
    )
    if not user.is_active:
        await db.rollback()
        raise AppError(403, "account_disabled", "This account is disabled")
    since = _now() - timedelta(minutes=settings.lockout_minutes)
    failures = await db.scalar(
        select(func.count())
        .select_from(FailedLogin)
        .where(FailedLogin.user_id == user.id, FailedLogin.created_at > since)
    )
    if failures >= settings.lockout_attempts:
        await db.rollback()
        raise AppError(429, "locked", "Too many failed attempts, try again later")
    if not await verify_password_async(password, user.password_hash):
        db.add(FailedLogin(user_id=user.id, ip=ip))
        await db.commit()
        raise INVALID_CREDENTIALS
    await db.execute(delete(FailedLogin).where(FailedLogin.user_id == user.id))


@router.post("/refresh")
async def refresh(
    request: Request, response: Response, db: Db, refresh_token: RefreshCookie = None
) -> SessionOut:
    ratelimit.REFRESH_IP.hit(ratelimit.client_ip(request))
    try:
        session = await sessions.rotate(db, refresh_token)
    except AppError as error:
        # The session ended: drop the cookie. A refresh refused because another tab just rotated
        # the token keeps it (that tab's response already replaced it).
        if error.code != sessions.REFRESH_IN_PROGRESS:
            cleared = Response()
            sessions.clear_refresh_cookie(cleared)
            error.headers["set-cookie"] = cleared.headers["set-cookie"]
        raise
    return SessionOut(**_session_body(response, session))


@router.post("/logout", status_code=204)
async def logout(db: Db, refresh_token: RefreshCookie = None) -> Response:
    await sessions.revoke(db, refresh_token)
    response = Response(status_code=204)
    sessions.clear_refresh_cookie(response)
    return response


@router.get("/me")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me")
async def update_me(body: ProfileUpdate, user: CurrentUser, db: Db) -> UserOut:
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is None:
            raise AppError(400, "invalid_request", f"{field} cannot be empty")
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/change-password")
async def change_password(
    body: ChangePassword, user: CurrentUser, response: Response, db: Db
) -> SessionOut:
    ratelimit.CHANGE_PASSWORD_USER.hit(str(user.id))
    if user.password_hash is not None and not await verify_password_async(
        body.current_password or "", user.password_hash
    ):
        raise AppError(400, "invalid_credentials", "Current password is wrong")
    validate_password(body.new_password, user.email)
    user.password_hash = await hash_password_async(body.new_password)
    user.auth_method = AuthMethod.password
    await db.commit()
    # Every other session ends; this one continues with a new token.
    await sessions.revoke_all(db, user.id)
    session = await sessions.issue(db, user)
    return SessionOut(**_session_body(response, session))
