"""Report shapes. Field descriptions matter: M3 and M5 expose these models as AI tool schemas."""

import uuid
from datetime import date
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from kori.common.enums import CategoryKind, TransactionType

Month = Annotated[str, Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2026-11"])]
Taka = Annotated[str, Field(examples=["1250.50"])]
Percent = Annotated[str, Field(examples=["34.5"])]


class ReportCategory(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    kind: CategoryKind
    archived: bool = Field(description="Archived categories still appear in reports.")


class CategorySpending(BaseModel):
    category: ReportCategory
    amount: Taka = Field(description="Sum of this category's line amounts, in taka.")
    count: int = Field(description="Transactions with at least one line in this category.")
    percent: Percent = Field(description="Share of the report total, one decimal place.")


class SpendingReport(BaseModel):
    """Spending (or income) by category for an inclusive date range."""

    from_: date = Field(alias="from", description="First day, inclusive.")
    to: date = Field(description="Last day, inclusive.")
    type: TransactionType
    total: Taka = Field(description="Sum of every line in the range, in taka.")
    count: int = Field(description="Distinct transactions in the range.")
    by_category: list[CategorySpending] = Field(description="Largest amount first, then name.")

    model_config = ConfigDict(populate_by_name=True)


class Level(StrEnum):
    OK = "ok"
    WARNING = "warning"
    OVER = "over"


class LimitSource(StrEnum):
    SET = "set"
    SUM_OF_CATEGORIES = "sum_of_categories"


class CategoryBudgetStatus(BaseModel):
    category: ReportCategory
    limit: Taka = Field(description="The monthly budget in effect, in taka.")
    spent: Taka
    remaining: Taka = Field(description="limit - spent; negative when over budget.")
    percent: Percent = Field(description="spent / limit, one decimal place; may exceed 100.")
    level: Level = Field(description="ok below 80%, warning from 80% up to 100%, over from 100%.")


class OverallBudgetStatus(BaseModel):
    limit: Taka
    limit_source: LimitSource = Field(
        description="'set' for an explicit overall limit, else 'sum_of_categories'."
    )
    spent: Taka = Field(description="Every expense in the month, budgeted category or not.")
    remaining: Taka
    percent: Percent
    level: Level


class Unbudgeted(BaseModel):
    spent: Taka = Field(description="Expenses in categories that have no budget this month.")


class BudgetStatus(BaseModel):
    """Budget progress for one month."""

    month: Month
    days_in_month: int
    days_elapsed: int = Field(description="Today in the user's time zone; 0 for a future month.")
    days_left: int
    overall: OverallBudgetStatus | None = Field(
        description="Null when there is neither an overall limit nor any category budget."
    )
    categories: list[CategoryBudgetStatus] = Field(description="Categories with a budget.")
    unbudgeted: Unbudgeted


class TrendMonth(BaseModel):
    month: Month
    expense: Taka
    income: Taka


class Trend(BaseModel):
    """Monthly expense and income, oldest first, empty months as zero."""

    months: list[TrendMonth]
