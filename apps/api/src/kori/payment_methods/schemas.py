import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from kori.common.enums import PaymentMethodKind

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class PaymentMethodCreate(BaseModel):
    name: Name
    kind: PaymentMethodKind
    sort_order: int = 0


class PaymentMethodUpdate(BaseModel):
    """Only the fields that are sent change."""

    name: Name | None = None
    kind: PaymentMethodKind | None = None
    sort_order: int | None = None


class PaymentMethodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    kind: PaymentMethodKind
    sort_order: int
    archived_at: datetime | None
