import re
import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from kori.budgets.models import Budget
from kori.budgets.schemas import BudgetCategory, BudgetOut, CategoryBudgetOut, MonthBudgets
from kori.categories.models import Category
from kori.common.enums import CategoryKind
from kori.common.errors import UnprocessableError, field_error
from kori.common.money import MoneyError, format_taka, parse_taka
from kori.users.models import User

MAX_MONTHS_AHEAD = 12
_MONTH = re.compile(r"(\d{4})-(0[1-9]|1[0-2])")


def current_month(user: User) -> str:
    return datetime.now(ZoneInfo(user.timezone)).strftime("%Y-%m")


def _first_of(month: str, loc: list[str | int]) -> date:
    match = _MONTH.fullmatch(month)
    if match is None:
        raise UnprocessableError([field_error(loc, "Month must look like 2026-11", "value_error")])
    return date(int(match[1]), int(match[2]), 1)


def _add_months(first: date, months: int) -> date:
    index = first.year * 12 + first.month - 1 + months
    return date(index // 12, index % 12 + 1, 1)


def _budgets_in_effect(db: Session, user: User, first: date) -> list[Budget]:
    """The row in effect on `first` for each category and for the overall slot (NULL category).

    Rows with a NULL amount are returned too: they are the "cleared" marker, and callers drop them.
    """
    return list(
        db.scalars(
            select(Budget)
            .ext(distinct_on(Budget.category_id))
            .where(Budget.user_id == user.id, Budget.effective_from <= first)
            .order_by(Budget.category_id, Budget.effective_from.desc())
        )
    )


def get_budgets(db: Session, user: User, month: str) -> MonthBudgets:
    """The budgets in effect for `month` (`YYYY-MM`). Any month may be read."""
    first = _first_of(month, ["query", "month"])

    overall: BudgetOut | None = None
    by_category: dict[uuid.UUID, tuple[date, str]] = {}
    for b in _budgets_in_effect(db, user, first):
        if b.amount_minor is None:
            continue  # cleared from this month on
        if b.category_id is None:
            overall = BudgetOut(amount=format_taka(b.amount_minor), effective_from=b.effective_from)
        else:
            by_category[b.category_id] = (b.effective_from, format_taka(b.amount_minor))

    categories = db.scalars(
        select(Category)
        .where(Category.user_id == user.id, Category.id.in_(by_category))
        .order_by(Category.sort_order, Category.name)
    )
    return MonthBudgets(
        month=month,
        overall=overall,
        categories=[
            CategoryBudgetOut(
                category=BudgetCategory(
                    id=c.id, name=c.name, kind=c.kind, archived=c.archived_at is not None
                ),
                amount=by_category[c.id][1],
                effective_from=by_category[c.id][0],
            )
            for c in categories
        ],
    )


def set_budget(
    db: Session, user: User, month: str, category_id: uuid.UUID | None, amount: str | None
) -> MonthBudgets:
    """Set (`amount`) or clear (`None`) one budget from `month` onward; returns the month's budgets.

    `category_id=None` is the overall limit. `month` must run from the current month (in the
    user's time zone) to 12 months ahead, so a past month's budget never changes.
    """
    first = _first_of(month, ["body", "month"])
    errors = []

    this_month = _first_of(current_month(user), ["body", "month"])
    last_month = _add_months(this_month, MAX_MONTHS_AHEAD)
    if not this_month <= first <= last_month:
        errors.append(
            field_error(
                ["body", "month"],
                f"Month must be between {this_month:%Y-%m} and {last_month:%Y-%m}",
                "value_error",
            )
        )

    poisha: int | None = None
    if amount is not None:
        try:
            poisha = parse_taka(amount)
        except MoneyError as exc:
            errors.append(field_error(["body", "amount"], str(exc), "value_error"))

    if category_id is not None:
        category = db.scalar(
            select(Category).where(Category.id == category_id, Category.user_id == user.id)
        )
        loc: list[str | int] = ["body", "category_id"]
        if category is None:
            errors.append(field_error(loc, "Category not found", "not_found"))
        elif category.kind != CategoryKind.EXPENSE:
            errors.append(field_error(loc, "Only expense categories can have a budget", "kind"))
        elif category.archived_at is not None:
            errors.append(field_error(loc, "Category is archived", "archived"))

    if errors:
        raise UnprocessableError(errors)

    if poisha is None and not _has_budget(db, user, first, category_id):
        return get_budgets(db, user, month)  # clearing what isn't set is a no-op

    stmt = pg_insert(Budget).values(
        user_id=user.id, category_id=category_id, effective_from=first, amount_minor=poisha
    )
    db.execute(
        stmt.on_conflict_do_update(
            constraint="uq_budgets_user_category_effective_from",
            set_={"amount_minor": stmt.excluded.amount_minor, "updated_at": func.now()},
        )
    )
    db.flush()
    return get_budgets(db, user, month)


def _has_budget(db: Session, user: User, first: date, category_id: uuid.UUID | None) -> bool:
    return any(
        b.category_id == category_id and b.amount_minor is not None
        for b in _budgets_in_effect(db, user, first)
    )
