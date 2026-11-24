import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

from sqlalchemy import func, select

from app.auth import otp, sessions
from app.auth.models import FailedLogin, LoginCode, RefreshToken
from app.core import scheduler
from app.users.models import AuthMethod, Role, User

LONG_AGO = datetime.now(UTC) - timedelta(days=30)


async def _count(db, model, *where) -> int:
    return await db.scalar(select(func.count()).select_from(model).where(*where))


async def test_cleanup_removes_only_stale_rows(db, make_user):
    user = await make_user()
    await otp.issue_code(db, user)
    expired = LoginCode(user_id=user.id, code_hash="x" * 64, expires_at=LONG_AGO)
    db.add_all(
        [
            expired,
            FailedLogin(user_id=user.id, created_at=LONG_AGO),
            FailedLogin(user_id=user.id),
        ]
    )
    fresh = await sessions.issue(db, user)
    old = await sessions.issue(db, user)
    await db.commit()
    token = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash != "").order_by(RefreshToken.id.desc())
    )
    token.expires_at = LONG_AGO
    await db.commit()

    await scheduler.cleanup(db)

    assert await _count(db, LoginCode) == 1
    assert await _count(db, FailedLogin) == 1
    assert await _count(db, RefreshToken) == 1
    assert fresh and old


async def test_cleanup_deletes_old_unconfirmed_sign_ups_only(db, make_user):
    stale = await make_user(
        "stale@example.com",
        role=Role.none,
        auth_method=AuthMethod.otp,
        password=None,
        created_at=LONG_AGO,
    )
    await make_user("recent@example.com", role=Role.none, auth_method=AuthMethod.otp, password=None)
    await make_user(
        "verified@example.com",
        auth_method=AuthMethod.otp,
        password=None,
        created_at=LONG_AGO,
        email_verified_at=LONG_AGO,
    )
    await make_user("admin-made@example.com", created_at=LONG_AGO)  # password user
    await make_user(
        "disabled@example.com",
        role=Role.none,
        auth_method=AuthMethod.otp,
        password=None,
        created_at=LONG_AGO,
        is_active=False,
    )
    stale_id = stale.id

    await scheduler.cleanup(db)

    db.expire_all()
    emails = set(await db.scalars(select(User.email)))
    assert emails == {
        "recent@example.com",
        "verified@example.com",
        "admin-made@example.com",
        "disabled@example.com",  # an admin disabled it: kept so the address stays blocked
    }
    assert await db.get(User, stale_id) is None


async def test_cleanup_forgets_idle_rate_limit_keys(db, monkeypatch):
    from app.core import ratelimit
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "rate_limit_enabled", True)
    clock = [1000.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: clock[0])
    ratelimit.REFRESH_IP.hit("idle")
    clock[0] += 30
    ratelimit.REFRESH_IP.hit("busy")
    clock[0] += 40  # "idle" is now outside the 60 s window, "busy" is not

    await scheduler.cleanup(db)

    assert set(ratelimit.REFRESH_IP._hits) == {"busy"}


async def test_loop_runs_the_cleanup_until_stopped(monkeypatch):
    calls = AsyncMock()
    monkeypatch.setattr(scheduler, "cleanup", calls)

    task = scheduler.start(interval=0.01)
    await asyncio.sleep(0.05)
    await scheduler.stop(task)

    assert calls.await_count >= 2
    assert task.cancelled()


async def test_a_failing_cleanup_does_not_stop_the_loop(monkeypatch, caplog):
    calls = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(scheduler, "cleanup", calls)

    task = scheduler.start(interval=0.01)
    await asyncio.sleep(0.05)
    await scheduler.stop(task)

    assert calls.await_count >= 2
    assert "Periodic clean-up failed" in caplog.text
