import uuid
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from kori.budgets import service as budgets_service
from kori.budgets.models import Budget
from kori.common.dates import month_bounds
from kori.common.enums import CategoryKind, TransactionType
from kori.common.money import format_taka
from kori.reports import router, service
from kori.reports.service import level_for, percent_text
from kori.seed.run import seed
from kori.transactions.schemas import LineIn, TransactionIn
from kori.transactions.service import TransactionFilters, create_transaction, list_transactions
from kori.users.models import User

from .conftest import cat

SPENDING = "/api/v1/reports/spending"
STATUS = "/api/v1/reports/budget-status"
TREND = "/api/v1/reports/trend"
TODAY = date(2026, 10, 6)


def add(
    db: Session, user: User, day: str, amount: str, category: str = "Food & Dining", **kw: Any
) -> None:
    kind = kw.pop("kind", TransactionType.EXPENSE)
    cat_kind = CategoryKind(kind.value)
    create_transaction(
        db,
        user,
        TransactionIn(
            type=kind,
            amount=amount,
            occurred_on=date.fromisoformat(day),
            category_id=cat(db, user, category, cat_kind).id,
        ),
    )


def budget(db: Session, user: User, month: str, category: str | None, amount: int | None) -> None:
    category_id = cat(db, user, category).id if category else None
    db.add(
        Budget(
            user_id=user.id,
            category_id=category_id,
            effective_from=date.fromisoformat(f"{month}-01"),
            amount_minor=amount,
        )
    )
    db.flush()


@pytest.fixture(autouse=True)
def _today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service, "today_for", lambda user: TODAY)
    monkeypatch.setattr(budgets_service, "current_month", lambda user: "2026-10")
    monkeypatch.setattr(router, "current_month", lambda user: "2026-10")


# --- pure helpers ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("part", "whole", "want"),
    [
        (0, 100, "0.0"),
        (1, 3, "33.3"),
        (2, 3, "66.7"),
        (1, 8, "12.5"),
        (1, 16, "6.3"),
        (3, 2, "150.0"),
    ],
)
def test_percent_rounds_half_up_with_integers(part: int, whole: int, want: str) -> None:
    assert percent_text(part, whole) == want


def test_percent_of_nothing_is_zero() -> None:
    assert percent_text(5, 0) == "0.0"


@pytest.mark.parametrize(
    ("spent", "want"),
    [
        (0, "ok"),
        (7999, "ok"),
        (8000, "warning"),
        (9999, "warning"),
        (10000, "over"),
        (12000, "over"),
    ],
)
def test_levels(spent: int, want: str) -> None:
    assert level_for(spent, 10000) == want


# --- spending -------------------------------------------------------------------------------


def test_split_counts_toward_each_category(db: Session, user: User) -> None:
    food, transport = cat(db, user, "Food & Dining"), cat(db, user, "Transport")
    create_transaction(
        db,
        user,
        TransactionIn(
            type=TransactionType.EXPENSE,
            amount="500.00",
            occurred_on=date(2026, 9, 10),
            lines=[
                LineIn(category_id=food.id, amount="300.00"),
                LineIn(category_id=transport.id, amount="200.00"),
            ],
        ),
    )
    r = service.get_spending(db, user, date(2026, 9, 1), date(2026, 9, 30))
    assert (r.total, r.count) == ("500.00", 1)
    assert [(c.category.name, c.amount, c.count, c.percent) for c in r.by_category] == [
        ("Food & Dining", "300.00", 1, "60.0"),
        ("Transport", "200.00", 1, "40.0"),
    ]


def test_income_and_expense_are_kept_apart(db: Session, user: User) -> None:
    add(db, user, "2026-09-10", "100.00")
    add(db, user, "2026-09-11", "5000.00", "Salary", kind=TransactionType.INCOME)
    out = service.get_spending(db, user, date(2026, 9, 1), date(2026, 9, 30))
    assert out.total == "100.00"
    first, last = date(2026, 9, 1), date(2026, 9, 30)
    inc = service.get_spending(db, user, first, last, TransactionType.INCOME)
    assert (inc.total, inc.by_category[0].category.name) == ("5000.00", "Salary")


def test_month_boundaries(db: Session, user: User) -> None:
    add(db, user, "2026-08-31", "10.00")
    add(db, user, "2026-09-01", "20.00")
    add(db, user, "2026-09-30", "30.00")
    add(db, user, "2026-10-01", "40.00")
    assert service.get_spending(db, user, date(2026, 9, 1), date(2026, 9, 30)).total == "50.00"
    months = service.get_trend(db, user, "2026-10", 3).months
    assert [(m.month, m.expense) for m in months] == [
        ("2026-08", "10.00"),
        ("2026-09", "50.00"),
        ("2026-10", "40.00"),
    ]


def test_ties_sort_by_name_and_archived_categories_stay(db: Session, user: User) -> None:
    add(db, user, "2026-09-10", "10.00", "Transport")
    add(db, user, "2026-09-10", "10.00", "Food & Dining")
    cat(db, user, "Transport").archived_at = text("now()")  # type: ignore[assignment]
    db.flush()
    db.expire_all()
    r = service.get_spending(db, user, date(2026, 9, 1), date(2026, 9, 30))
    assert [(c.category.name, c.category.archived) for c in r.by_category] == [
        ("Food & Dining", False),
        ("Transport", True),
    ]


def test_spending_endpoint_shape_and_ranges(signed_in: TestClient, db: Session, user: User) -> None:
    add(db, user, "2026-09-10", "100.00")
    body = signed_in.get(SPENDING, params={"month": "2026-09"}).json()
    assert body["from"] == "2026-09-01"
    assert body["to"] == "2026-09-30"
    assert body["type"] == "expense"
    assert body["by_category"][0]["amount"] == "100.00"
    r = signed_in.get(SPENDING, params={"from": "2026-09-10", "to": "2026-09-10"})
    assert r.json()["count"] == 1
    assert signed_in.get(SPENDING).json()["from"] == "2026-10-01"
    both = {"month": "2026-09", "from": "2026-09-01"}
    assert signed_in.get(SPENDING, params=both).status_code == 422
    assert signed_in.get(SPENDING, params={"from": "2026-09-01"}).status_code == 422


# --- budget status --------------------------------------------------------------------------


def test_levels_and_remaining_per_category(db: Session, user: User) -> None:
    budget(db, user, "2026-09", "Food & Dining", 100000)
    budget(db, user, "2026-09", "Transport", 100000)
    budget(db, user, "2026-09", "Shopping", 100000)
    add(db, user, "2026-09-02", "799.90")
    add(db, user, "2026-09-02", "800.00", "Transport")
    add(db, user, "2026-09-02", "1200.00", "Shopping")
    s = service.get_budget_status(db, user, "2026-09")
    got = {c.category.name: (c.spent, c.remaining, c.percent, c.level) for c in s.categories}
    assert got == {
        "Food & Dining": ("799.90", "200.10", "80.0", "ok"),
        "Transport": ("800.00", "200.00", "80.0", "warning"),
        "Shopping": ("1200.00", "-200.00", "120.0", "over"),
    }


def test_overall_set_wins_and_counts_unbudgeted(db: Session, user: User) -> None:
    budget(db, user, "2026-09", None, 500000)
    budget(db, user, "2026-09", "Food & Dining", 100000)
    add(db, user, "2026-09-02", "400.00")
    add(db, user, "2026-09-02", "600.00", "Transport")  # no budget
    s = service.get_budget_status(db, user, "2026-09")
    assert s.overall is not None
    o = s.overall
    assert (o.limit, o.limit_source, o.spent) == ("5000.00", "set", "1000.00")
    assert s.unbudgeted.spent == "600.00"


def test_overall_falls_back_to_sum_of_categories(db: Session, user: User) -> None:
    budget(db, user, "2026-09", "Food & Dining", 100000)
    budget(db, user, "2026-09", "Transport", 50000)
    s = service.get_budget_status(db, user, "2026-09")
    assert s.overall is not None
    assert (s.overall.limit, s.overall.limit_source) == ("1500.00", "sum_of_categories")
    assert s.overall.level == "ok"


def test_overall_is_null_without_any_budget(db: Session, user: User) -> None:
    add(db, user, "2026-09-02", "400.00")
    s = service.get_budget_status(db, user, "2026-09")
    assert s.overall is None
    assert s.categories == []
    assert s.unbudgeted.spent == "400.00"


def test_carry_forward_and_clearing(db: Session, user: User) -> None:
    budget(db, user, "2026-07", "Food & Dining", 100000)
    budget(db, user, "2026-09", "Transport", 20000)
    budget(db, user, "2026-10", "Food & Dining", None)  # cleared from October
    sep = service.get_budget_status(db, user, "2026-09")
    assert {c.category.name for c in sep.categories} == {"Food & Dining", "Transport"}
    octo = service.get_budget_status(db, user, "2026-10")
    assert {c.category.name for c in octo.categories} == {"Transport"}


def test_budget_without_spending_still_listed(db: Session, user: User) -> None:
    budget(db, user, "2026-09", "Food & Dining", 100000)
    s = service.get_budget_status(db, user, "2026-09")
    assert [(c.spent, c.percent, c.level) for c in s.categories] == [("0.00", "0.0", "ok")]


@pytest.mark.parametrize(
    ("month", "elapsed", "left"),
    [("2026-09", 30, 0), ("2026-10", 6, 25), ("2026-11", 0, 30)],
)
def test_days(db: Session, user: User, month: str, elapsed: int, left: int) -> None:
    s = service.get_budget_status(db, user, month)
    assert (s.days_elapsed, s.days_left) == (elapsed, left)
    assert s.days_in_month == elapsed + left


def test_budget_status_endpoint(signed_in: TestClient, db: Session, user: User) -> None:
    budget(db, user, "2026-10", "Food & Dining", 100000)
    body = signed_in.get(STATUS).json()
    assert body["month"] == "2026-10"
    assert body["categories"][0]["limit"] == "1000.00"
    assert signed_in.get(STATUS, params={"month": "2026-13"}).status_code == 422


# --- trend ----------------------------------------------------------------------------------


def test_trend_fills_empty_months_and_filters_by_category(db: Session, user: User) -> None:
    add(db, user, "2026-08-05", "100.00")
    add(db, user, "2026-10-05", "50.00", "Transport")
    add(db, user, "2026-10-06", "900.00", "Salary", kind=TransactionType.INCOME)
    t = service.get_trend(db, user, "2026-10", 4)
    assert [m.month for m in t.months] == ["2026-07", "2026-08", "2026-09", "2026-10"]
    assert [(m.expense, m.income) for m in t.months] == [
        ("0.00", "0.00"),
        ("100.00", "0.00"),
        ("0.00", "0.00"),
        ("50.00", "900.00"),
    ]
    only = service.get_trend(db, user, "2026-10", 4, cat(db, user, "Transport").id)
    assert [m.expense for m in only.months] == ["0.00", "0.00", "0.00", "50.00"]


def test_trend_endpoint_limits(signed_in: TestClient) -> None:
    assert len(signed_in.get(TREND).json()["months"]) == 6
    assert len(signed_in.get(TREND, params={"months": 24}).json()["months"]) == 24
    assert signed_in.get(TREND, params={"months": 25}).status_code == 422
    assert signed_in.get(TREND, params={"months": 0}).status_code == 422


# --- SQL ground truth on the seed -----------------------------------------------------------


@pytest.fixture
def demo(db: Session) -> User:
    password = "demo-password-for-tests"  # noqa: S105  (fake)
    result = seed(db, email="demo@kori.local", password=password, months=6, seed=42, today=TODAY)
    return result.user


@pytest.mark.parametrize("month", ["2026-06", "2026-08", "2026-10"])
def test_reports_equal_raw_sql(db: Session, demo: User, month: str) -> None:
    first, last = month_bounds(month)
    params = {"u": demo.id, "a": first, "b": last}
    rows = db.execute(
        text(
            """
            SELECT l.category_id, sum(l.amount_minor), count(DISTINCT t.id)
            FROM transaction_lines l JOIN transactions t ON t.id = l.transaction_id
            WHERE t.user_id = :u AND t.type = 'expense'
              AND t.occurred_on BETWEEN :a AND :b
            GROUP BY l.category_id
            """
        ),
        params,
    ).all()
    want = {r[0]: (int(r[1]), r[2]) for r in rows}
    report = service.get_spending(db, demo, first, last)
    assert {c.category.id: (c.amount, c.count) for c in report.by_category} == {
        k: (format_taka(a), n) for k, (a, n) in want.items()
    }
    assert report.total == format_taka(sum(a for a, _ in want.values()))
    tx_count = db.scalar(
        text(
            "SELECT count(*) FROM transactions WHERE user_id = :u AND type = 'expense' "
            "AND occurred_on BETWEEN :a AND :b"
        ),
        params,
    )
    assert report.count == tx_count

    # The list endpoint's totals (M1-09) agree with the report.
    page = list_transactions(db, demo, TransactionFilters(date_from=first, date_to=last), None, 1)
    assert page.totals.expense == report.total

    # Trend: one month of the series equals the same raw sum, for expense and income.
    trend = {m.month: m for m in service.get_trend(db, demo, month, 1).months}[month]
    sums = dict(
        db.execute(
            text(
                "SELECT type::text, sum(amount_minor) FROM transactions "
                "WHERE user_id = :u AND occurred_on BETWEEN :a AND :b GROUP BY type"
            ),
            params,
        ).all()
    )
    assert trend.expense == format_taka(int(sums.get("expense", 0)))
    assert trend.income == format_taka(int(sums.get("income", 0)))

    # Budget status: set a budget for the top category and check spent against the SQL.
    top = max(want, key=lambda k: want[k][0])
    db.add(Budget(user_id=demo.id, category_id=top, effective_from=first, amount_minor=1000000))
    db.flush()
    status = service.get_budget_status(db, demo, month)
    assert [c.spent for c in status.categories] == [format_taka(want[top][0])]
    assert status.overall is not None
    assert status.overall.spent == report.total
    assert status.unbudgeted.spent == format_taka(sum(a for k, (a, _) in want.items() if k != top))


# --- isolation and query counts -------------------------------------------------------------


def test_requires_a_session(client: TestClient) -> None:
    for url in (SPENDING, STATUS, TREND):
        assert client.get(url).status_code == 401


def test_other_users_data_never_appears(
    signed_in: TestClient, db: Session, user: User, other_user: User
) -> None:
    add(db, other_user, "2026-10-02", "999.00")
    add(db, other_user, "2026-10-02", "999.00", "Salary", kind=TransactionType.INCOME)
    budget(db, other_user, "2026-10", "Food & Dining", 100000)
    assert signed_in.get(SPENDING).json()["total"] == "0.00"
    assert signed_in.get(SPENDING, params={"type": "income"}).json()["count"] == 0
    status = signed_in.get(STATUS).json()
    assert status["overall"] is None
    assert status["categories"] == []
    assert status["unbudgeted"]["spent"] == "0.00"
    assert all(m["expense"] == "0.00" for m in signed_in.get(TREND).json()["months"])


def test_trend_for_another_users_category_is_404(
    signed_in: TestClient, db: Session, other_user: User
) -> None:
    other_food = cat(db, other_user, "Food & Dining").id
    assert signed_in.get(TREND, params={"category_id": str(other_food)}).status_code == 404
    assert signed_in.get(TREND, params={"category_id": str(uuid.uuid4())}).status_code == 404


def count_queries(engine: Engine, fn: Any) -> int:
    n = 0

    def hit(*_a: object, **_k: object) -> None:
        nonlocal n
        n += 1

    event.listen(engine, "before_cursor_execute", hit)
    try:
        fn()
    finally:
        event.remove(engine, "before_cursor_execute", hit)
    return n


def _bulk(db: Session, user: User, n: int) -> None:
    names = ["Food & Dining", "Transport", "Shopping", "Utilities"]
    for i in range(n):
        add(db, user, f"2026-10-{i % 5 + 1:02d}", "10.00", names[i % len(names)])
    db.flush()


def test_query_count_is_constant(db: Session, user: User) -> None:
    budget(db, user, "2026-10", "Food & Dining", 100000)
    engine = db.get_bind().engine
    food = cat(db, user, "Food & Dining").id

    def measure() -> list[int]:
        db.expire_all()
        calls = [
            lambda: service.get_spending(db, user, date(2026, 10, 1), date(2026, 10, 31)),
            lambda: service.get_budget_status(db, user, "2026-10"),
            lambda: service.get_trend(db, user, "2026-10", 6),
            lambda: service.get_trend(db, user, "2026-10", 6, food),
        ]
        return [count_queries(engine, c) for c in calls]

    _bulk(db, user, 10)
    small = measure()
    _bulk(db, user, 990)
    assert measure() == small
    assert max(small) <= 3
