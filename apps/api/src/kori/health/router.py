from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from kori.common.errors import problem_response
from kori.db import get_db

router = APIRouter(tags=["health"])
log = structlog.get_logger()


@router.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz", response_model=None)
def readyz(
    request: Request, db: Annotated[Session, Depends(get_db)]
) -> dict[str, str] | JSONResponse:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        log.error("readyz_db_unavailable", exc_info=True)
        return problem_response(request, 503, "Database is unavailable")
    return {"status": "ok"}
