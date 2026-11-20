from sqlalchemy import select
from sqlalchemy.orm import Session

from kori.categories.models import Category
from kori.common.enums import CategoryKind
from kori.payment_methods.models import PaymentMethod
from kori.users.models import User


def category(db: Session, user: User, name: str, kind: CategoryKind = CategoryKind.EXPENSE) -> str:
    row = db.scalar(
        select(Category).where(
            Category.user_id == user.id, Category.name == name, Category.kind == kind
        )
    )
    assert row is not None
    return str(row.id)


def payment_method(db: Session, user: User, name: str = "Cash") -> str:
    row = db.scalar(
        select(PaymentMethod).where(PaymentMethod.user_id == user.id, PaymentMethod.name == name)
    )
    assert row is not None
    return str(row.id)
