"""CSRF defence for unsafe methods under `/api/`: JSON bodies only, and a matching Origin."""

import re
from urllib.parse import urlsplit

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from kori.common.errors import problem_response
from kori.config import Env, Settings

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_LOCALHOST = re.compile(r"http://localhost(:\d+)?")


def _origin_of(request: Request) -> str | None:
    """The Origin header, or the scheme and host of Referer as a fallback."""
    origin = request.headers.get("origin")
    if origin:
        return origin
    referer = request.headers.get("referer")
    if referer:
        parts = urlsplit(referer)
        if parts.scheme and parts.netloc:
            return f"{parts.scheme}://{parts.netloc}"
    return None


def _origin_allowed(origin: str, settings: Settings) -> bool:
    if settings.app_origin and origin == settings.app_origin.rstrip("/"):
        return True
    return settings.env is not Env.PRODUCTION and _LOCALHOST.fullmatch(origin) is not None


def _has_body(request: Request) -> bool:
    length = request.headers.get("content-length")
    return "transfer-encoding" in request.headers or (length is not None and length != "0")


class CsrfMiddleware(BaseHTTPMiddleware):
    """Spec, for POST/PUT/PATCH/DELETE under `/api/`:
    - 403 unless Origin (or Referer) matches `KORI_APP_ORIGIN`; outside production,
      `http://localhost:*` is also allowed.
    - 415 unless the content type is `application/json`, when the request has a body
      (bodiless requests such as logout have no content type to check).
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in UNSAFE_METHODS and request.url.path.startswith("/api/"):
            settings: Settings = request.app.state.settings
            origin = _origin_of(request)
            if origin is None or not _origin_allowed(origin, settings):
                return problem_response(request, 403, "Cross-site request rejected")
            content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
            if _has_body(request) and content_type != "application/json":
                return problem_response(request, 415, "Content-Type must be application/json")
        return await call_next(request)
