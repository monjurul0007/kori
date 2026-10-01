from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from kori.config import Settings
from kori.db.session import make_engine, make_sessionmaker


def register_db(app: FastAPI, settings: Settings) -> None:
    """Create the engine and session factory, and dispose the engine on shutdown."""
    engine = make_engine(settings.database_url)
    app.state.engine = engine
    app.state.session_factory = make_sessionmaker(engine)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        # Read from app.state so a test-swapped engine is the one disposed.
        app.state.engine.dispose()

    app.router.lifespan_context = lifespan
