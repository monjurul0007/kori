"""Read-only reports. Every amount is summed in integer poisha; there are no floats (ADR-0004).

Definitions are in docs/reports.md. These functions are the AI's tools in M5, so each takes
`(db, user, ...)` and returns a Pydantic model.
"""

import uuid
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from kori.budgets.service import add_months, budgets_in_effect, first_of_month
from kori.categories.models import Category
from kori.common.dates import month_bounds
from kori.common.enums import TransactionType
from kori.common.errors import NotFoundError
from kori.common.money import format_taka
from kori.reports.schemas import (
    BudgetStatus,
    CategoryBudgetStatus,
    CategorySpending,
    Level,
    LimitSource,
    OverallBudgetStatus,
    ReportCategory,
    SpendingReport,
    Trend,
    TrendMonth,
    Unbudgeted,
)
from kori.transactions.models import Transaction, TransactionLine
from kori.users.models import User

# Budget levels as percentages of the limit. Compared with integers, never floats.
WARNING_PERCENT = 80
OVER_PERCENT = 100


def today_for(user: User) -> date:
    """Today's date in the user's time zone."""
    return datetime.now(ZoneInfo(user.timezone)).date()


def percent_text(part: int, whole: int) -> str:
    """`part / whole` as a percentage with one decimal, rounded half up, from integers only."""
    if whole <= 0:
        return "0.0"
    tenths = (part * 2000 + whole) // (2 * whole)
    return f"{tenths // 10}.{tenths % 10}"


def level_for(spent: int, limit: int) -> Level:
    if spent * 100 >= limit * OVER_PERCENT:
        return Level.OVER
    if spent * 100 >= limit * WARNING_PERCENT:
        return Level.WARNING
    return Level.OK


def _report_category(c: Category) -> ReportCategory:
    return ReportCategory(id=c.id, name=c.name, kind=c.kind, archived=c.archived_at is not None)


def _lines_in_range(
    user: User, date_from: date, date_to: date, tx_type: TransactionType
) -> Select[Any]:
    return (
        select(TransactionLine.category_id)
        .join(Transaction, Transaction.id == TransactionLine.transaction_id)
        .where(
            Transaction.user_id == user.id,
            Transaction.type == tx_type,
            Transaction.occurred_on >= date_from,
            Transaction.occurred_on <= date_to,
        )
    )


def _spent_by_category(
    db: Session, user: User, date_from: date, date_to: date, tx_type: TransactionType
) -> list[tuple[Category, int, int]]:
    """One query: `(category, sum of line amounts, distinct transactions)` per category."""
    stmt = (
        _lines_in_range(user, date_from, date_to, tx_type)
        .add_columns(
            func.sum(TransactionLine.amount_minor),
            func.count(func.distinct(TransactionLine.transaction_id)),
        )
        .group_by(TransactionLine.category_id)
        .subquery()
    )
    rows = db.execute(
        select(Category, stmt.c.sum, stmt.c.count).join(stmt, stmt.c.category_id == Category.id)
    )
    return [(c, int(amount), int(count)) for c, amount, count in rows]


def get_spending(
    db: Session,
    user: User,
    date_from: date,
    date_to: date,
    type: TransactionType = TransactionType.EXPENSE,
) -> SpendingReport:
    """Spending (or income) by category between two dates, inclusive.

    A split counts toward each of its categories by its line amount.
    """
    rows = _spent_by_category(db, user, date_from, date_to, type)
    count = (
        db.scalar(
            select(func.count()).where(
                Transaction.user_id == user.id,
                Transaction.type == type,
                Transaction.occurred_on >= date_from,
                Transaction.occurred_on <= date_to,
            )
        )
        or 0
    )
    total = sum(amount for _, amount, _ in rows)
    rows.sort(key=lambda r: (-r[1], r[0].name))
    return SpendingReport(
        from_=date_from,
        to=date_to,
        type=type,
        total=format_taka(total),
        count=count,
        by_category=[
            CategorySpending(
                category=_report_category(c),
                amount=format_taka(amount),
                count=n,
                percent=percent_text(amount, total),
            )
            for c, amount, n in rows
        ],
    )


def get_budget_status(db: Session, user: User, month: str) -> BudgetStatus:
    """Budget progress for `month` (`YYYY-MM`): per category, overall, and unbudgeted spending."""
    first = first_of_month(month, ["query", "month"])
    date_from, date_to = month_bounds(month)

    limits: dict[uuid.UUID, int] = {}
    overall_set: int | None = None
    for b in budgets_in_effect(db, user, first):
        if b.amount_minor is None:
            continue
        if b.category_id is None:
            overall_set = b.amount_minor
        else:
            limits[b.category_id] = b.amount_minor

    spent_rows = _spent_by_category(db, user, date_from, date_to, TransactionType.EXPENSE)
    spent = {c.id: amount for c, amount, _ in spent_rows}
    budgeted = {c.id: c for c, _, _ in spent_rows if c.id in limits}
    missing = [cid for cid in limits if cid not in budgeted]
    if missing:
        rows = db.scalars(
            select(Category).where(Category.user_id == user.id, Category.id.in_(missing))
        )
        budgeted.update({c.id: c for c in rows})

    categories = []
    for cid, limit in limits.items():
        if cid not in budgeted:
            continue
        s = spent.get(cid, 0)
        categories.append(
            CategoryBudgetStatus(
                category=_report_category(budgeted[cid]),
                limit=format_taka(limit),
                spent=format_taka(s),
                remaining=_signed_taka(limit - s),
                percent=percent_text(s, limit),
                level=level_for(s, limit),
            )
        )
    categories.sort(key=lambda c: c.category.name)

    total_spent = sum(spent.values())
    overall = None
    if overall_set is not None:
        overall_limit, source = overall_set, LimitSource.SET
    elif limits:
        overall_limit, source = sum(limits.values()), LimitSource.SUM_OF_CATEGORIES
    else:
        overall_limit, source = None, None
    if overall_limit is not None and source is not None:
        overall = OverallBudgetStatus(
            limit=format_taka(overall_limit),
            limit_source=source,
            spent=format_taka(total_spent),
            remaining=_signed_taka(overall_limit - total_spent),
            percent=percent_text(total_spent, overall_limit),
            level=level_for(total_spent, overall_limit),
        )

    unbudgeted = sum(a for cid, a in spent.items() if cid not in limits)
    days_in_month = date_to.day
    today = today_for(user)
    if today > date_to:
        elapsed = days_in_month
    elif today < date_from:
        elapsed = 0
    else:
        elapsed = today.day
    return BudgetStatus(
        month=month,
        days_in_month=days_in_month,
        days_elapsed=elapsed,
        days_left=days_in_month - elapsed,
        overall=overall,
        categories=categories,
        unbudgeted=Unbudgeted(spent=format_taka(unbudgeted)),
    )


def _signed_taka(poisha: int) -> str:
    return f"-{format_taka(-poisha)}" if poisha < 0 else format_taka(poisha)


def get_trend(
    db: Session,
    user: User,
    end_month: str,
    months: int = 6,
    category_id: uuid.UUID | None = None,
) -> Trend:
    """Expense and income per month for `months` months ending at `end_month`, oldest first."""
    end_first = first_of_month(end_month, ["query", "end"])
    start = add_months(end_first, -(months - 1))
    last_day = month_bounds(end_month)[1]

    month_col = func.to_char(Transaction.occurred_on, "YYYY-MM").label("m")
    if category_id is None:
        amount = func.sum(Transaction.amount_minor)
        stmt = select(month_col, Transaction.type, amount)
    else:
        if (
            db.scalar(
                select(Category.id).where(Category.id == category_id, Category.user_id == user.id)
            )
            is None
        ):
            raise NotFoundError("Category not found")
        amount = func.sum(TransactionLine.amount_minor)
        stmt = select(month_col, Transaction.type, amount).join(
            TransactionLine,
            (TransactionLine.transaction_id == Transaction.id)
            & (TransactionLine.category_id == category_id),
        )
    stmt = stmt.where(
        Transaction.user_id == user.id,
        Transaction.occurred_on >= start,
        Transaction.occurred_on <= last_day,
    ).group_by(month_col, Transaction.type)

    sums: dict[tuple[str, TransactionType], int] = {}
    for m, kind, total in db.execute(stmt):
        sums[(m, kind)] = int(total)

    out = []
    for i in range(months):
        first = add_months(start, i)
        out.append(
            TrendMonth(
                month=f"{first:%Y-%m}",
                expense=format_taka(sums.get((f"{first:%Y-%m}", TransactionType.EXPENSE), 0)),
                income=format_taka(sums.get((f"{first:%Y-%m}", TransactionType.INCOME), 0)),
            )
        )
    return Trend(months=out)
