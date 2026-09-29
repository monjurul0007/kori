"""Route registration. To add a feature, import its router and append it to `ROUTERS`."""

from fastapi import APIRouter, FastAPI

from kori.health.router import router as health_router

API_PREFIX = "/api/v1"

ROUTERS: list[APIRouter] = [
    health_router,
]


def register_routes(app: FastAPI) -> None:
    for router in ROUTERS:
        app.include_router(router, prefix=API_PREFIX)
