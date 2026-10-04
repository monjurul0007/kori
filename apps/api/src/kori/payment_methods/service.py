import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.common.errors import ConflictError, NotFoundError
from kori.payment_methods.models import PaymentMethod
from kori.payment_methods.schemas import PaymentMethodCreate, PaymentMethodUpdate
from kori.users.models import User


def list_payment_methods(
    db: Session, user: User, *, include_archived: bool = False
) -> list[PaymentMethod]:
    stmt = select(PaymentMethod).where(PaymentMethod.user_id == user.id)
    if not include_archived:
        stmt = stmt.where(PaymentMethod.archived_at.is_(None))
    return list(db.scalars(stmt.order_by(PaymentMethod.sort_order, func.lower(PaymentMethod.name))))


def get_payment_method(db: Session, user: User, payment_method_id: uuid.UUID) -> PaymentMethod:
    """Archived payment methods resolve too, so old transactions still display."""
    row = db.scalar(
        select(PaymentMethod).where(
            PaymentMethod.id == payment_method_id, PaymentMethod.user_id == user.id
        )
    )
    if row is None:
        raise NotFoundError("Payment method not found")
    return row


def _ensure_name_free(
    db: Session, user: User, name: str, *, exclude: uuid.UUID | None = None
) -> None:
    stmt = select(PaymentMethod.id).where(
        PaymentMethod.user_id == user.id,
        func.lower(PaymentMethod.name) == name.lower(),
        PaymentMethod.archived_at.is_(None),
    )
    if exclude is not None:
        stmt = stmt.where(PaymentMethod.id != exclude)
    if db.scalar(stmt) is not None:
        raise ConflictError(f"A payment method named '{name}' already exists")


def create_payment_method(db: Session, user: User, data: PaymentMethodCreate) -> PaymentMethod:
    _ensure_name_free(db, user, data.name)
    row = PaymentMethod(user_id=user.id, **data.model_dump())
    db.add(row)
    db.flush()
    return row


def update_payment_method(
    db: Session, user: User, payment_method_id: uuid.UUID, data: PaymentMethodUpdate
) -> PaymentMethod:
    row = get_payment_method(db, user, payment_method_id)
    changes = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if "name" in changes and row.archived_at is None:
        _ensure_name_free(db, user, changes["name"], exclude=row.id)
    for field, value in changes.items():
        setattr(row, field, value)
    db.flush()
    return row


def archive_payment_method(db: Session, user: User, payment_method_id: uuid.UUID) -> PaymentMethod:
    row = get_payment_method(db, user, payment_method_id)
    if row.archived_at is None:
        row.archived_at = datetime.now(UTC)
        db.flush()
    return row


def unarchive_payment_method(
    db: Session, user: User, payment_method_id: uuid.UUID
) -> PaymentMethod:
    row = get_payment_method(db, user, payment_method_id)
    if row.archived_at is not None:
        _ensure_name_free(db, user, row.name, exclude=row.id)
        row.archived_at = None
        db.flush()
    return row
