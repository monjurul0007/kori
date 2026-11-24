import uuid
from datetime import date

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from kori.common.enums import RecurrenceFrequency, TransactionType
from kori.recurring.models import RecurringRule
from kori.transactions.models import Transaction
from kori.users.models import User

from .helpers import category


def rule(db: Session, user: User, **kw: object) -> RecurringRule:
    values: dict = {
        "user_id": user.id,
        "name": "Rent",
        "type": TransactionType.EXPENSE,
        "amount_minor": 100,
        "category_id": uuid.UUID(category(db, user, "Food & Dining")),
        "frequency": RecurrenceFrequency.MONTHLY,
        "start_on": date(2026, 11, 1),
    } | kw
    row = RecurringRule(**values)
    db.add(row)
    db.flush()
    return row


def tx(user: User, on: date, rule_id: uuid.UUID | None) -> Transaction:
    return Transaction(
        user_id=user.id,
        type=TransactionType.EXPENSE,
        occurred_on=on,
        amount_minor=100,
        recurring_rule_id=rule_id,
    )


def test_one_transaction_per_rule_and_date(db: Session, user: User) -> None:
    r = rule(db, user)
    db.add(tx(user, date(2026, 11, 1), r.id))
    db.flush()
    db.add(tx(user, date(2026, 12, 1), r.id))  # another date is fine
    db.flush()
    duplicate = tx(user, date(2026, 11, 1), r.id)
    with (
        pytest.raises(IntegrityError, match="uq_transactions_recurring_rule_id_occurred_on"),
        db.begin_nested(),
    ):
        db.add(duplicate)
        db.flush()


def test_manual_transactions_are_unaffected_by_the_unique_key(db: Session, user: User) -> None:
    db.add_all([tx(user, date(2026, 11, 1), None), tx(user, date(2026, 11, 1), None)])
    db.flush()  # NULL rule ids are distinct


def test_deleting_a_rule_nulls_the_link(db: Session, user: User) -> None:
    r = rule(db, user)
    t = tx(user, date(2026, 11, 1), r.id)
    db.add(t)
    db.flush()
    db.execute(text("DELETE FROM recurring_rules WHERE id = :id"), {"id": r.id})
    db.refresh(t)
    assert t.recurring_rule_id is None


@pytest.mark.parametrize(
    "bad",
    [
        {"amount_minor": 0},
        {"interval": 0},
        {"interval": 13},
        {"name": ""},
        {"name": "x" * 61},
        {"end_on": date(2026, 10, 31)},
    ],
)
def test_check_constraints(db: Session, user: User, bad: dict) -> None:
    with pytest.raises(IntegrityError, match="ck_recurring_rules"), db.begin_nested():
        rule(db, user, **bad)


def test_the_category_cannot_be_deleted_while_a_rule_uses_it(db: Session, user: User) -> None:
    r = rule(db, user)
    with pytest.raises(IntegrityError), db.begin_nested():
        db.execute(text("DELETE FROM categories WHERE id = :id"), {"id": r.category_id})
