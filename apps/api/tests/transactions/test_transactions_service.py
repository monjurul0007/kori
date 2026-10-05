import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from kori.categories import service as categories
from kori.common.enums import CategoryKind, TransactionType
from kori.common.errors import NotFoundError, UnprocessableError
from kori.payment_methods import service as payment_methods
from kori.tags.models import Tag, TransactionTag
from kori.transactions import service
from kori.transactions.models import Transaction, TransactionLine
from kori.transactions.schemas import LineIn, TransactionIn
from kori.users.models import User

from .helpers import category, payment_method


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


def _locs(exc: pytest.ExceptionInfo[UnprocessableError]) -> list[list[str | int]]:
    return [e["loc"] for e in exc.value.errors]


def test_create_stores_poisha_and_manual_sources(db: Session, user: User, food: str) -> None:
    tx = service.create_transaction(db, user, make(food, amount="1250.50", merchant="Shop"))
    assert tx.amount_minor == 125050
    assert tx.source.value == "manual"
    assert tx.user_id == user.id
    assert [(ln.amount_minor, ln.category_source.value, ln.position) for ln in tx.lines] == [
        (125050, "user", 0)
    ]


def test_create_split_keeps_line_order(db: Session, user: User, food: str) -> None:
    other = category(db, user, "Other")
    lines = [{"category_id": other, "amount": "3"}, {"category_id": food, "amount": "7"}]
    tx = service.create_transaction(
        db, user, make(food, category_id=None, lines=lines, amount="10")
    )
    assert [(str(ln.category_id), ln.amount_minor) for ln in tx.lines] == [
        (other, 300),
        (food, 700),
    ]


def test_validation_rejects_other_users_data_and_writes_nothing(
    db: Session, user: User, other_user: User
) -> None:
    theirs = category(db, other_user, "Other")
    data = make(theirs, payment_method_id=payment_method(db, other_user))
    with pytest.raises(UnprocessableError) as exc:
        service.create_transaction(db, user, data)
    assert sorted(_locs(exc)) == [["body", "category_id"], ["body", "payment_method_id"]]
    assert db.scalar(select(func.count()).select_from(Transaction)) == 0


def test_validation_rejects_wrong_kind_and_archived(db: Session, user: User, food: str) -> None:
    salary = category(db, user, "Salary", CategoryKind.INCOME)
    with pytest.raises(UnprocessableError) as exc:
        service.create_transaction(db, user, make(salary))
    assert exc.value.errors[0]["type"] == "kind"

    categories.archive_category(db, user, uuid.UUID(food))
    with pytest.raises(UnprocessableError) as exc:
        service.create_transaction(db, user, make(food))
    assert exc.value.errors[0]["type"] == "archived"

    cash = uuid.UUID(payment_method(db, user))
    payment_methods.archive_payment_method(db, user, cash)
    other = category(db, user, "Other")
    with pytest.raises(UnprocessableError) as exc:
        service.create_transaction(db, user, make(other, payment_method_id=str(cash)))
    assert exc.value.errors[0]["type"] == "archived"


def test_validation_reports_split_line_position(db: Session, user: User, food: str) -> None:
    salary = category(db, user, "Salary", CategoryKind.INCOME)
    lines = [{"category_id": food, "amount": "1"}, {"category_id": salary, "amount": "1"}]
    with pytest.raises(UnprocessableError) as exc:
        service.create_transaction(db, user, make(food, category_id=None, lines=lines, amount="2"))
    assert _locs(exc) == [["body", "lines", 1, "category_id"]]


def test_date_cap_is_today_in_the_users_time_zone(
    db: Session, user: User, food: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    # 2026-12-31 23:00 UTC is already 2027-01-01 in Dhaka (UTC+6).
    monkeypatch.setattr(
        service,
        "_today",
        lambda u: datetime(2026, 12, 31, 23, tzinfo=UTC).astimezone(ZoneInfo(u.timezone)).date(),
    )
    assert service._today(user) == date(2027, 1, 1)
    edge = date(2027, 1, 1)
    service.create_transaction(db, user, make(food, occurred_on=edge))
    with pytest.raises(UnprocessableError):
        service.create_transaction(db, user, make(food, occurred_on=edge + timedelta(days=1)))
    with pytest.raises(UnprocessableError):
        service.create_transaction(db, user, make(food, occurred_on=date(1999, 12, 31)))


def test_tags_are_upserted_per_user_and_reused(
    db: Session, user: User, other_user: User, food: str
) -> None:
    a = service.create_transaction(db, user, make(food, tags=["Work", "work", "Road Trip"]))
    b = service.create_transaction(db, user, make(food, tags=["WORK"]))
    assert [t.name for t in a.tags] == ["road-trip", "work"]
    assert a.tags[1].id == b.tags[0].id
    mine = db.scalar(select(func.count()).select_from(Tag).where(Tag.user_id == user.id))
    assert mine == 2

    theirs = service.create_transaction(
        db, other_user, make(category(db, other_user, "Other"), tags=["work"])
    )
    assert theirs.tags[0].id != b.tags[0].id  # same name, separate per-user tag


def test_update_replaces_lines_and_tags_and_bumps_updated_at(
    db: Session, user: User, food: str
) -> None:
    tx = service.create_transaction(db, user, make(food, tags=["a", "b"]))
    before = tx.updated_at
    db.execute(text("SELECT pg_sleep(0.01)"))
    other = category(db, user, "Other")
    lines = [{"category_id": food, "amount": "4"}, {"category_id": other, "amount": "6"}]
    updated = service.update_transaction(
        db, user, tx.id, make(food, category_id=None, lines=lines, tags=["b", "c"], merchant="M")
    )
    assert [ln.amount_minor for ln in updated.lines] == [400, 600]
    assert [t.name for t in updated.tags] == ["b", "c"]
    assert updated.merchant == "M"
    assert updated.created_at == tx.created_at
    assert updated.updated_at >= before


def test_failed_update_changes_nothing(
    db: Session, user: User, other_user: User, food: str
) -> None:
    tx = service.create_transaction(db, user, make(food, merchant="Keep", tags=["keep"]))
    theirs = category(db, other_user, "Other")
    with pytest.raises(UnprocessableError):
        service.update_transaction(db, user, tx.id, make(theirs, merchant="Changed", tags=["x"]))
    db.expire_all()
    again = service.get_transaction(db, user, tx.id)
    assert (again.merchant, again.amount_minor, [t.name for t in again.tags]) == (
        "Keep",
        1000,
        ["keep"],
    )


def test_delete_removes_lines_and_links_but_keeps_tags(db: Session, user: User, food: str) -> None:
    tx = service.create_transaction(db, user, make(food, tags=["x"]))
    service.delete_transaction(db, user, tx.id)
    assert db.scalar(select(func.count()).select_from(TransactionLine)) == 0
    assert db.scalar(select(func.count()).select_from(TransactionTag)) == 0
    assert db.scalar(select(func.count()).select_from(Tag)) == 1
