import re
import uuid
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field

_MAX_LENGTH = 30


def normalize_tag_name(raw: str) -> str:
    """Lowercase, trim, and collapse inner whitespace to `-`."""
    return re.sub(r"\s+", "-", raw.strip().lower())


def _validate(raw: str) -> str:
    name = normalize_tag_name(raw)
    if not 1 <= len(name) <= _MAX_LENGTH:
        raise ValueError(f"Tag names must be 1-{_MAX_LENGTH} characters")
    return name


TagName = Annotated[str, Field(max_length=200), AfterValidator(_validate)]


class TagUpdate(BaseModel):
    name: TagName


class TagOut(BaseModel):
    id: uuid.UUID
    name: str
    usage_count: int
