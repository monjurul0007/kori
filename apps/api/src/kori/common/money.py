"""BDT amounts: decimal strings in taka at the API, integer poisha everywhere else (ADR-0004)."""

import re

# 1 taka = 100 poisha. Capped well below the BIGINT limit so that sums of lines can't overflow.
MAX_POISHA = 10**13

_TAKA = re.compile(r"([0-9]+)(?:\.([0-9]{1,2}))?")


class MoneyError(ValueError):
    """The text is not a valid positive taka amount."""


def parse_taka(text: str) -> int:
    """`"1250.50"` -> `125050`. Positive, at most 2 decimal places, digits only (no floats)."""
    if not isinstance(text, str):
        raise MoneyError("Amount must be a string such as '1250.50'")
    match = _TAKA.fullmatch(text)
    if match is None:
        raise MoneyError("Amount must be a positive number with at most 2 decimal places")
    taka, fraction = match.groups()
    poisha = int(taka) * 100 + int((fraction or "").ljust(2, "0"))
    if poisha <= 0:
        raise MoneyError("Amount must be greater than zero")
    if poisha > MAX_POISHA:
        raise MoneyError("Amount is too large")
    return poisha


def format_taka(poisha: int) -> str:
    """`125050` -> `"1250.50"`; always two decimal places."""
    taka, fraction = divmod(poisha, 100)
    return f"{taka}.{fraction:02d}"
