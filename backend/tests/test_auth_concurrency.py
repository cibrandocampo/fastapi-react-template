import asyncio
import logging
import time
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, update

from app.auth import sessions
from app.auth.models import FailedLogin, RefreshToken
from app.core import security
from app.core.db import get_sessionmaker
from app.core.errors import AppError
from app.users.models import User

WRONG = {"email": "ana@example.com", "password": "wrong password!"}


def _slow_wrong_password(calls: list):
    def verify(password, password_hash):
        calls.append(password)
        time.sleep(0.2)  # like bcrypt at 12 rounds: blocks whichever thread runs it
        return False

    return verify


async def test_password_check_does_not_block_other_requests(client, make_user, monkeypatch):
    await make_user("ana@example.com")
    monkeypatch.setattr(security, "verify_password", _slow_wrong_password([]))
    finished = []

    async def login():
        await client.post("/api/auth/login/verify", json=WRONG)
        finished.append("login")

    async def health():
        await asyncio.sleep(0.05)  # starts while the password is being checked
        await client.get("/api/health")
        finished.append("health")

    await asyncio.gather(login(), health())

    assert finished == ["health", "login"]


async def test_concurrent_wrong_passwords_cannot_exceed_the_lockout(
    client, db, make_user, monkeypatch
):
    user = await make_user("ana@example.com")
    calls = []
    monkeypatch.setattr(security, "verify_password", _slow_wrong_password(calls))

    responses = await asyncio.gather(
        *(client.post("/api/auth/login/verify", json=WRONG) for _ in range(12))
    )

    codes = sorted(r.json()["error"]["code"] for r in responses)
    assert codes == ["invalid_credentials"] * 5 + ["locked"] * 7
    assert len(calls) == 5
    failures = await db.scalar(
        select(func.count()).select_from(FailedLogin).where(FailedLogin.user_id == user.id)
    )
    assert failures == 5


async def test_reuse_log_names_only_the_user_id_and_family(db, make_user, caplog):
    user = await make_user("ana@example.com")
    first = await sessions.issue(db, user)
    await sessions.rotate(db, first.refresh_token)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.revoked_at.is_not(None))
        .values(revoked_at=datetime.now(UTC) - timedelta(minutes=1))
    )
    await db.commit()

    with (
        caplog.at_level(logging.WARNING, logger="app.auth.sessions"),
        pytest.raises(AppError),
    ):
        await sessions.rotate(db, first.refresh_token)

    [record] = caplog.records
    assert f"of user {user.id} revoked" in record.getMessage()
    assert "ana@example.com" not in record.getMessage()
    assert first.refresh_token not in record.getMessage()


async def test_account_disabled_while_waiting_for_the_lock_is_refused(client, db, make_user):
    user = await make_user("ana@example.com")
    async with get_sessionmaker()() as holder:
        await holder.execute(select(User).where(User.id == user.id).with_for_update(key_share=True))
        login = asyncio.create_task(
            client.post(
                "/api/auth/login/verify",
                json={"email": "ana@example.com", "password": "correct horse battery"},
            )
        )
        await asyncio.sleep(0.1)  # the login is now waiting for the row lock
        await holder.execute(update(User).where(User.id == user.id).values(is_active=False))
        await holder.commit()

    response = await login

    assert response.json()["error"]["code"] == "account_disabled"


async def test_password_check_lock_does_not_block_the_users_token_refresh(db, make_user):
    user = await make_user("ana@example.com")
    session = await sessions.issue(db, user)
    async with get_sessionmaker()() as holder:
        await holder.execute(select(User).where(User.id == user.id).with_for_update(key_share=True))
        async with get_sessionmaker()() as other:
            rotated = await asyncio.wait_for(sessions.rotate(other, session.refresh_token), 2)
        await holder.rollback()

    assert rotated.user.id == user.id
