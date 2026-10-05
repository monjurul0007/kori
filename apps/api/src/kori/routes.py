"""Route registration. To add a feature, import its router and append it to `ROUTERS`."""

from fastapi import APIRouter, FastAPI

from kori.auth.router import router as auth_router
from kori.categories.router import router as categories_router
from kori.health.router import router as health_router
from kori.payment_methods.router import router as payment_methods_router
from kori.tags.router import router as tags_router
from kori.transactions.router import router as transactions_router

API_PREFIX = "/api/v1"

ROUTERS: list[APIRouter] = [
    health_router,
    auth_router,
    categories_router,
    payment_methods_router,
    tags_router,
    transactions_router,
]


def register_routes(app: FastAPI) -> None:
    for router in ROUTERS:
        app.include_router(router, prefix=API_PREFIX)
