"""Periodic clean-ups run inside the app process (one instance assumed)."""

import asyncio
import contextlib
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import FailedLogin, LoginCode, RefreshToken
from app.core import ratelimit
from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.users.models import User

log = logging.getLogger(__name__)

INTERVAL_SECONDS = 3600


async def cleanup(db: AsyncSession) -> None:
    """Delete expired login codes, old failed logins, refresh tokens expired more than 7 days ago
    and sign-ups never confirmed with a code after `unverified_signup_days`; forget rate-limit
    keys with no recent hits."""
    now = datetime.now(UTC)
    settings = get_settings()
    await db.execute(delete(LoginCode).where(LoginCode.expires_at < now))
    await db.execute(delete(FailedLogin).where(FailedLogin.created_at < now - timedelta(days=1)))
    await db.execute(delete(RefreshToken).where(RefreshToken.expires_at < now - timedelta(days=7)))
    await db.execute(
        delete(User).where(
            User.email_verified_at.is_(None),
            User.last_login_at.is_(None),
            User.auth_method == "otp",
            User.is_active.is_(True),  # a pending sign-up an admin disabled stays blocked
            User.created_at < now - timedelta(days=settings.unverified_signup_days),
        )
    )
    await db.commit()
    for limit in ratelimit.ALL:
        limit.prune()


async def _loop(interval: float) -> None:
    while True:
        try:
            async with get_sessionmaker()() as db:
                await cleanup(db)
        except Exception:
            log.exception("Periodic clean-up failed")
        await asyncio.sleep(interval)


def start(interval: float = INTERVAL_SECONDS) -> asyncio.Task:
    return asyncio.create_task(_loop(interval), name="cleanup")


async def stop(task: asyncio.Task) -> None:
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
