# ruff: noqa: S105, S106  (fake passwords in tests)
import hashlib
import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from kori.auth import passwords, service
from kori.auth.models import LoginAttempt
from kori.auth.models import Session as SessionRow
from kori.config import Env
from kori.users.models import User

PASSWORD = "correct horse battery"  # same value as the `user` fixture
LOGIN = "/api/v1/auth/login"


def login(client: TestClient, email: str = "owner@example.com", password: str = PASSWORD):
    return client.post(LOGIN, json={"email": email, "password": password})


def test_login_sets_cookie_with_secure_flags(client: TestClient, user: User) -> None:
    r = login(client)
    assert r.status_code == 204
    cookie = r.headers["set-cookie"]
    assert cookie.startswith("kori_session=")
    for flag in ("HttpOnly", "Path=/", "SameSite=lax", "Max-Age=2592000"):
        assert flag in cookie
    assert "Secure" not in cookie  # only when KORI_ENV=production


def test_cookie_is_secure_in_production(client: TestClient, user: User) -> None:
    client.app.state.settings = client.app.state.settings.model_copy(
        update={"env": Env.PRODUCTION, "app_origin": "https://kori.example.com"}
    )
    r = client.post(
        LOGIN,
        json={"email": "owner@example.com", "password": PASSWORD},
        headers={"Origin": "https://kori.example.com"},
    )
    assert r.status_code == 204
    assert "Secure" in r.headers["set-cookie"]


def test_login_stores_only_the_token_hash(client: TestClient, user: User, db: Session) -> None:
    token = login(client).cookies["kori_session"]
    row = db.scalars(select(SessionRow)).one()
    assert row.token_hash == hashlib.sha256(token.encode()).digest()
    assert token.encode() not in row.token_hash


def test_email_is_matched_case_insensitively(client: TestClient, user: User) -> None:
    assert login(client, email="  OWNER@example.com ").status_code == 204


def test_wrong_password_and_unknown_email_look_identical(client: TestClient, user: User) -> None:
    wrong = login(client, password="nope")
    unknown = login(client, email="nobody@example.com")
    assert wrong.status_code == unknown.status_code == 401
    strip = lambda r: {k: v for k, v in r.json().items() if k != "request_id"}  # noqa: E731
    assert strip(wrong) == strip(unknown)
    assert "set-cookie" not in wrong.headers


def test_unknown_email_still_verifies_against_dummy_hash(
    client: TestClient, user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []
    real = passwords.verify_password

    def spy(password_hash: str, password: str) -> bool:
        calls.append(password_hash)
        return real(password_hash, password)

    monkeypatch.setattr(passwords, "verify_password", spy)
    login(client, email="nobody@example.com")
    assert calls == [passwords.DUMMY_HASH]


def test_every_attempt_is_recorded(client: TestClient, user: User, db: Session) -> None:
    login(client, password="nope")
    login(client)
    login(client, email="Nobody@example.com")
    outcomes = db.execute(
        select(LoginAttempt.email, LoginAttempt.succeeded).order_by(LoginAttempt.id)
    ).all()
    assert outcomes == [
        ("owner@example.com", False),
        ("owner@example.com", True),
        ("nobody@example.com", False),
    ]


def test_sixth_failure_in_window_is_throttled(client: TestClient, user: User) -> None:
    for _ in range(5):
        assert login(client, password="nope").status_code == 401
    r = login(client, password="nope")
    assert r.status_code == 429
    assert r.headers["content-type"].startswith("application/problem+json")
    assert 1 <= int(r.headers["Retry-After"]) <= 15 * 60
    # Even the right password is refused while throttled.
    assert login(client).status_code == 429


def test_old_failures_do_not_throttle(client: TestClient, user: User, db: Session) -> None:
    old = datetime.now(UTC) - timedelta(minutes=16)
    db.add_all(
        LoginAttempt(email="owner@example.com", succeeded=False, attempted_at=old) for _ in range(5)
    )
    db.flush()
    assert login(client).status_code == 204


def test_me_requires_a_session(client: TestClient) -> None:
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["request_id"]


def test_me_returns_the_user(client: TestClient, user: User) -> None:
    login(client)
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json() == {
        "id": str(user.id),
        "email": "owner@example.com",
        "display_name": "Owner",
        "timezone": "Asia/Dhaka",
        "currency": "BDT",
    }
    assert "password" not in r.text


def test_unknown_cookie_is_rejected(client: TestClient) -> None:
    client.cookies.set("kori_session", "not-a-real-token")
    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_revokes_the_session(client: TestClient, user: User, db: Session) -> None:
    token = login(client).cookies["kori_session"]
    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 204
    assert 'kori_session=""' in r.headers["set-cookie"]
    assert db.scalars(select(SessionRow)).one().revoked_at is not None
    client.cookies.set("kori_session", token)  # replay the old cookie
    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_without_a_session_is_a_no_op(client: TestClient) -> None:
    assert client.post("/api/v1/auth/logout").status_code == 204


def test_expired_session_is_rejected(client: TestClient, user: User, db: Session) -> None:
    login(client)
    db.execute(update(SessionRow).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
    assert client.get("/api/v1/auth/me").status_code == 401


def test_recent_activity_updates_last_seen_but_keeps_expiry(
    client: TestClient, user: User, db: Session
) -> None:
    login(client)
    row = db.scalars(select(SessionRow)).one()
    expires = row.expires_at
    db.execute(update(SessionRow).values(last_seen_at=datetime.now(UTC) - timedelta(hours=1)))
    r = client.get("/api/v1/auth/me")
    db.refresh(row)
    assert row.expires_at == expires
    assert row.last_seen_at > datetime.now(UTC) - timedelta(minutes=1)
    assert "set-cookie" not in r.headers


def test_expiry_slides_after_24_hours_and_cookie_is_reissued(
    client: TestClient, user: User, db: Session
) -> None:
    login(client)
    soon = datetime.now(UTC) + timedelta(days=5)
    db.execute(update(SessionRow).values(expires_at=soon))
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert "kori_session=" in r.headers["set-cookie"]
    row = db.scalars(select(SessionRow)).one()
    db.refresh(row)
    assert row.expires_at > datetime.now(UTC) + timedelta(days=29)


def test_password_is_rehashed_on_login_when_parameters_change(
    client: TestClient, user: User, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    old_hash = user.password_hash
    monkeypatch.setattr(passwords, "needs_rehash", lambda _: True)
    assert login(client).status_code == 204
    db.refresh(user)
    assert user.password_hash != old_hash
    assert passwords.verify_password(user.password_hash, PASSWORD)


def test_service_create_user_rejects_duplicates(db: Session, user: User) -> None:
    from kori.users.service import create_user

    with pytest.raises(ValueError, match="already exists"):
        create_user(db, email="OWNER@example.com", display_name="Dup", password="x")


def test_resolve_session_ignores_revoked(db: Session, user: User) -> None:
    token = service.create_session(db, user, "pytest")
    assert service.resolve_session(db, token) is not None
    service.revoke_session(db, token)
    assert service.resolve_session(db, token) is None


# CSRF


def test_foreign_origin_is_rejected(client: TestClient, user: User) -> None:
    r = client.post(
        LOGIN,
        json={"email": "owner@example.com", "password": PASSWORD},
        headers={"Origin": "https://evil.example"},
    )
    assert r.status_code == 403
    assert r.headers["content-type"].startswith("application/problem+json")


def test_missing_origin_is_rejected(client: TestClient, user: User) -> None:
    c = TestClient(client.app)
    r = c.post(LOGIN, json={"email": "owner@example.com", "password": PASSWORD})
    assert r.status_code == 403


def test_referer_is_the_fallback_for_origin(client: TestClient, user: User) -> None:
    c = TestClient(client.app)
    body = {"email": "owner@example.com", "password": PASSWORD}
    ok = c.post(LOGIN, json=body, headers={"Referer": "http://localhost:5173/login"})
    bad = c.post(LOGIN, json=body, headers={"Referer": "https://evil.example/login"})
    assert (ok.status_code, bad.status_code) == (204, 403)


def test_form_content_type_is_rejected(client: TestClient, user: User) -> None:
    r = client.post(LOGIN, data={"email": "owner@example.com", "password": PASSWORD})
    assert r.status_code == 415


def test_configured_origin_is_allowed_and_localhost_is_not_in_production(
    client: TestClient, user: User
) -> None:
    client.app.state.settings = client.app.state.settings.model_copy(
        update={"env": Env.PRODUCTION, "app_origin": "https://kori.example.com"}
    )
    body = {"email": "owner@example.com", "password": PASSWORD}
    ok = client.post(LOGIN, json=body, headers={"Origin": "https://kori.example.com"})
    local = client.post(LOGIN, json=body, headers={"Origin": "http://localhost:5173"})
    assert (ok.status_code, local.status_code) == (204, 403)


def test_safe_methods_skip_the_origin_check(client: TestClient) -> None:
    r = TestClient(client.app).get("/api/v1/healthz")
    assert r.status_code == 200


# Logging


def test_login_logs_contain_neither_password_nor_token(
    client: TestClient, user: User, capsys: pytest.CaptureFixture[str]
) -> None:
    from kori.logging import configure_logging

    configure_logging("DEBUG")
    token = login(client).cookies["kori_session"]
    client.get("/api/v1/auth/me")
    out = capsys.readouterr().out
    assert PASSWORD not in out
    assert token not in out


def test_redaction_processor_scrubs_nested_secret_keys() -> None:
    from kori.logging import redact_secrets

    event = {
        "event": "x",
        "password": "hunter2",
        "headers": {"Cookie": "kori_session=abc", "accept": "*/*"},
        "items": [{"token": "t0k"}],
    }
    out = json.dumps(redact_secrets(None, "info", event))
    for secret in ("hunter2", "kori_session=abc", "t0k"):
        assert secret not in out
    assert "*/*" in out
