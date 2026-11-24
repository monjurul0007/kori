from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.config import Env, Settings
from kori.db.session import get_db
from kori.jobs.models import JobRun
from kori.main import create_app
from kori.recurring import materializer
from kori.transactions import service as tx_service
from kori.transactions.models import Transaction
from kori.users.models import User

from .test_materializer import due_rule

TOKEN = "t" * 40
URL = "/internal/jobs/tick"
TODAY = date(2026, 11, 20)


def make_client(db: Session, token: str | None) -> Iterator[TestClient]:
    settings = Settings(env=Env.TEST, job_token=SecretStr(token) if token else None)
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db
    # No Origin header: the internal route must not depend on the CSRF Origin check.
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
def tick_client(db: Session) -> Iterator[TestClient]:
    yield from make_client(db, TOKEN)


@pytest.fixture
def no_token_client(db: Session) -> Iterator[TestClient]:
    yield from make_client(db, None)


@pytest.fixture(autouse=True)
def _clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(tx_service, "_today", lambda user: TODAY)
    monkeypatch.setattr(materializer, "today_for", lambda user: TODAY)


def test_right_token_runs_the_tick_and_returns_the_summary(
    tick_client: TestClient, db: Session, user: User
) -> None:
    due_rule(db, user)
    r = tick_client.post(URL, headers={"X-Kori-Job-Token": TOKEN})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["created"] == 1 and body["rules_scanned"] == 1 and body["failed"] == 0
    assert body["previous_run_at"] is None
    assert db.scalar(select(func.count()).select_from(Transaction)) == 1
    assert db.scalar(select(func.count()).select_from(JobRun)) == 1

    again = tick_client.post(URL, headers={"X-Kori-Job-Token": TOKEN}).json()
    assert again["created"] == 0
    assert again["previous_run_at"] == body["finished_at"]
    assert db.scalar(select(func.count()).select_from(Transaction)) == 1


@pytest.mark.parametrize("headers", [{}, {"X-Kori-Job-Token": "wrong"}, {"X-Kori-Job-Token": ""}])
def test_missing_or_wrong_token_is_401_problem_json(
    tick_client: TestClient, db: Session, user: User, headers: dict[str, str]
) -> None:
    due_rule(db, user)
    r = tick_client.post(URL, headers=headers)
    assert r.status_code == 401
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["request_id"]
    assert TOKEN not in r.text
    assert db.scalar(select(func.count()).select_from(Transaction)) == 0


def test_unset_token_means_the_route_does_not_exist(no_token_client: TestClient) -> None:
    r = no_token_client.post(URL, headers={"X-Kori-Job-Token": TOKEN})
    assert r.status_code == 404
    assert no_token_client.post(URL).status_code == 404


def test_route_is_not_in_openapi(tick_client: TestClient) -> None:
    assert "/internal" not in str(tick_client.get("/openapi.json").json()["paths"])


def test_api_routes_still_enforce_csrf_without_an_origin(tick_client: TestClient) -> None:
    assert tick_client.post("/api/v1/auth/logout").status_code == 403


def test_short_token_is_rejected_by_settings() -> None:
    with pytest.raises(ValidationError, match="at least 32"):
        Settings(env=Env.TEST, job_token=SecretStr("short"))
    assert Settings(env=Env.TEST, job_token="").job_token is None  # type: ignore[arg-type]


def test_opening_the_app_catches_up(signed_in: TestClient, db: Session, user: User) -> None:
    rule = due_rule(db, user)
    assert signed_in.get("/api/v1/auth/me").status_code == 200
    created = list(db.scalars(select(Transaction).where(Transaction.recurring_rule_id == rule.id)))
    assert len(created) == 1
    assert signed_in.get("/api/v1/auth/me").status_code == 200  # nothing more when opened again
    assert db.scalar(select(func.count()).select_from(Transaction)) == 1


def test_catch_up_failure_never_breaks_me(
    signed_in: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(*a: object, **k: object) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr("kori.auth.router.materialize_due", boom)
    assert signed_in.get("/api/v1/auth/me").status_code == 200
