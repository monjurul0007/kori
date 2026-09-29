from fastapi import FastAPI

from kori.common.errors import register_error_handlers
from kori.common.request_id import RequestIdMiddleware
from kori.config import Settings, get_settings
from kori.health.router import router as health_router
from kori.logging import configure_logging


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    app = FastAPI(title="Kori API", version="0.1.0")
    app.state.settings = settings
    app.add_middleware(RequestIdMiddleware)
    register_error_handlers(app)
    app.include_router(health_router, prefix="/api/v1")
    return app


def app_factory() -> FastAPI:
    """Entry point for `uvicorn kori.main:app_factory --factory`."""
    return create_app()
