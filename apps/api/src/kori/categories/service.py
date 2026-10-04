import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.categories.models import Category
from kori.categories.schemas import CategoryCreate, CategoryUpdate
from kori.common.enums import CategoryKind
from kori.common.errors import ConflictError, NotFoundError
from kori.users.models import User


def list_categories(
    db: Session, user: User, *, kind: CategoryKind | None = None, include_archived: bool = False
) -> list[Category]:
    stmt = select(Category).where(Category.user_id == user.id)
    if kind is not None:
        stmt = stmt.where(Category.kind == kind)
    if not include_archived:
        stmt = stmt.where(Category.archived_at.is_(None))
    return list(db.scalars(stmt.order_by(Category.sort_order, func.lower(Category.name))))


def get_category(db: Session, user: User, category_id: uuid.UUID) -> Category:
    """Archived categories resolve too, so old transactions still display."""
    category = db.scalar(
        select(Category).where(Category.id == category_id, Category.user_id == user.id)
    )
    if category is None:
        raise NotFoundError("Category not found")
    return category


def _ensure_name_free(
    db: Session, user: User, kind: CategoryKind, name: str, *, exclude: uuid.UUID | None = None
) -> None:
    stmt = select(Category.id).where(
        Category.user_id == user.id,
        Category.kind == kind,
        func.lower(Category.name) == name.lower(),
        Category.archived_at.is_(None),
    )
    if exclude is not None:
        stmt = stmt.where(Category.id != exclude)
    if db.scalar(stmt) is not None:
        raise ConflictError(f"A {kind.value} category named '{name}' already exists")


def create_category(db: Session, user: User, data: CategoryCreate) -> Category:
    _ensure_name_free(db, user, data.kind, data.name)
    category = Category(user_id=user.id, **data.model_dump())
    db.add(category)
    db.flush()
    return category


def update_category(
    db: Session, user: User, category_id: uuid.UUID, data: CategoryUpdate
) -> Category:
    category = get_category(db, user, category_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("name") is None:
        changes.pop("name", None)
    if changes.get("sort_order") is None:
        changes.pop("sort_order", None)
    if "name" in changes and category.archived_at is None:
        _ensure_name_free(db, user, category.kind, changes["name"], exclude=category.id)
    for field, value in changes.items():
        setattr(category, field, value)
    db.flush()
    return category


def archive_category(db: Session, user: User, category_id: uuid.UUID) -> Category:
    category = get_category(db, user, category_id)
    if category.archived_at is None:
        category.archived_at = datetime.now(UTC)
        db.flush()
    return category


def unarchive_category(db: Session, user: User, category_id: uuid.UUID) -> Category:
    category = get_category(db, user, category_id)
    if category.archived_at is not None:
        _ensure_name_free(db, user, category.kind, category.name, exclude=category.id)
        category.archived_at = None
        db.flush()
    return category
