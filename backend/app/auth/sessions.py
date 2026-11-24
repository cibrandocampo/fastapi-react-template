"""Login sessions: a short-lived access token plus a rotating refresh token in a cookie."""

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import RefreshToken
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import create_access_token, hash_token, new_refresh_token
from app.users.models import User

log = logging.getLogger(__name__)

REFRESH_COOKIE = "refresh_token"
# Error code for a refresh refused because another request just rotated the token: the session
# is still valid, the client retries with the new cookie and must not be logged out.
REFRESH_IN_PROGRESS = "refresh_in_progress"
REFRESH_COOKIE_PATH = "/api/auth"


@dataclass
class Session:
    user: User
    access_token: str
    refresh_token: str


def _now() -> datetime:
    return datetime.now(UTC)


async def _store(db: AsyncSession, user: User, family_id: uuid.UUID) -> tuple[RefreshToken, str]:
    raw = new_refresh_token()
    token = RefreshToken(
        user_id=user.id,
        family_id=family_id,
        token_hash=hash_token(raw),
        expires_at=_now() + timedelta(days=get_settings().refresh_token_days),
    )
    db.add(token)
    await db.flush()
    return token, raw


async def issue(db: AsyncSession, user: User) -> Session:
    """Start a new session (new token family) for a user who just logged in."""
    _, raw = await _store(db, user, uuid.uuid4())
    await db.commit()
    return Session(user, create_access_token(user.id, user.role.value), raw)


async def rotate(db: AsyncSession, raw: str | None) -> Session:
    """Exchange a refresh token for a new pair; reusing a rotated token revokes its family.

    The token is claimed with one atomic UPDATE, so concurrent requests with the same token
    cannot both succeed.
    """
    invalid = AppError(401, "unauthorized", "Session expired, please log in again")
    if not raw:
        raise invalid
    token_hash = hash_token(raw)
    claimed = await db.scalar(
        update(RefreshToken)
        .where(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
        .returning(RefreshToken)
        .execution_options(populate_existing=True)
    )
    if claimed is None:
        if await _on_reuse(db, token_hash):
            raise AppError(401, REFRESH_IN_PROGRESS, "Session is being refreshed, retry")
        raise invalid
    user = await db.get(User, claimed.user_id)
    if claimed.expires_at <= _now() or user is None or not user.is_active:
        await db.commit()
        raise invalid
    new_token, new_raw = await _store(db, user, claimed.family_id)
    claimed.replaced_by_id = new_token.id
    await db.commit()
    return Session(user, create_access_token(user.id, user.role.value), new_raw)


async def _on_reuse(db: AsyncSession, token_hash: str) -> bool:
    """A revoked or unknown token was presented. Return True when it was rotated moments ago
    (parallel requests: the session continues); otherwise revoke its family and return False."""
    token = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if token is None:
        return False
    grace = timedelta(seconds=get_settings().refresh_reuse_grace_seconds)
    if token.replaced_by_id is not None and token.revoked_at > _now() - grace:
        return True
    await _revoke_family(db, token.family_id)
    await db.commit()
    log.warning("Refresh token reuse: family %s of user %s revoked", token.family_id, token.user_id)
    return False


async def revoke(db: AsyncSession, raw: str | None) -> None:
    """Log out the session of this token: its whole family, so an already rotated token (an
    old cookie) also ends the session it led to. Unknown tokens are ignored."""
    if not raw:
        return
    token = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)))
    if token is None:
        return
    await _revoke_family(db, token.family_id)
    await db.commit()


async def revoke_all(db: AsyncSession, user_id: int) -> None:
    """Log a user out everywhere (password change, deactivation, role change)."""
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    await db.commit()


async def _revoke_family(db: AsyncSession, family_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


def set_refresh_cookie(response: Response, raw: str) -> None:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        raw,
        max_age=settings.refresh_token_days * 86400,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
    )


def clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
    )
