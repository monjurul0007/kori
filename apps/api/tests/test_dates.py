from datetime import date

import pytest

from kori.common.dates import month_bounds, resolve_date_range
from kori.common.errors import UnprocessableError


@pytest.mark.parametrize(
    ("month", "last_day"),
    [("2026-09", 30), ("2026-12", 31), ("2026-02", 28), ("2028-02", 29)],
)
def test_month_bounds(month: str, last_day: int) -> None:
    year, mon = int(month[:4]), int(month[5:])
    assert month_bounds(month) == (date(year, mon, 1), date(year, mon, last_day))


def test_resolve_date_range() -> None:
    d1, d2 = date(2026, 9, 1), date(2026, 9, 5)
    assert resolve_date_range("2026-09", None, None) == (d1, date(2026, 9, 30))
    assert resolve_date_range(None, d1, d2) == (d1, d2)
    assert resolve_date_range(None, d1, None) == (d1, None)
    assert resolve_date_range(None, None, None) == (None, None)


def test_resolve_date_range_rejects_mixing_and_reversed_ranges() -> None:
    d1, d2 = date(2026, 9, 1), date(2026, 9, 5)
    with pytest.raises(UnprocessableError):
        resolve_date_range("2026-09", d1, None)
    with pytest.raises(UnprocessableError):
        resolve_date_range(None, d2, d1)
