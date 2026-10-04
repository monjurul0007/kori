from typing import Annotated

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from kori.auth import service
from kori.auth.cookies import get_token, set_session_cookie
from kori.config import Settings
from kori.db.session import get_db
from kori.users.models import User


def current_user(
    request: Request, response: Response, db: Annotated[Session, Depends(get_db)]
) -> User:
    """The signed-in user; 401 for a missing, unknown, expired or revoked session cookie."""
    token = get_token(request)
    resolved = service.resolve_session(db, token) if token else None
    if token is None or resolved is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if resolved.extended:
        settings: Settings = request.app.state.settings
        set_session_cookie(response, settings, token)
    return resolved.user


CurrentUser = Annotated[User, Depends(current_user)]
