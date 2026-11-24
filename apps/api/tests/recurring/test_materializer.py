import threading
import uuid
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import Engine, delete, func, select
from sqlalchemy.orm import Session

from kori.categories.models import Category
from kori.common.enums import CategorySource, RecurrenceFrequency, TransactionSource
from kori.recurring import materializer
from kori.recurring.materializer import materialize_all, materialize_due, today_for
from kori.recurring.models import RecurringRule
from kori.transactions import service as tx_service
from kori.transactions.models import Transaction
from kori.users.models import User
from kori.users.service import create_user

from .helpers import category, payment_method
from .test_db import rule as make_rule

TODAY = date(2026, 11, 20)


@pytest.fixture(autouse=True)
def _clock(monkeypatch: pytest.MonkeyPatch) -> None:
    # create_transaction rejects future dates against the real clock; pin it to TODAY.
    monkeypatch.setattr(tx_service, "_today", lambda user: TODAY)
    monkeypatch.setattr(materializer, "today_for", lambda user: TODAY)


def txs(db: Session, rule: RecurringRule) -> list[Transaction]:
    return list(
        db.scalars(
            select(Transaction)
            .where(Transaction.recurring_rule_id == rule.id)
            .order_by(Transaction.occurred_on)
        )
    )


def due_rule(db: Session, user: User, **kw: object) -> RecurringRule:
    values: dict = {"start_on": date(2026, 11, 1), "next_due_on": date(2026, 11, 1)} | kw
    return make_rule(db, user, **values)


def test_monthly_rule_creates_one_transaction_and_advances(db: Session, user: User) -> None:
    pm = uuid.UUID(payment_method(db, user))
    rule = due_rule(db, user, amount_minor=1500000, merchant="Landlord", payment_method_id=pm)

    result = materialize_due(db, user, TODAY)

    assert (result.scanned, result.created, result.skipped, result.failed) == (1, 1, 0, 0)
    [tx] = txs(db, rule)
    assert tx.source is TransactionSource.RECURRING
    assert tx.occurred_on == date(2026, 11, 1)
    assert tx.amount_minor == 1500000
    assert tx.merchant == "Landlord"
    assert tx.payment_method_id == pm
    assert [(line.category_id, line.category_source) for line in tx.lines] == [
        (rule.category_id, CategorySource.RULE)
    ]
    assert rule.next_due_on == date(2026, 12, 1)
    assert rule.last_error is None


def test_not_due_yet_creates_nothing(db: Session, user: User) -> None:
    rule = due_rule(db, user, next_due_on=date(2026, 12, 1))
    result = materialize_due(db, user, TODAY)
    assert result.created == 0 and result.scanned == 0
    assert txs(db, rule) == []


def test_second_run_creates_nothing(db: Session, user: User) -> None:
    rule = due_rule(db, user)
    materialize_due(db, user, TODAY)
    again = materialize_due(db, user, TODAY)
    assert again.created == 0
    assert len(txs(db, rule)) == 1


def test_unique_key_backstop_counts_as_already_done(db: Session, user: User) -> None:
    rule = due_rule(db, user)
    materialize_due(db, user, TODAY)
    # Rewind the cursor: the unique key must stop a duplicate even if next_due_on is wrong.
    rule.next_due_on = date(2026, 11, 1)
    db.flush()
    result = materialize_due(db, user, TODAY)
    assert (result.created, result.skipped, result.failed) == (0, 1, 0)
    assert len(txs(db, rule)) == 1
    assert rule.next_due_on == date(2026, 12, 1)


def test_catch_up_creates_each_missed_occurrence(db: Session, user: User) -> None:
    rule = due_rule(db, user, start_on=date(2026, 8, 20), next_due_on=date(2026, 8, 20))
    result = materialize_due(db, user, TODAY)
    assert result.created == 4  # Aug 20, Sep 20, Oct 20, Nov 20
    assert [t.occurred_on for t in txs(db, rule)] == [
        date(2026, 8, 20),
        date(2026, 9, 20),
        date(2026, 10, 20),
        date(2026, 11, 20),
    ]
    assert rule.next_due_on == date(2026, 12, 20)


def test_catch_up_is_capped_and_finished_by_the_next_run(db: Session, user: User) -> None:
    rule = due_rule(
        db,
        user,
        frequency=RecurrenceFrequency.WEEKLY,
        start_on=date(2026, 1, 1),
        next_due_on=date(2026, 1, 1),
    )
    first = materialize_due(db, user, TODAY)
    assert first.created == 12
    assert rule.next_due_on == date(2026, 1, 1) + timedelta(weeks=12)
    while materialize_due(db, user, TODAY).created:
        pass
    assert rule.next_due_on is not None and rule.next_due_on > TODAY
    assert len(txs(db, rule)) == len(set(t.occurred_on for t in txs(db, rule))) == 47


def test_end_on_stops_the_rule(db: Session, user: User) -> None:
    rule = due_rule(db, user, end_on=date(2026, 11, 15))
    materialize_due(db, user, TODAY)
    assert len(txs(db, rule)) == 1
    assert rule.next_due_on is None
    assert materialize_due(db, user, TODAY).scanned == 0


def test_paused_rules_are_skipped(db: Session, user: User) -> None:
    rule = due_rule(db, user, paused_at=datetime.now(UTC))
    assert materialize_due(db, user, TODAY).scanned == 0
    assert txs(db, rule) == []


def test_archived_category_pauses_the_rule_with_an_error(db: Session, user: User) -> None:
    rule = due_rule(db, user)
    db.get_one(Category, rule.category_id).archived_at = datetime.now(UTC)
    db.flush()

    result = materialize_due(db, user, TODAY)

    assert (result.created, result.failed) == (0, 1)
    assert txs(db, rule) == []
    assert rule.paused_at is not None
    assert rule.last_error and "archived" in rule.last_error
    assert rule.next_due_on == date(2026, 11, 1)  # kept, so resuming doesn't lose anything
    assert materialize_due(db, user, TODAY).scanned == 0  # not retried forever


def test_deleted_occurrence_is_not_recreated(db: Session, user: User) -> None:
    rule = due_rule(db, user)
    materialize_due(db, user, TODAY)
    for tx in txs(db, rule):
        db.delete(tx)
    db.flush()
    assert materialize_due(db, user, TODAY).created == 0
    assert txs(db, rule) == []


def test_today_is_the_users_day_not_utc(db: Session, user: User, monkeypatch) -> None:
    class Frozen(datetime):
        @classmethod
        def now(cls, tz=None):  # type: ignore[no-untyped-def]
            return datetime(2026, 10, 31, 18, 30, tzinfo=UTC).astimezone(tz)

    monkeypatch.undo()  # drop the autouse pin: this test needs the real today_for
    monkeypatch.setattr(materializer, "datetime", Frozen)
    assert today_for(user) == date(2026, 11, 1)  # 00:30 in Dhaka; UTC is still Oct 31

    monkeypatch.setattr(tx_service, "_today", lambda user: date(2026, 11, 1))
    rule = due_rule(db, user)
    assert materialize_due(db, user, today_for(user)).created == 1
    assert txs(db, rule)[0].occurred_on == date(2026, 11, 1)


def test_materialize_all_covers_every_user_and_isolates_them(
    db: Session, user: User, other_user: User
) -> None:
    mine = due_rule(db, user)
    theirs = due_rule(db, other_user, name="Theirs")
    summary = materialize_all(db)
    assert summary.users >= 2
    assert summary.created == 2
    assert all(t.user_id == user.id for t in txs(db, mine))
    assert all(t.user_id == other_user.id for t in txs(db, theirs))
    assert summary.finished_at >= summary.started_at and summary.duration_ms >= 0


def test_materialize_due_only_touches_that_users_rules(
    db: Session, user: User, other_user: User
) -> None:
    due_rule(db, user)
    theirs = due_rule(db, other_user, name="Theirs")
    materialize_due(db, user, TODAY)
    assert txs(db, theirs) == []
    assert theirs.next_due_on == date(2026, 11, 1)


def test_unexpected_error_in_one_rule_does_not_stop_the_others(
    db: Session, user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    bad = due_rule(db, user, name="Bad", next_due_on=date(2026, 10, 1), start_on=date(2026, 10, 1))
    good = due_rule(db, user, name="Good")
    real = materializer.create_transaction

    def flaky(db: Session, user: User, data, **kw):  # type: ignore[no-untyped-def]
        if kw["recurring_rule_id"] == bad.id:
            raise RuntimeError("boom")
        return real(db, user, data, **kw)

    monkeypatch.setattr(materializer, "create_transaction", flaky)
    result = materialize_due(db, user, TODAY)
    assert (result.created, result.failed) == (1, 1)
    assert len(txs(db, good)) == 1 and txs(db, bad) == []


# --- concurrency: needs real, committed transactions on separate connections ----------------


@pytest.fixture
def committed_rule(engine: Engine) -> Iterator[tuple[uuid.UUID, uuid.UUID]]:
    with Session(engine) as s:
        user = create_user(s, email="race@example.com", display_name="Race", password="x" * 12)
        rule = make_rule(
            s,
            user,
            start_on=date(2026, 8, 20),
            next_due_on=date(2026, 8, 20),
            category_id=uuid.UUID(category(s, user, "Food & Dining")),
        )
        ids = (user.id, rule.id)
        s.commit()
    yield ids
    with Session(engine) as s:
        s.execute(delete(Transaction).where(Transaction.user_id == ids[0]))
        s.execute(delete(User).where(User.id == ids[0]))
        s.commit()


def test_a_rule_locked_by_another_run_is_skipped(
    engine: Engine, committed_rule: tuple[uuid.UUID, uuid.UUID]
) -> None:
    user_id, rule_id = committed_rule
    with Session(engine) as holder, Session(engine) as runner:
        holder.execute(
            select(RecurringRule).where(RecurringRule.id == rule_id).with_for_update()
        ).one()
        result = materialize_due(runner, runner.get_one(User, user_id), TODAY, commit_each=True)
        assert (result.created, result.skipped) == (0, 1)
        holder.rollback()


def test_two_concurrent_runs_create_each_occurrence_exactly_once(
    engine: Engine, committed_rule: tuple[uuid.UUID, uuid.UUID]
) -> None:
    user_id, rule_id = committed_rule
    barrier = threading.Barrier(2)
    errors: list[BaseException] = []

    def run() -> None:
        try:
            with Session(engine) as s:
                barrier.wait()
                materialize_due(s, s.get_one(User, user_id), TODAY, commit_each=True)
        except BaseException as exc:
            errors.append(exc)

    threads = [threading.Thread(target=run) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == []
    with Session(engine) as s:
        count = s.scalar(
            select(func.count())
            .select_from(Transaction)
            .where(Transaction.recurring_rule_id == rule_id)
        )
        assert count == 4  # Aug, Sep, Oct, Nov 20: once each, never twice
