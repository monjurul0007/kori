import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from kori.auth.deps import CurrentUser
from kori.budgets.service import current_month
from kori.common.dates import resolve_date_range
from kori.common.enums import TransactionType
from kori.common.errors import UnprocessableError, field_error
from kori.db.session import get_db
from kori.reports import service
from kori.reports.schemas import BudgetStatus, SpendingReport, Trend

router = APIRouter(prefix="/reports", tags=["reports"])

Db = Annotated[Session, Depends(get_db)]
MonthQuery = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2026-11"])


@router.get("/spending", response_model_by_alias=True)
def spending(
    user: CurrentUser,
    db: Db,
    month: Annotated[str | None, MonthQuery] = None,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    type: TransactionType = TransactionType.EXPENSE,
) -> SpendingReport:
    """Spending by category for a month, or for an inclusive `from`/`to` range."""
    if month is None and date_from is None and date_to is None:
        month = current_month(user)
    start, end = resolve_date_range(month, date_from, date_to)
    if start is None or end is None:
        raise UnprocessableError(
            [field_error(["query", "from"], "Send both from and to, or a month", "value_error")]
        )
    return service.get_spending(db, user, start, end, type)


@router.get("/budget-status")
def budget_status(
    user: CurrentUser, db: Db, month: Annotated[str | None, MonthQuery] = None
) -> BudgetStatus:
    """Budget progress for a month (default: the current month in the user's time zone)."""
    return service.get_budget_status(db, user, month or current_month(user))


@router.get("/trend")
def trend(
    user: CurrentUser,
    db: Db,
    end: Annotated[str | None, MonthQuery] = None,
    months: Annotated[int, Query(ge=1, le=24)] = 6,
    category_id: uuid.UUID | None = None,
) -> Trend:
    """Expense and income per month, oldest first, ending at `end` (default: this month)."""
    return service.get_trend(db, user, end or current_month(user), months, category_id)
