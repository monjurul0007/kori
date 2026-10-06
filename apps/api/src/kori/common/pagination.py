"""Opaque keyset cursors: base64url of the sort key `(occurred_on, created_at, id)`."""

import base64
import binascii
import uuid
from dataclasses import dataclass
from datetime import date, datetime


class InvalidCursorError(ValueError):
    """The cursor is not one this API issued."""


@dataclass(frozen=True)
class Cursor:
    occurred_on: date
    created_at: datetime
    id: uuid.UUID


def encode_cursor(cursor: Cursor) -> str:
    raw = f"{cursor.occurred_on.isoformat()}|{cursor.created_at.isoformat()}|{cursor.id}"
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_cursor(token: str) -> Cursor:
    try:
        raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4)).decode()
        occurred_on, created_at, id_ = raw.split("|")
        created = datetime.fromisoformat(created_at)
        if created.tzinfo is None:
            raise ValueError("created_at needs a time zone")
        return Cursor(date.fromisoformat(occurred_on), created, uuid.UUID(id_))
    except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
        raise InvalidCursorError("Invalid cursor") from exc
