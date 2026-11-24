"""Application factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import health
from app.core.config import get_settings
from app.core.db import get_engine, get_sessionmaker
from app.core.errors import register_error_handlers
from app.users.bootstrap import ensure_admin


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    async with get_sessionmaker()() as db:
        await ensure_admin(db)
    yield
    # Close pooled database connections on shutdown.
    await get_engine().dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    register_error_handlers(app)
    app.include_router(health.router, prefix="/api")
    return app


app = create_app()
