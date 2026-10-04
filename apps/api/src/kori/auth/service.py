"""Session authentication: login checks, session lifecycle and throttling."""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from kori.auth import passwords
from kori.auth.models import LoginAttempt, Session
from kori.users.models import User
from kori.users.service import get_user_by_email, normalize_email

SESSION_LIFETIME = timedelta(days=30)
EXTEND_AFTER = timedelta(hours=24)
THROTTLE_WINDOW = timedelta(minutes=15)
THROTTLE_MAX_FAILURES = 5


@dataclass(frozen=True)
class ResolvedSession:
    session: Session
    user: User
    extended: bool  # expiry was pushed out, so the cookie should be re-issued


def _hash_token(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def authenticate(db: DbSession, email: str, password: str) -> User | None:
    """Return the user for valid credentials, else None. Rehashes on outdated parameters."""
    user = get_user_by_email(db, email)
    if user is None:
        passwords.verify_password(passwords.DUMMY_HASH, password)
        return None
    if not passwords.verify_password(user.password_hash, password):
        return None
    if passwords.needs_rehash(user.password_hash):
        user.password_hash = passwords.hash_password(password)
    return user


def create_session(db: DbSession, user: User, user_agent: str | None) -> str:
    """Store a new session and return the raw token for the cookie (only its hash is kept)."""
    token = secrets.token_urlsafe(32)
    db.add(
        Session(
            user_id=user.id,
            token_hash=_hash_token(token),
            expires_at=datetime.now(UTC) + SESSION_LIFETIME,
            user_agent=user_agent[:512] if user_agent else None,
        )
    )
    db.flush()
    return token


def resolve_session(db: DbSession, token: str) -> ResolvedSession | None:
    """Look up a live session by token, record activity and slide the expiry."""
    now = datetime.now(UTC)
    session = db.scalar(
        select(Session).where(
            Session.token_hash == _hash_token(token),
            Session.revoked_at.is_(None),
            Session.expires_at > now,
        )
    )
    if session is None:
        return None
    user = db.get(User, session.user_id)
    if user is None:
        return None
    extended = now - (session.expires_at - SESSION_LIFETIME) > EXTEND_AFTER
    if extended:
        session.expires_at = now + SESSION_LIFETIME
    session.last_seen_at = now
    db.flush()
    return ResolvedSession(session, user, extended)


def revoke_session(db: DbSession, token: str) -> bool:
    session = db.scalar(
        select(Session).where(
            Session.token_hash == _hash_token(token), Session.revoked_at.is_(None)
        )
    )
    if session is None:
        return False
    session.revoked_at = datetime.now(UTC)
    db.flush()
    return True


def record_attempt(db: DbSession, email: str, *, succeeded: bool) -> None:
    db.add(LoginAttempt(email=normalize_email(email), succeeded=succeeded))
    db.flush()


def is_throttled(db: DbSession, email: str) -> int | None:
    """Seconds until another attempt is allowed, or None when not throttled.

    Throttled when the email has `THROTTLE_MAX_FAILURES` failed attempts within the window.
    """
    now = datetime.now(UTC)
    recent = db.scalars(
        select(LoginAttempt.attempted_at)
        .where(
            LoginAttempt.email == normalize_email(email),
            LoginAttempt.succeeded.is_(False),
            LoginAttempt.attempted_at > now - THROTTLE_WINDOW,
        )
        .order_by(LoginAttempt.attempted_at.desc())
        .limit(THROTTLE_MAX_FAILURES)
    ).all()
    if len(recent) < THROTTLE_MAX_FAILURES:
        return None
    unlock_at = recent[-1] + THROTTLE_WINDOW
    return max(1, int((unlock_at - now).total_seconds()) + 1)
