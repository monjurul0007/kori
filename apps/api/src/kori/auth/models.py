from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Identity, Index, Text, func, text
from sqlalchemy.dialects.postgresql import BYTEA
from sqlalchemy.orm import Mapped, mapped_column

from kori.db.base import Base
from kori.db.mixins import CreatedAt, UserOwned, UuidPk


class Session(UuidPk, UserOwned, CreatedAt, Base):
    __tablename__ = "sessions"
    __table_args__ = (Index("ix_sessions_user_id", "user_id"),)

    # SHA-256 of the cookie token; the raw token is never stored.
    token_hash: Mapped[bytes] = mapped_column(BYTEA, unique=True, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(Text)


class LoginAttempt(Base):
    """Throttling log. Not user-owned: failed attempts may name an unknown email."""

    __tablename__ = "login_attempts"
    __table_args__ = (
        Index("ix_login_attempts_email_attempted_at", "email", text("attempted_at DESC")),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    succeeded: Mapped[bool] = mapped_column(Boolean, nullable=False)
