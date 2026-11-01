import uuid
from datetime import date
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from kori.common.enums import CategoryKind
from kori.transactions.schemas import Taka

# `YYYY-MM`, as in the transactions list.
MonthStr = Annotated[str, Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2026-11"])]


class BudgetSet(BaseModel):
    """Set or clear one budget from `month` onward.

    `category_id: null` is the overall limit; `amount: null` clears the budget.
    """

    month: MonthStr
    category_id: uuid.UUID | None
    amount: Taka | None


class BudgetCategory(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    kind: CategoryKind
    archived: bool


class BudgetOut(BaseModel):
    amount: str
    # The 1st of the month the budget was last set, so the UI can say "since Oct 2026".
    effective_from: date


class CategoryBudgetOut(BudgetOut):
    category: BudgetCategory


class MonthBudgets(BaseModel):
    month: MonthStr
    overall: BudgetOut | None
    categories: list[CategoryBudgetOut]
