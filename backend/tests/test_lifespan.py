from unittest.mock import AsyncMock, patch

from app.main import lifespan


async def test_shutdown_disposes_the_database_engine(app):
    engine = AsyncMock()

    with patch("app.main.get_engine", return_value=engine):
        async with lifespan(app):
            engine.dispose.assert_not_awaited()

    engine.dispose.assert_awaited_once()
