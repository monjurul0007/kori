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
    """Give every request an ID.

    Spec:
    - Reads `X-Request-ID`; accepted only if it matches `[A-Za-z0-9_-]{1,128}`,
      otherwise a uuid4 is generated.
    - Stores the ID in `request_id_var` and binds it to structlog, so log lines
      and problem+json errors carry it.
    - Echoes it in the `X-Request-ID` response header, including on 500s
      (unhandled errors are rendered here, so the header is not lost).
    """

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
