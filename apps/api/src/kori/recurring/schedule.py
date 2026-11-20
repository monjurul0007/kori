"""When a recurring rule falls due. Pure functions: no database, no clock (ADR-0004 local dates).

The k-th occurrence is always computed from the anchor `start_on`, never from the previous
occurrence. So a monthly rule on the 31st falls on Apr 30, then returns to May 31, and a yearly rule
on Feb 29 falls on Feb 28 in non-leap years and on Feb 29 again in leap years.
"""

import calendar
from collections.abc import Iterator
from datetime import date, timedelta
from typing import Protocol

from kori.common.enums import RecurrenceFrequency


class Schedule(Protocol):
    """What the schedule needs from a rule (a `RecurringRule` satisfies this)."""

    @property
    def frequency(self) -> RecurrenceFrequency: ...
    @property
    def interval(self) -> int: ...
    @property
    def start_on(self) -> date: ...
    @property
    def end_on(self) -> date | None: ...


def _clamped(year: int, month: int, day: int) -> date:
    return date(year, month, min(day, calendar.monthrange(year, month)[1]))


def _nth(rule: Schedule, k: int) -> date:
    """The k-th occurrence (k = 0 is `start_on`), ignoring `end_on`."""
    start = rule.start_on
    steps = k * rule.interval
    match rule.frequency:
        case RecurrenceFrequency.WEEKLY:
            return start + timedelta(weeks=steps)
        case RecurrenceFrequency.MONTHLY:
            index = start.year * 12 + start.month - 1 + steps
            return _clamped(index // 12, index % 12 + 1, start.day)
        case RecurrenceFrequency.YEARLY:
            return _clamped(start.year + steps, start.month, start.day)


def _first_index_on_or_after(rule: Schedule, d: date) -> int:
    """The smallest k with `_nth(rule, k) >= d`."""
    if d <= rule.start_on:
        return 0
    start = rule.start_on
    match rule.frequency:
        case RecurrenceFrequency.WEEKLY:
            estimate = (d - start).days // (7 * rule.interval)
        case RecurrenceFrequency.MONTHLY:
            estimate = ((d.year - start.year) * 12 + d.month - start.month) // rule.interval
        case RecurrenceFrequency.YEARLY:
            estimate = (d.year - start.year) // rule.interval
    # The estimate can be one or two steps early (clamping pulls dates earlier); walk forward.
    k = max(0, estimate - 1)
    while _nth(rule, k) < d:
        k += 1
    return k


def occurrences(rule: Schedule, from_date: date, to_date: date) -> list[date]:
    """Every occurrence in `[from_date, to_date]`, inclusive, never past `end_on`."""
    return list(_iter_from(rule, from_date, to_date))


def next_on_or_after(rule: Schedule, d: date) -> date | None:
    """The first occurrence on or after `d`, or None if the rule has ended by then."""
    k = _first_index_on_or_after(rule, d)
    result = _nth(rule, k)
    if rule.end_on is not None and result > rule.end_on:
        return None
    return result


def upcoming(rule: Schedule, from_date: date, count: int) -> list[date]:
    """The next `count` occurrences on or after `from_date`."""
    found: list[date] = []
    k = _first_index_on_or_after(rule, from_date)
    while len(found) < count:
        d = _nth(rule, k)
        if rule.end_on is not None and d > rule.end_on:
            break
        found.append(d)
        k += 1
    return found


def _iter_from(rule: Schedule, from_date: date, to_date: date) -> Iterator[date]:
    if to_date < from_date:
        return
    k = _first_index_on_or_after(rule, from_date)
    while (d := _nth(rule, k)) <= to_date:
        if rule.end_on is not None and d > rule.end_on:
            return
        yield d
        k += 1
