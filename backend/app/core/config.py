"""Application settings, read from the environment (see docs/configuration.md)."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    env: Literal["development", "test", "production"] = "production"
    app_name: str = "App"
    database_url: str = "postgresql+asyncpg://app:app@db:5432/app"


@lru_cache
def get_settings() -> Settings:
    return Settings()
