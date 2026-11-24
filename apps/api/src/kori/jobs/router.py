"""The scheduled tick (ADR-0006): one endpoint, one secret, one log line per run.

Outside `/api/v1`, so the CSRF Origin check (which guards `/api/`) doesn't apply; the shared secret
is the authentication. Hidden from OpenAPI.
"""

import hmac
from datetime import datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from kori.config import Settings
from kori.db.session import get_db
from kori.jobs.models import JobRun
from kori.recurring.materializer import materialize_all

log = structlog.get_logger()

router = APIRouter(prefix="/internal/jobs", include_in_schema=False)

TICK_JOB = "tick"


class TickOut(BaseModel):
    started_at: datetime
    finished_at: datetime
    duration_ms: int
    users: int
    rules_scanned: int
    created: int
    skipped: int
    failed: int
    previous_run_at: datetime | None


def require_job_token(
    request: Request, x_kori_job_token: Annotated[str | None, Header()] = None
) -> None:
    settings: Settings = request.app.state.settings
    if settings.job_token is None:
        raise HTTPException(status_code=404, detail="Not Found")
    expected = settings.job_token.get_secret_value().encode()
    given = (x_kori_job_token or "").encode()
    if not hmac.compare_digest(given, expected):  # constant time; never logged
        raise HTTPException(status_code=401, detail="Invalid job token")


@router.post("/tick", dependencies=[Depends(require_job_token)])
def tick(db: Annotated[Session, Depends(get_db)]) -> TickOut:
    previous = db.scalar(
        select(JobRun.finished_at).where(JobRun.job == TICK_JOB).order_by(JobRun.finished_at.desc())
    )
    summary = materialize_all(db)
    db.add(
        JobRun(
            job=TICK_JOB,
            started_at=summary.started_at,
            finished_at=summary.finished_at,
            rules_scanned=summary.scanned,
            created=summary.created,
            skipped=summary.skipped,
            failed=summary.failed,
            duration_ms=summary.duration_ms,
        )
    )
    return TickOut(
        started_at=summary.started_at,
        finished_at=summary.finished_at,
        duration_ms=summary.duration_ms,
        users=summary.users,
        rules_scanned=summary.scanned,
        created=summary.created,
        skipped=summary.skipped,
        failed=summary.failed,
        previous_run_at=previous,
    )
