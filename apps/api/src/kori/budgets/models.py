import uuid
from datetime import date

from sqlalchemy import BigInteger, CheckConstraint, Date, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from kori.db.base import Base
from kori.db.mixins import Timestamps, UserOwned, UuidPk


class Budget(UuidPk, UserOwned, Timestamps, Base):
    """A standing monthly budget that applies from `effective_from` until a later row replaces it.

    One row per (category, month it was set). The budget in effect for a month is the latest row
    on or before it, and a NULL amount means "no budget from here on" (ADR-0007).
    """

    __tablename__ = "budgets"
    __table_args__ = (
        CheckConstraint(
            "extract(day FROM effective_from) = 1", name="effective_from_first_of_month"
        ),
        CheckConstraint("amount_minor IS NULL OR amount_minor > 0", name="amount_positive"),
        # NULLS NOT DISTINCT gives the overall limit (NULL category) one row per month as well.
        UniqueConstraint(
            "user_id",
            "category_id",
            "effective_from",
            name="uq_budgets_user_category_effective_from",
            postgresql_nulls_not_distinct=True,
        ),
        Index("ix_budgets_user_id_effective_from", "user_id", "effective_from"),
    )

    # NULL is the overall limit across all expense categories.
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT")
    )
    # Always the 1st of a month: a calendar month in the user's time zone (ADR-0004).
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    # Integer poisha. NULL clears the budget from this month on, so history is kept.
    amount_minor: Mapped[int | None] = mapped_column(BigInteger)
