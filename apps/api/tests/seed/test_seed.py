import hashlib
import random
import time
from collections import defaultdict
from collections.abc import Iterator
from datetime import date, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from typer.testing import CliRunner

from kori.cli import app
from kori.common.enums import CategorySource, TransactionSource
from kori.config import get_settings
from kori.seed.generator import TxSpec, generate, window_start
from kori.seed.profiles import PROFILES
from kori.seed.run import seed
from kori.tags.models import Tag
from kori.transactions.models import Transaction, TransactionLine

TODAY = date(2026, 10, 6)  # a Tuesday, so the current month is partial
EMAIL = "demo@kori.local"
PASSWORD = "demo-password-for-tests"  # noqa: S105  (fake)


def specs(seed_value: int = 42, months: int = 6) -> list[TxSpec]:
    rng = random.Random(seed_value)  # noqa: S311
    return generate(rng, months, TODAY)


def digest(items: list[TxSpec]) -> str:
    return hashlib.sha256(repr(items).encode()).hexdigest()


def test_same_seed_and_today_give_identical_specs() -> None:
    assert digest(specs()) == digest(specs())


def test_different_seed_gives_different_specs() -> None:
    assert digest(specs(1)) != digest(specs(2))


def test_six_months_have_a_realistic_number_of_transactions() -> None:
    assert 400 <= len(specs()) <= 700


def test_everything_is_inside_the_window() -> None:
    items = specs()
    assert min(s.occurred_on for s in items) >= window_start(TODAY, 6)
    assert max(s.occurred_on for s in items) <= TODAY


def test_amounts_are_inside_their_profile_range() -> None:
    for s in specs():
        if s.anomaly is not None:
            continue
        p = PROFILES[s.profile]
        assert p.lo * 100 <= s.amount <= p.hi * 100, s
        assert s.amount % (p.step * 100) == 0, s


def test_split_lines_add_up_to_the_total() -> None:
    items = specs()
    splits = [s for s in items if len(s.lines) > 1]
    assert splits
    for s in items:
        assert sum(line.amount for line in s.lines) == s.amount
        assert all(line.amount > 0 for line in s.lines)
    assert {line.category for s in splits for line in s.lines} == {"Groceries & Bazar", "Shopping"}


def test_all_three_anomalies_are_on_their_documented_dates() -> None:
    items = specs()
    planted = [s for s in items if s.anomaly is not None]

    spike = [s for s in planted if s.anomaly == 1]
    assert {s.occurred_on for s in spike} == {date(2026, 6, d) for d in (9, 11, 12, 13)}
    week_start = date(2026, 6, 8)  # the Monday of that week
    weeks: dict[date, int] = defaultdict(int)
    for s in items:
        if s.lines[0].category == "Food & Dining":
            weeks[s.occurred_on - timedelta(days=s.occurred_on.weekday())] += s.amount
    typical = sorted(v for k, v in weeks.items() if k != week_start)
    median = typical[len(typical) // 2]
    assert 2.8 <= weeks[week_start] / median <= 3.2

    (health,) = (s for s in planted if s.anomaly == 2)
    assert (health.occurred_on, health.amount, health.lines[0].category) == (
        date(2026, 7, 9),
        18_500_00,
        "Health & Medicine",
    )

    eid = [s for s in planted if s.anomaly == 3]
    assert [(s.occurred_on, s.lines[0].category) for s in eid] == [
        (date(2026, 8, d), "Shopping") for d in (10, 11, 12)
    ]
    assert sum(s.amount for s in eid) == 42_000_00
    assert all(s.tags == ("eid",) for s in eid)


def test_trip_is_tagged() -> None:
    trip = [s for s in specs() if "coxs-bazar-trip" in s.tags]
    assert trip
    assert {s.occurred_on for s in trip} <= {date(2026, 5, d) for d in (18, 19, 20)}


def test_rejects_a_window_that_cannot_hold_the_anomalies() -> None:
    with pytest.raises(ValueError, match="months"):
        specs(months=2)


def test_seed_writes_through_the_service_and_marks_rows(db: Session) -> None:
    started = time.monotonic()
    result = seed(db, email=EMAIL, password=PASSWORD, months=6, seed=42, today=TODAY)
    assert time.monotonic() - started < 10

    assert result.created_user
    expected = specs()
    assert result.transactions == len(expected)
    rows = db.scalars(select(Transaction).where(Transaction.user_id == result.user.id)).all()
    assert len(rows) == len(expected)
    assert {r.source for r in rows} == {TransactionSource.SEED}
    sources = db.scalars(
        select(TransactionLine.category_source)
        .join(Transaction)
        .where(Transaction.user_id == result.user.id)
    ).all()
    assert set(sources) == {CategorySource.SEED}
    assert sum(r.amount_minor for r in rows) == sum(s.amount for s in expected)
    tags = set(db.scalars(select(Tag.name).where(Tag.user_id == result.user.id)))
    assert tags == {"eid", "coxs-bazar-trip"}


def test_seed_refuses_existing_data_unless_reset(db: Session) -> None:
    first = seed(db, email=EMAIL, password=PASSWORD, months=6, seed=42, today=TODAY)
    with pytest.raises(ValueError, match="--reset"):
        seed(db, email=EMAIL, password=None, months=6, seed=42, today=TODAY)

    again = seed(db, email=EMAIL, password=None, months=6, seed=7, reset=True, today=TODAY)
    assert not again.created_user
    count = db.scalar(
        select(func.count()).select_from(Transaction).where(Transaction.user_id == first.user.id)
    )
    assert count == again.transactions


def test_seed_needs_a_password_for_a_new_user(db: Session) -> None:
    with pytest.raises(ValueError, match="password"):
        seed(db, email=EMAIL, password=None, months=6, seed=42, today=TODAY)


@pytest.fixture
def production(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("KORI_ENV", "production")
    monkeypatch.setenv("KORI_APP_ORIGIN", "https://kori.example.com")
    get_settings.cache_clear()
    yield
    monkeypatch.undo()
    get_settings.cache_clear()


@pytest.mark.usefixtures("production")
def test_cli_refuses_in_production() -> None:
    result = CliRunner().invoke(app, ["seed"])
    assert result.exit_code == 1
    assert "KORI_ENV=production" in result.output
