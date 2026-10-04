import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from kori.common.enums import CategoryKind

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


class CategoryCreate(BaseModel):
    name: Name
    kind: CategoryKind
    icon: ShortText | None = None
    color: ShortText | None = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    """Only the fields that are sent change; `icon` and `color` may be set to null."""

    name: Name | None = None
    icon: ShortText | None = None
    color: ShortText | None = None
    sort_order: int | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    kind: CategoryKind
    icon: str | None
    color: str | None
    sort_order: int
    archived_at: datetime | None
