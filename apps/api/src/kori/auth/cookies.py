from fastapi import Request, Response

from kori.auth.service import SESSION_LIFETIME
from kori.config import Env, Settings

COOKIE_NAME = "kori_session"


def set_session_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path="/",
        httponly=True,
        # TODO(https): `Secure` is only set in production, so plain-http dev and test still work.
        # When the app moves to HTTPS everywhere, set it unconditionally.
        secure=settings.env is Env.PRODUCTION,
        samesite="lax",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.env is Env.PRODUCTION,
        samesite="lax",
    )


def get_token(request: Request) -> str | None:
    return request.cookies.get(COOKIE_NAME)
