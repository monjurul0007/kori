import re
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from kori.common.errors import unhandled_exception_handler
from kori.logging import request_id_var

HEADER = "X-Request-ID"
_VALID = re.compile(r"[A-Za-z0-9_-]{1,128}")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Accept a valid inbound X-Request-ID or generate one; echo it and bind it to logs."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        inbound = request.headers.get(HEADER, "")
        request_id = inbound if _VALID.fullmatch(inbound) else str(uuid.uuid4())
        token = request_id_var.set(request_id)
        structlog.contextvars.bind_contextvars(request_id=request_id)
        try:
            try:
                response = await call_next(request)
            except Exception as exc:
                response = await unhandled_exception_handler(request, exc)
        finally:
            structlog.contextvars.clear_contextvars()
            request_id_var.reset(token)
        response.headers[HEADER] = request_id
        return response
