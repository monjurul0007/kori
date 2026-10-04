import uuid
from datetime import date

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from kori.common.enums import TransactionType
from kori.common.errors import NotFoundError, UnprocessableError
from kori.transactions import service
from kori.transactions.models import Transaction, TransactionLine
from kori.transactions.schemas import LineIn, TransactionIn
from kori.users.models import User


def make(food: str, **overrides: object) -> TransactionIn:
    data = {"type": "expense", "amount": "10", "occurred_on": date(2026, 9, 1), "category_id": food}
    return TransactionIn.model_validate(data | overrides)


def test_service_round_trip(db: Session, user: User, food: str) -> None:
    tx = service.create_transaction(db, user, make(food, tags=["a"]))
    assert service.get_transaction(db, user, tx.id) is tx
    assert tx.amount_minor == 1000
    updated = service.update_transaction(db, user, tx.id, make(food, amount="20"))
    assert updated.amount_minor == 2000
    assert updated.tags == []
    service.delete_transaction(db, user, tx.id)
    with pytest.raises(NotFoundError):
        service.get_transaction(db, user, tx.id)


def test_service_filters_by_user(db: Session, user: User, other_user: User, food: str) -> None:
    tx = service.create_transaction(db, user, make(food))
    for call in (
        lambda: service.get_transaction(db, other_user, tx.id),
        lambda: service.update_transaction(db, other_user, tx.id, make(food)),
        lambda: service.delete_transaction(db, other_user, tx.id),
    ):
        with pytest.raises(NotFoundError):
            call()


def test_lines_trigger_backstop_is_mapped_to_422(db: Session, user: User, food: str) -> None:
    """If a bad write ever got past validation, the DB trigger's 23514 becomes a 422 and the
    savepoint rolls back."""
    tx = service.create_transaction(db, user, make(food))
    # `model_construct` skips the schema's sum check so the write reaches the trigger.
    data = TransactionIn.model_construct(
        type=TransactionType.EXPENSE,
        amount="99",
        occurred_on=date(2026, 9, 1),
        category_id=None,
        lines=[LineIn(category_id=uuid.UUID(food), amount="1")],
        merchant=None,
        note=None,
        payment_method_id=None,
        tags=[],
    )
    with pytest.raises(UnprocessableError) as exc:
        service.update_transaction(db, user, tx.id, data)
    assert exc.value.errors[0]["type"] == "check_violation"
    db.expire_all()
    assert db.get(Transaction, tx.id).amount_minor == 1000  # type: ignore[union-attr]
    assert db.scalar(select(func.count()).select_from(TransactionLine)) == 1


def test_constraints_are_deferred_again_after_a_write(db: Session, user: User, food: str) -> None:
    service.create_transaction(db, user, make(food))
    # A deferred trigger lets an incomplete state exist until the end of the transaction.
    db.execute(
        text(
            "INSERT INTO transactions (user_id, type, occurred_on, amount_minor) "
            "VALUES (:u, 'expense', '2026-09-01', 5)"
        ),
        {"u": user.id},
    )
    with pytest.raises(IntegrityError):
        db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
