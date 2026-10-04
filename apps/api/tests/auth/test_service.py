# ruff: noqa: S105, S106  (fake passwords in tests)
"""Unit tests for every function in `kori.auth.service`, run directly against the database."""

import hashlib
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from kori.auth import passwords, service
from kori.auth.models import LoginAttempt
from kori.auth.models import Session as SessionRow
from kori.users.models import User

PASSWORD = "correct horse battery"


def _session_row(db: Session) -> SessionRow:
    return db.scalars(select(SessionRow)).one()


def _fail(db: Session, email: str, minutes_ago: float) -> None:
    db.add(
        LoginAttempt(
            email=email,
            succeeded=False,
            attempted_at=datetime.now(UTC) - timedelta(minutes=minutes_ago),
        )
    )
    db.flush()


# authenticate


def test_authenticate_returns_user_for_valid_credentials(db: Session, user: User) -> None:
    assert service.authenticate(db, "OWNER@example.com", PASSWORD) == user


def test_authenticate_rejects_wrong_password(db: Session, user: User) -> None:
    assert service.authenticate(db, "owner@example.com", "wrong") is None


def test_authenticate_unknown_email_returns_none_after_dummy_verify(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []
    monkeypatch.setattr(passwords, "verify_password", lambda h, p: calls.append(h) or False)
    assert service.authenticate(db, "nobody@example.com", PASSWORD) is None
    assert calls == [passwords.DUMMY_HASH]


def test_authenticate_rehashes_only_when_parameters_are_outdated(
    db: Session, user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    before = user.password_hash
    assert service.authenticate(db, user.email, PASSWORD) == user
    assert user.password_hash == before  # current parameters: left alone
    monkeypatch.setattr(passwords, "needs_rehash", lambda _: True)
    assert service.authenticate(db, user.email, PASSWORD) == user
    assert user.password_hash != before
    assert passwords.verify_password(user.password_hash, PASSWORD)


def test_authenticate_does_not_rehash_on_failure(
    db: Session, user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    before = user.password_hash
    monkeypatch.setattr(passwords, "needs_rehash", lambda _: True)
    assert service.authenticate(db, user.email, "wrong") is None
    assert user.password_hash == before


# create_session


def test_create_session_stores_hash_expiry_and_user_agent(db: Session, user: User) -> None:
    token = service.create_session(db, user, "pytest-agent")
    row = _session_row(db)
    assert row.user_id == user.id
    assert row.token_hash == hashlib.sha256(token.encode()).digest()
    assert row.user_agent == "pytest-agent"
    assert row.revoked_at is None
    expected = datetime.now(UTC) + service.SESSION_LIFETIME
    assert abs(row.expires_at - expected) < timedelta(seconds=5)


def test_create_session_tokens_are_unique_and_long(db: Session, user: User) -> None:
    a, b = service.create_session(db, user, None), service.create_session(db, user, None)
    assert a != b
    assert len(a) >= 43  # 32 random bytes, urlsafe base64


def test_create_session_truncates_a_huge_user_agent(db: Session, user: User) -> None:
    service.create_session(db, user, "x" * 5000)
    assert len(_session_row(db).user_agent or "") == 512


# resolve_session


def test_resolve_session_returns_user_and_updates_last_seen(db: Session, user: User) -> None:
    token = service.create_session(db, user, None)
    row = _session_row(db)
    row.last_seen_at = datetime.now(UTC) - timedelta(hours=1)
    resolved = service.resolve_session(db, token)
    assert resolved is not None
    assert resolved.user == user
    assert resolved.extended is False
    assert row.last_seen_at > datetime.now(UTC) - timedelta(minutes=1)


def test_resolve_session_unknown_token(db: Session, user: User) -> None:
    service.create_session(db, user, None)
    assert service.resolve_session(db, "not-a-real-token") is None


def test_resolve_session_expired(db: Session, user: User) -> None:
    token = service.create_session(db, user, None)
    _session_row(db).expires_at = datetime.now(UTC) - timedelta(seconds=1)
    assert service.resolve_session(db, token) is None


def test_resolve_session_revoked(db: Session, user: User) -> None:
    token = service.create_session(db, user, None)
    _session_row(db).revoked_at = datetime.now(UTC)
    assert service.resolve_session(db, token) is None


def test_resolve_session_does_not_extend_within_24_hours(db: Session, user: User) -> None:
    token = service.create_session(db, user, None)
    row = _session_row(db)
    row.expires_at = datetime.now(UTC) + service.SESSION_LIFETIME - timedelta(hours=23)
    before = row.expires_at
    resolved = service.resolve_session(db, token)
    assert resolved is not None
    assert resolved.extended is False
    assert row.expires_at == before


def test_resolve_session_extends_after_24_hours(db: Session, user: User) -> None:
    token = service.create_session(db, user, None)
    row = _session_row(db)
    row.expires_at = datetime.now(UTC) + service.SESSION_LIFETIME - timedelta(hours=25)
    resolved = service.resolve_session(db, token)
    assert resolved is not None
    assert resolved.extended is True
    expected = datetime.now(UTC) + service.SESSION_LIFETIME
    assert abs(row.expires_at - expected) < timedelta(seconds=5)


# revoke_session


def test_revoke_session_marks_it_revoked(db: Session, user: User) -> None:
    token = service.create_session(db, user, None)
    assert service.revoke_session(db, token) is True
    assert _session_row(db).revoked_at is not None


def test_revoke_session_unknown_token_is_false(db: Session, user: User) -> None:
    assert service.revoke_session(db, "not-a-real-token") is False


def test_revoke_session_twice_keeps_the_first_timestamp(db: Session, user: User) -> None:
    token = service.create_session(db, user, None)
    service.revoke_session(db, token)
    first = _session_row(db).revoked_at
    assert service.revoke_session(db, token) is False
    assert _session_row(db).revoked_at == first


# record_attempt


def test_record_attempt_normalizes_email_and_stores_outcome(db: Session) -> None:
    service.record_attempt(db, "  Someone@Example.COM ", succeeded=True)
    service.record_attempt(db, "someone@example.com", succeeded=False)
    rows = db.execute(
        select(LoginAttempt.email, LoginAttempt.succeeded).order_by(LoginAttempt.id)
    ).all()
    assert rows == [("someone@example.com", True), ("someone@example.com", False)]


# is_throttled


def test_is_throttled_none_below_the_limit(db: Session) -> None:
    for _ in range(service.THROTTLE_MAX_FAILURES - 1):
        _fail(db, "a@example.com", 1)
    assert service.is_throttled(db, "a@example.com") is None


def test_is_throttled_at_the_limit_returns_seconds_until_unlock(db: Session) -> None:
    for minutes_ago in (10, 8, 6, 4, 2):
        _fail(db, "a@example.com", minutes_ago)
    retry_after = service.is_throttled(db, "a@example.com")
    # The oldest failure (10 min ago) leaves the 15 min window in about 5 minutes.
    assert retry_after is not None
    assert 5 * 60 - 5 <= retry_after <= 5 * 60 + 5


def test_is_throttled_ignores_failures_outside_the_window(db: Session) -> None:
    for _ in range(service.THROTTLE_MAX_FAILURES):
        _fail(db, "a@example.com", 16)
    assert service.is_throttled(db, "a@example.com") is None


def test_is_throttled_ignores_successes_and_other_emails(db: Session) -> None:
    for _ in range(service.THROTTLE_MAX_FAILURES):
        service.record_attempt(db, "a@example.com", succeeded=True)
        _fail(db, "other@example.com", 1)
    assert service.is_throttled(db, "a@example.com") is None


def test_is_throttled_matches_email_case_insensitively(db: Session) -> None:
    for _ in range(service.THROTTLE_MAX_FAILURES):
        _fail(db, "a@example.com", 1)
    assert service.is_throttled(db, "A@Example.com") is not None


# users.service


def test_create_user_lowercases_email_and_hashes_password(db: Session) -> None:
    from kori.users.service import create_user, get_user_by_email

    created = create_user(db, email=" New@Example.COM ", display_name="N", password="pw-123456")
    assert created.email == "new@example.com"
    assert created.password_hash != "pw-123456"
    assert passwords.verify_password(created.password_hash, "pw-123456")
    assert get_user_by_email(db, "NEW@example.com") == created
    assert get_user_by_email(db, "missing@example.com") is None
