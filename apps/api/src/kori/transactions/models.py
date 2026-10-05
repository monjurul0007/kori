import uuid
from datetime import date

from sqlalchemy import (
    REAL,
    BigInteger,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from kori.categories.models import Category
from kori.common.enums import (
    CategorySource,
    TransactionSource,
    TransactionType,
    pg_enum,
)
from kori.db.base import Base
from kori.db.mixins import Timestamps, UserOwned, UuidPk
from kori.payment_methods.models import PaymentMethod
from kori.tags.models import Tag, TransactionTag


class Transaction(UuidPk, UserOwned, Timestamps, Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount_minor > 0", name="amount_positive"),
        # Keyset pagination: newest first, with created_at and id as tie-breakers.
        Index(
            "ix_transactions_user_id_occurred_on_created_at_id",
            "user_id",
            text("occurred_on DESC"),
            text("created_at DESC"),
            text("id DESC"),
        ),
        Index(
            "ix_transactions_merchant_trgm",
            "merchant",
            postgresql_using="gin",
            postgresql_ops={"merchant": "gin_trgm_ops"},
        ),
        Index(
            "ix_transactions_note_trgm",
            "note",
            postgresql_using="gin",
            postgresql_ops={"note": "gin_trgm_ops"},
        ),
    )

    type: Mapped[TransactionType] = mapped_column(pg_enum(TransactionType, "transaction_type"))
    # A local calendar date in the user's time zone, not a UTC instant (ADR-0004).
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False)
    # Integer poisha (1 taka = 100 poisha). Never a float (ADR-0004).
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="BDT")
    merchant: Mapped[str | None] = mapped_column(String(120))
    note: Mapped[str | None] = mapped_column(String(500))
    payment_method_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payment_methods.id", ondelete="RESTRICT")
    )
    source: Mapped[TransactionSource] = mapped_column(
        pg_enum(TransactionSource, "transaction_source"),
        nullable=False,
        server_default=TransactionSource.MANUAL.value,
    )

    # Read-only views: the service writes lines and tag links explicitly.
    payment_method: Mapped[PaymentMethod | None] = relationship(lazy="joined", viewonly=True)
    lines: Mapped[list["TransactionLine"]] = relationship(
        lazy="selectin",
        viewonly=True,
        order_by="TransactionLine.position",
        primaryjoin="Transaction.id == TransactionLine.transaction_id",
    )
    tags: Mapped[list[Tag]] = relationship(
        secondary=TransactionTag.__table__, lazy="selectin", viewonly=True, order_by=Tag.name
    )


class TransactionLine(UuidPk, Base):
    """One category slice of a transaction. A split is simply more than one line."""

    __tablename__ = "transaction_lines"
    __table_args__ = (
        CheckConstraint("amount_minor > 0", name="amount_positive"),
        CheckConstraint("category_confidence BETWEEN 0 AND 1", name="category_confidence_range"),
        UniqueConstraint("transaction_id", "position", name="uq_transaction_lines_position"),
        Index("ix_transaction_lines_category_id", "category_id"),
    )

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    category_source: Mapped[CategorySource] = mapped_column(
        pg_enum(CategorySource, "category_source"),
        nullable=False,
        server_default=CategorySource.USER.value,
    )
    category_confidence: Mapped[float | None] = mapped_column(REAL)

    category: Mapped[Category] = relationship(lazy="joined", viewonly=True)
