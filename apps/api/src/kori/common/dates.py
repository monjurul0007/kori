"""Date-range query parameters: a calendar month, or an inclusive from/to (ADR-0004)."""

import calendar
from datetime import date

from kori.common.errors import UnprocessableError, field_error


def month_bounds(month: str) -> tuple[date, date]:
    """`"2026-09"` -> `(2026-09-01, 2026-09-30)`, both inclusive."""
    year, mon = int(month[:4]), int(month[5:])
    return date(year, mon, 1), date(year, mon, calendar.monthrange(year, mon)[1])


def resolve_date_range(
    month: str | None, date_from: date | None, date_to: date | None
) -> tuple[date | None, date | None]:
    """Either `month` or `from`/`to` (inclusive, each optional), never both."""
    if month is not None and (date_from is not None or date_to is not None):
        raise UnprocessableError(
            [field_error(["query", "month"], "Use month or from/to, not both", "value_error")]
        )
    if month is not None:
        return month_bounds(month)
    if date_from is not None and date_to is not None and date_from > date_to:
        raise UnprocessableError(
            [field_error(["query", "from"], "from must not be after to", "value_error")]
        )
    return date_from, date_to
