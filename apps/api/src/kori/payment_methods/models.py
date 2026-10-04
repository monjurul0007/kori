from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from kori.common.enums import PaymentMethodKind, pg_enum
from kori.db.base import Base
from kori.db.mixins import Timestamps, UserOwned, UuidPk


class PaymentMethod(UuidPk, UserOwned, Timestamps, Base):
    __tablename__ = "payment_methods"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 1 AND 40", name="name_length"),
        Index(
            "uq_payment_methods_user_id_name",
            "user_id",
            func.lower(text("name")),
            unique=True,
            postgresql_where=text("archived_at IS NULL"),
        ),
    )

    name: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[PaymentMethodKind] = mapped_column(
        pg_enum(PaymentMethodKind, "payment_method_kind")
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
