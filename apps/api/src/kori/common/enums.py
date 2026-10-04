from enum import StrEnum

from sqlalchemy import Enum as SAEnum


def pg_enum[E: StrEnum](enum_cls: type[E], name: str) -> SAEnum:
    """A native Postgres ENUM that stores the member values (not the names)."""
    return SAEnum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


class CategoryKind(StrEnum):
    EXPENSE = "expense"
    INCOME = "income"


class PaymentMethodKind(StrEnum):
    CASH = "cash"
    MOBILE_WALLET = "mobile_wallet"
    CARD = "card"
    BANK = "bank"
    OTHER = "other"


class TransactionType(StrEnum):
    EXPENSE = "expense"
    INCOME = "income"


class TransactionSource(StrEnum):
    MANUAL = "manual"
    AI = "ai"
    RECURRING = "recurring"
    IMPORT = "import"
    SEED = "seed"


class CategorySource(StrEnum):
    USER = "user"
    DEFAULT = "default"
    AI = "ai"
    RULE = "rule"
    SEED = "seed"
