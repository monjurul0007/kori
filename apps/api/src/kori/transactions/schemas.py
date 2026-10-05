import uuid
from datetime import date, datetime
from typing import Annotated, Self, cast

from pydantic import AfterValidator, BaseModel, Field, StringConstraints, model_validator

from kori.categories.models import Category
from kori.common.enums import CategoryKind, CategorySource, TransactionSource, TransactionType
from kori.common.money import MoneyError, parse_taka
from kori.tags.schemas import TagName

MAX_LINES = 20
MAX_TAGS = 10


def _validate_amount(raw: str) -> str:
    try:
        parse_taka(raw)
    except MoneyError as exc:
        raise ValueError(str(exc)) from exc
    return raw


# A decimal string in taka, e.g. "1250.50" (ADR-0004).
Taka = Annotated[str, Field(examples=["1250.50"]), AfterValidator(_validate_amount)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class LineIn(BaseModel):
    category_id: uuid.UUID
    amount: Taka


class TransactionIn(BaseModel):
    """Send either `category_id` (one line) or `lines` (a split), never both."""

    type: TransactionType
    amount: Taka
    occurred_on: date
    category_id: uuid.UUID | None = None
    lines: Annotated[list[LineIn], Field(min_length=1, max_length=MAX_LINES)] | None = None
    merchant: Annotated[Text, Field(max_length=120)] | None = None
    note: Annotated[Text, Field(max_length=500)] | None = None
    payment_method_id: uuid.UUID | None = None
    tags: list[TagName] = []

    @model_validator(mode="after")
    def _check(self) -> Self:
        if (self.category_id is None) == (self.lines is None):
            raise ValueError("Send exactly one of category_id or lines")
        if self.lines is not None:
            total = sum(parse_taka(line.amount) for line in self.lines)
            if total != parse_taka(self.amount):
                raise ValueError("The line amounts must add up to the transaction amount")
        # Tags are normalised by `TagName`, so duplicates collapse here.
        self.tags = list(dict.fromkeys(self.tags))
        if len(self.tags) > MAX_TAGS:
            raise ValueError(f"At most {MAX_TAGS} tags")
        return self

    def resolved_lines(self) -> list[LineIn]:
        """The `category_id` shorthand is a single line for the whole amount."""
        if self.lines is not None:
            return self.lines
        return [LineIn(category_id=cast(uuid.UUID, self.category_id), amount=self.amount)]


class PaymentMethodRef(BaseModel):
    id: uuid.UUID
    name: str


class CategoryRef(BaseModel):
    id: uuid.UUID
    name: str
    kind: CategoryKind


class LineOut(BaseModel):
    category: CategoryRef
    amount: str
    category_source: CategorySource


class TransactionOut(BaseModel):
    id: uuid.UUID
    type: TransactionType
    amount: str
    occurred_on: date
    merchant: str | None
    note: str | None
    payment_method: PaymentMethodRef | None
    lines: list[LineOut]
    tags: list[str]
    is_split: bool
    source: TransactionSource
    created_at: datetime
    updated_at: datetime


def category_ref(category: Category) -> CategoryRef:
    return CategoryRef(id=category.id, name=category.name, kind=category.kind)


class Totals(BaseModel):
    """Sums over the whole filtered set, not just the current page."""

    expense: str
    income: str
    count: int


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    next_cursor: str | None
    totals: Totals
