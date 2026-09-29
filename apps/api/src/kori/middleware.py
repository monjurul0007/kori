"""Middleware registration. Add new middleware here; the last one added runs first."""

from fastapi import FastAPI

from kori.common.request_id import RequestIdMiddleware


def register_middleware(app: FastAPI) -> None:
    app.add_middleware(RequestIdMiddleware)
