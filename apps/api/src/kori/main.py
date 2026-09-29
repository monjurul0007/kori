from fastapi import FastAPI

from kori.common.errors import register_error_handlers
from kori.config import Settings, get_settings
from kori.db import make_engine, make_sessionmaker
from kori.logging import configure_logging
from kori.middleware import register_middleware
from kori.routes import register_routes


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the app. Each concern is registered by its own function."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(title="Kori API", version="0.1.0")
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    app.state.session_factory = make_sessionmaker(app.state.engine)
    register_middleware(app)
    register_error_handlers(app)
    register_routes(app)
    return app


def app_factory() -> FastAPI:
    """Entry point for `uvicorn kori.main:app_factory --factory`."""
    return create_app()
