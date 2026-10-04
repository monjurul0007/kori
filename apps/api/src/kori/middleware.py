"""Middleware registration. Add new middleware here; the last one added runs first."""

from fastapi import FastAPI

from kori.auth.csrf import CsrfMiddleware
from kori.common.request_id import RequestIdMiddleware


def register_middleware(app: FastAPI) -> None:
    app.add_middleware(CsrfMiddleware)
    app.add_middleware(RequestIdMiddleware)
