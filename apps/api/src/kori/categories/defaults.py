"""Default categories, as (name, lucide icon). Order becomes `sort_order`."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.categories.models import Category
from kori.common.enums import CategoryKind
from kori.users.models import User

DEFAULT_CATEGORIES: list[tuple[CategoryKind, str, str]] = [
    (CategoryKind.EXPENSE, "Food & Dining", "utensils"),
    (CategoryKind.EXPENSE, "Groceries & Bazar", "shopping-basket"),
    (CategoryKind.EXPENSE, "Transport", "bus"),
    (CategoryKind.EXPENSE, "Rent", "house"),
    (CategoryKind.EXPENSE, "Utilities", "zap"),
    (CategoryKind.EXPENSE, "Mobile & Internet", "smartphone"),
    (CategoryKind.EXPENSE, "Health & Medicine", "heart-pulse"),
    (CategoryKind.EXPENSE, "Shopping", "shopping-bag"),
    (CategoryKind.EXPENSE, "Family & Gifts", "gift"),
    (CategoryKind.EXPENSE, "Education", "graduation-cap"),
    (CategoryKind.EXPENSE, "Entertainment", "clapperboard"),
    (CategoryKind.EXPENSE, "Other", "ellipsis"),
    (CategoryKind.INCOME, "Salary", "banknote"),
    (CategoryKind.INCOME, "Freelance", "laptop"),
    (CategoryKind.INCOME, "Gifts Received", "hand-heart"),
    (CategoryKind.INCOME, "Other Income", "circle-dollar-sign"),
]


def seed_categories(db: Session, user: User) -> int:
    """Add the missing defaults; anything the user already has (even archived) is left alone."""
    existing = {
        (kind, name)
        for kind, name in db.execute(
            select(Category.kind, func.lower(Category.name)).where(Category.user_id == user.id)
        )
    }
    added = 0
    for order, (kind, name, icon) in enumerate(DEFAULT_CATEGORIES):
        if (kind, name.lower()) not in existing:
            db.add(Category(user_id=user.id, name=name, kind=kind, icon=icon, sort_order=order))
            added += 1
    db.flush()
    return added
