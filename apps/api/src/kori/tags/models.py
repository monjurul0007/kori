import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from kori.db.base import Base
from kori.db.mixins import CreatedAt, UserOwned, UuidPk


class Tag(UuidPk, UserOwned, CreatedAt, Base):
    __tablename__ = "tags"
    __table_args__ = (
        CheckConstraint("name = lower(name)", name="name_lowercase"),
        CheckConstraint("char_length(name) BETWEEN 1 AND 30", name="name_length"),
        UniqueConstraint("user_id", "name", name="uq_tags_user_id_name"),
    )

    name: Mapped[str] = mapped_column(Text, nullable=False)


class TransactionTag(Base):
    __tablename__ = "transaction_tags"
    __table_args__ = (Index("ix_transaction_tags_tag_id", "tag_id"),)

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
