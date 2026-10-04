"""RFC 9457 `application/problem+json` error responses."""

from collections.abc import Mapping
from http import HTTPStatus
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from kori.logging import request_id_var

PROBLEM_JSON = "application/problem+json"

log = structlog.get_logger()


def problem_response(
    request: Request,
    status: int,
    detail: str | None = None,
    *,
    title: str | None = None,
    extra: dict[str, Any] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": "about:blank",
        "title": title or HTTPStatus(status).phrase,
        "status": status,
        "detail": detail or HTTPStatus(status).phrase,
        "instance": request.url.path,
        "request_id": request_id_var.get(),
    }
    if extra:
        body.update(extra)
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON, headers=headers)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else None
    return problem_response(request, exc.status_code, detail, headers=exc.headers)


class NotFoundError(Exception):
    """The resource does not exist, or belongs to someone else (never reveal which)."""


class ConflictError(Exception):
    """The request conflicts with existing data, such as a duplicate name."""


async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return problem_response(request, 404, str(exc) or "Not found")


async def conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
    return problem_response(request, 409, str(exc) or "Conflict")


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
    return problem_response(
        request,
        422,
        "Request validation failed",
        title="Unprocessable Content",
        extra={"errors": errors},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.error("unhandled_exception", path=request.url.path, exc_info=exc)
    return problem_response(request, 500, "An unexpected error occurred")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(NotFoundError, not_found_handler)  # type: ignore[arg-type]
    app.add_exception_handler(ConflictError, conflict_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_exception_handler)
