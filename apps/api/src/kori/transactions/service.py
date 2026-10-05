import uuid
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from kori.categories.models import Category
from kori.common.enums import CategorySource, TransactionSource
from kori.common.errors import NotFoundError, UnprocessableError, field_error
from kori.common.money import parse_taka
from kori.payment_methods.models import PaymentMethod
from kori.tags.models import Tag, TransactionTag
from kori.transactions.models import Transaction, TransactionLine
from kori.transactions.schemas import TransactionIn
from kori.users.models import User

MIN_DATE = date(2000, 1, 1)
_CHECK_VIOLATION = "23514"
_LINES_TRIGGERS = "transaction_lines_sum_check, transactions_lines_sum_check"


def _today(user: User) -> date:
    return datetime.now(ZoneInfo(user.timezone)).date()


def _validate(db: Session, user: User, data: TransactionIn) -> None:
    """Checks that need the database or the user's time zone; all problems are reported at once."""
    errors: list[dict[str, Any]] = []

    latest = _today(user)
    if not MIN_DATE <= data.occurred_on <= latest:
        errors.append(
            field_error(
                ["body", "occurred_on"],
                f"Date must be between {MIN_DATE} and {latest} (today)",
                "value_error",
            )
        )

    lines = data.resolved_lines()
    ids = {line.category_id for line in lines}
    categories = {
        c.id: c
        for c in db.scalars(
            select(Category).where(Category.user_id == user.id, Category.id.in_(ids))
        )
    }
    for i, line in enumerate(lines):
        loc: list[str | int] = (
            ["body", "lines", i, "category_id"]
            if data.lines is not None
            else ["body", "category_id"]
        )
        category = categories.get(line.category_id)
        if category is None:
            errors.append(field_error(loc, "Category not found", "not_found"))
        elif category.archived_at is not None:
            errors.append(field_error(loc, "Category is archived", "archived"))
        elif category.kind.value != data.type.value:
            errors.append(
                field_error(loc, f"A {data.type.value} needs a {data.type.value} category", "kind")
            )

    if data.payment_method_id is not None:
        method = db.scalar(
            select(PaymentMethod).where(
                PaymentMethod.id == data.payment_method_id, PaymentMethod.user_id == user.id
            )
        )
        loc = ["body", "payment_method_id"]
        if method is None:
            errors.append(field_error(loc, "Payment method not found", "not_found"))
        elif method.archived_at is not None:
            errors.append(field_error(loc, "Payment method is archived", "archived"))

    if errors:
        raise UnprocessableError(errors)


def _upsert_tags(db: Session, user: User, names: list[str]) -> list[Tag]:
    """Tags are unique per user by normalised name; existing ones are reused."""
    if not names:
        return []
    db.execute(
        pg_insert(Tag)
        .values([{"user_id": user.id, "name": n} for n in names])
        .on_conflict_do_nothing(index_elements=["user_id", "name"])
    )
    return list(db.scalars(select(Tag).where(Tag.user_id == user.id, Tag.name.in_(names))))


def _write_children(db: Session, user: User, tx: Transaction, data: TransactionIn) -> None:
    db.execute(delete(TransactionLine).where(TransactionLine.transaction_id == tx.id))
    db.execute(delete(TransactionTag).where(TransactionTag.transaction_id == tx.id))
    db.add_all(
        TransactionLine(
            transaction_id=tx.id,
            category_id=line.category_id,
            amount_minor=parse_taka(line.amount),
            position=i,
            category_source=CategorySource.USER,
        )
        for i, line in enumerate(data.resolved_lines())
    )
    db.add_all(
        TransactionTag(transaction_id=tx.id, tag_id=tag.id)
        for tag in _upsert_tags(db, user, data.tags)
    )
    db.flush()


def _save(db: Session, user: User, tx: Transaction | None, data: TransactionIn) -> Transaction:
    """Write the transaction, its lines and tags in one savepoint; a failure changes nothing."""
    if tx is None:
        tx = Transaction(user_id=user.id, source=TransactionSource.MANUAL)
    try:
        with db.begin_nested():
            db.add(tx)
            tx.type = data.type
            tx.amount_minor = parse_taka(data.amount)
            tx.occurred_on = data.occurred_on
            tx.merchant = data.merchant
            tx.note = data.note
            tx.payment_method_id = data.payment_method_id
            tx.updated_at = func.now()  # also when nothing else changed
            db.flush()
            _write_children(db, user, tx, data)
            # The lines-sum trigger is deferred to commit. Run it now so that a violation is a
            # 422 here and rolls back this savepoint, instead of failing the whole request later.
            db.execute(text(f"SET CONSTRAINTS {_LINES_TRIGGERS} IMMEDIATE"))
            db.execute(text(f"SET CONSTRAINTS {_LINES_TRIGGERS} DEFERRED"))
    except IntegrityError as exc:
        if getattr(exc.orig, "sqlstate", None) != _CHECK_VIOLATION:
            raise
        raise UnprocessableError(
            [field_error(["body"], "Amounts do not add up", "check_violation")]
        ) from exc
    db.refresh(tx)
    return tx


def create_transaction(db: Session, user: User, data: TransactionIn) -> Transaction:
    _validate(db, user, data)
    return _save(db, user, None, data)


def get_transaction(db: Session, user: User, id: uuid.UUID) -> Transaction:
    tx = db.scalar(select(Transaction).where(Transaction.id == id, Transaction.user_id == user.id))
    if tx is None:
        raise NotFoundError("Transaction not found")
    return tx


def update_transaction(
    db: Session,
    user: User,
    id: uuid.UUID,
    data: TransactionIn,
) -> Transaction:
    tx = get_transaction(db, user, id)
    _validate(db, user, data)
    return _save(db, user, tx, data)


def delete_transaction(db: Session, user: User, id: uuid.UUID) -> None:
    tx = get_transaction(db, user, id)
    db.delete(tx)  # lines and tag links go with it (ON DELETE CASCADE)
    db.flush()
