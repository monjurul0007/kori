"""Default payment methods, as (name, kind). Order becomes `sort_order`."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.common.enums import PaymentMethodKind
from kori.payment_methods.models import PaymentMethod
from kori.users.models import User

DEFAULT_PAYMENT_METHODS: list[tuple[str, PaymentMethodKind]] = [
    ("Cash", PaymentMethodKind.CASH),
    ("bKash", PaymentMethodKind.MOBILE_WALLET),
    ("Nagad", PaymentMethodKind.MOBILE_WALLET),
    ("Card", PaymentMethodKind.CARD),
]


def seed_payment_methods(db: Session, user: User) -> int:
    """Add the missing defaults; anything the user already has (even archived) is left alone."""
    existing: set[str] = set(
        db.scalars(select(func.lower(PaymentMethod.name)).where(PaymentMethod.user_id == user.id))
    )
    added = 0
    for order, (name, kind) in enumerate(DEFAULT_PAYMENT_METHODS):
        if name.lower() not in existing:
            db.add(PaymentMethod(user_id=user.id, name=name, kind=kind, sort_order=order))
            added += 1
    db.flush()
    return added
