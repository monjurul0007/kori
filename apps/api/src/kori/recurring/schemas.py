import uuid
from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Any, Self

from pydantic import BaseModel, Field, model_validator

from kori.common.enums import RecurrenceFrequency, TransactionType
from kori.transactions.schemas import CategoryRef, PaymentMethodRef, Taka, Text

Name = Annotated[Text, Field(max_length=60, examples=["Rent"])]
Interval = Annotated[int, Field(ge=1, le=12, description="Every N weeks, months or years")]


class RuleStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    ENDED = "ended"


class RuleIn(BaseModel):
    """`start_on` anchors the schedule: its weekday (weekly), day of month (monthly) or day and
    month (yearly). Creating a rule never adds transactions for dates before today."""

    name: Name
    type: TransactionType
    amount: Taka
    category_id: uuid.UUID
    payment_method_id: uuid.UUID | None = None
    merchant: Annotated[Text, Field(max_length=120)] | None = None
    note: Annotated[Text, Field(max_length=500)] | None = None
    frequency: RecurrenceFrequency
    interval: Interval = 1
    start_on: date
    end_on: date | None = None

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.end_on is not None and self.end_on < self.start_on:
            raise ValueError("end_on must not be before start_on")
        return self


# Fields that PATCH may set to null (clear). Everything else must keep a value.
NULLABLE_ON_UPDATE = frozenset({"payment_method_id", "merchant", "note", "end_on"})


class RuleUpdate(BaseModel):
    """Send only the fields to change. The type of a rule can't change.

    Name, amount, category, payment method, merchant, note and `end_on` apply to future occurrences
    only. Changing `frequency`, `interval` or `start_on` recomputes the next due date from today.
    """

    name: Name | None = None
    amount: Taka | None = None
    category_id: uuid.UUID | None = None
    payment_method_id: uuid.UUID | None = None
    merchant: Annotated[Text, Field(max_length=120)] | None = None
    note: Annotated[Text, Field(max_length=500)] | None = None
    frequency: RecurrenceFrequency | None = None
    interval: Interval | None = None
    start_on: date | None = None
    end_on: date | None = None

    @model_validator(mode="before")
    @classmethod
    def _no_nulls(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key, value in data.items():
                if value is None and key in cls.model_fields and key not in NULLABLE_ON_UPDATE:
                    raise ValueError(f"{key} cannot be null")
        return data


class RuleOut(BaseModel):
    id: uuid.UUID
    name: str
    type: TransactionType
    amount: str
    category: CategoryRef
    payment_method: PaymentMethodRef | None
    merchant: str | None
    note: str | None
    frequency: RecurrenceFrequency
    interval: int
    start_on: date
    end_on: date | None
    next_due_on: date | None
    status: RuleStatus
    # The next 3 occurrences from today (none once the rule has ended).
    upcoming: list[date]
    last_error: str | None
    paused_at: datetime | None
    created_at: datetime
    updated_at: datetime
