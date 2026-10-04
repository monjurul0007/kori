from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.categories.models import Category
from kori.common.enums import CategoryKind
from kori.payment_methods.models import PaymentMethod
from kori.users.defaults import seed_defaults
from kori.users.models import User


def _counts(db: Session, user: User) -> tuple[int, int, int]:
    def count(model, *where):  # type: ignore[no-untyped-def]
        return db.scalar(
            select(func.count()).select_from(model).where(model.user_id == user.id, *where)
        )

    return (
        count(Category, Category.kind == CategoryKind.EXPENSE),
        count(Category, Category.kind == CategoryKind.INCOME),
        count(PaymentMethod),
    )


def test_create_user_seeds_defaults(db: Session, user: User) -> None:
    assert _counts(db, user) == (12, 4, 4)


def test_seed_defaults_is_idempotent(db: Session, user: User) -> None:
    seed_defaults(db, user)
    seed_defaults(db, user)
    assert _counts(db, user) == (12, 4, 4)


def test_seed_defaults_fills_gaps_but_not_archived_ones(db: Session, user: User) -> None:
    rent = db.scalars(
        select(Category).where(Category.user_id == user.id, Category.name == "Rent")
    ).one()
    shopping = db.scalars(
        select(Category).where(Category.user_id == user.id, Category.name == "Shopping")
    ).one()
    db.delete(shopping)
    rent.archived_at = func.now()
    db.flush()
    seed_defaults(db, user)
    assert _counts(db, user) == (12, 4, 4)  # Shopping is back, the archived Rent is not duplicated


def test_default_names_include_bangladesh_flavour(db: Session, user: User) -> None:
    names = set(db.scalars(select(PaymentMethod.name).where(PaymentMethod.user_id == user.id)))
    assert names == {"Cash", "bKash", "Nagad", "Card"}
