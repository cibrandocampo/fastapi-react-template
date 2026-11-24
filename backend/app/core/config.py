"""Application settings, read from the environment (see docs/configuration.md)."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    env: Literal["development", "test", "production"] = "production"
    app_name: str = "App"
    database_url: str = "postgresql+asyncpg://app:app@db:5432/app"

    # Sessions
    # Signs access tokens. Production refuses this default (T010).
    secret_key: str = "change-me"  # noqa: S105 - placeholder, not a credential
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    # A refresh token presented again within this window after its rotation (parallel requests
    # from two tabs) is refused without revoking the session; later reuse revokes the family.
    refresh_reuse_grace_seconds: int = 10
    cookie_secure: bool = True  # false only for deployments served over plain HTTP
    bcrypt_rounds: int = 12

    # First administrator, created at start-up when no admin exists
    admin_email: str | None = None
    admin_password: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
