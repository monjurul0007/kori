from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from kori.common.enums import CategoryKind, pg_enum
from kori.db.base import Base
from kori.db.mixins import Timestamps, UserOwned, UuidPk


class Category(UuidPk, UserOwned, Timestamps, Base):
    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 1 AND 50", name="name_length"),
        # Active names are unique per user and kind, ignoring case; archived ones free the name.
        Index(
            "uq_categories_user_id_kind_name",
            "user_id",
            "kind",
            func.lower(text("name")),
            unique=True,
            postgresql_where=text("archived_at IS NULL"),
        ),
    )

    name: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[CategoryKind] = mapped_column(pg_enum(CategoryKind, "category_kind"))
    icon: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
