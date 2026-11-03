from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from kori.auth.deps import CurrentUser
from kori.budgets import service
from kori.budgets.schemas import BudgetSet, MonthBudgets
from kori.db.session import get_db

router = APIRouter(prefix="/budgets", tags=["budgets"])

Db = Annotated[Session, Depends(get_db)]


@router.get("")
def get_budgets(
    user: CurrentUser,
    db: Db,
    month: Annotated[
        str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2026-11"])
    ] = None,
) -> MonthBudgets:
    """The budgets in effect for a month (default: the current month in the user's time zone)."""
    return service.get_budgets(db, user, month or service.current_month(user))


@router.put("")
def put_budget(body: BudgetSet, user: CurrentUser, db: Db) -> MonthBudgets:
    """Set or clear one budget from a month onward. Returns that month's budgets."""
    return service.set_budget(db, user, body.month, body.category_id, body.amount)
