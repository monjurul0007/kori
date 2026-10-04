import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from kori.auth import service
from kori.auth.cookies import clear_session_cookie, get_token, set_session_cookie
from kori.auth.deps import CurrentUser
from kori.config import Settings
from kori.db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=1024)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    timezone: str
    currency: str


@router.post("/login", status_code=204)
def login(
    body: LoginRequest, request: Request, db: Annotated[Session, Depends(get_db)]
) -> Response:
    retry_after = service.is_throttled(db, body.email)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    user = service.authenticate(db, body.email, body.password)
    service.record_attempt(db, body.email, succeeded=user is not None)
    if user is None:
        db.commit()  # keep the failed attempt: get_db rolls back when an exception propagates
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = service.create_session(db, user, request.headers.get("user-agent"))
    response = Response(status_code=204)
    settings: Settings = request.app.state.settings
    set_session_cookie(response, settings, token)
    return response


@router.post("/logout", status_code=204)
def logout(request: Request, db: Annotated[Session, Depends(get_db)]) -> Response:
    """Idempotent: revokes the session if there is one and always clears the cookie."""
    token = get_token(request)
    if token:
        service.revoke_session(db, token)
    response = Response(status_code=204)
    clear_session_cookie(response, request.app.state.settings)
    return response


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
