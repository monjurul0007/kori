import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from kori.common.enums import RecurrenceFrequency, TransactionType, pg_enum
from kori.db.base import Base
from kori.db.mixins import Timestamps, UserOwned, UuidPk


class RecurringRule(UuidPk, UserOwned, Timestamps, Base):
    """A template for a transaction that repeats: rent on the 1st, a weekly bazar, a yearly premium.

    The rule only says when and what. M2-09 turns due rules into transactions, using `next_due_on`
    as its cursor and `UNIQUE (transactions.recurring_rule_id, occurred_on)` as the idempotency
    backstop.
    """

    __tablename__ = "recurring_rules"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 1 AND 60", name="name_length"),
        CheckConstraint("amount_minor > 0", name="amount_positive"),
        CheckConstraint('"interval" BETWEEN 1 AND 12', name="interval_range"),
        CheckConstraint("end_on IS NULL OR end_on >= start_on", name="end_on_after_start_on"),
        Index("ix_recurring_rules_user_id", "user_id"),
        # What the materializer scans: rules that are running and still have something to create.
        Index(
            "ix_recurring_rules_next_due_on",
            "next_due_on",
            postgresql_where=text("paused_at IS NULL AND next_due_on IS NOT NULL"),
        ),
    )

    name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[TransactionType] = mapped_column(pg_enum(TransactionType, "transaction_type"))
    # Integer poisha (ADR-0004).
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="BDT")
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    payment_method_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payment_methods.id", ondelete="RESTRICT")
    )
    # Copied to every transaction the rule creates.
    merchant: Mapped[str | None] = mapped_column(String(120))
    note: Mapped[str | None] = mapped_column(String(500))

    frequency: Mapped[RecurrenceFrequency] = mapped_column(
        pg_enum(RecurrenceFrequency, "recurrence_frequency")
    )
    # Every `interval` weeks, months or years.
    interval: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="1")
    # The anchor: fixes the weekday (weekly), the day of the month (monthly) or the day and month
    # (yearly). Local calendar dates in the user's time zone (ADR-0004).
    start_on: Mapped[date] = mapped_column(Date, nullable=False)
    end_on: Mapped[date | None] = mapped_column(Date)
    # The next occurrence not yet created; NULL once the rule has ended.
    next_due_on: Mapped[date | None] = mapped_column(Date)
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Set by the materializer (M2-09) when it can't create an occurrence.
    last_error: Mapped[str | None] = mapped_column(Text)
