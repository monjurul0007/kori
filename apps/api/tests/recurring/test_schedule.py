from dataclasses import dataclass
from datetime import date

import pytest

from kori.common.enums import RecurrenceFrequency as F
from kori.recurring.schedule import next_on_or_after, occurrences, upcoming


@dataclass
class Rule:
    frequency: F
    start_on: date
    interval: int = 1
    end_on: date | None = None


def d(s: str) -> date:
    return date.fromisoformat(s)


def test_monthly_on_the_31st_clamps_and_returns_to_the_31st() -> None:
    rule = Rule(F.MONTHLY, d("2027-01-31"))
    got = occurrences(rule, d("2027-01-01"), d("2027-06-30"))
    # Feb 2027 is not a leap year; Apr and Jun have 30 days; May goes back to the 31st.
    assert got == [
        d("2027-01-31"),
        d("2027-02-28"),
        d("2027-03-31"),
        d("2027-04-30"),
        d("2027-05-31"),
        d("2027-06-30"),
    ]


def test_monthly_on_the_31st_in_a_leap_year() -> None:
    rule = Rule(F.MONTHLY, d("2028-01-31"))
    assert occurrences(rule, d("2028-02-01"), d("2028-03-31")) == [d("2028-02-29"), d("2028-03-31")]


def test_monthly_clamping_never_drifts() -> None:
    # Anchored on the 30th: Feb 28, then Mar 30 (not Mar 28).
    rule = Rule(F.MONTHLY, d("2027-01-30"))
    assert occurrences(rule, d("2027-02-01"), d("2027-03-31")) == [d("2027-02-28"), d("2027-03-30")]


def test_monthly_every_two_months_across_a_year_end() -> None:
    rule = Rule(F.MONTHLY, d("2026-11-10"), interval=2)
    assert occurrences(rule, d("2026-11-01"), d("2027-06-30")) == [
        d("2026-11-10"),
        d("2027-01-10"),
        d("2027-03-10"),
        d("2027-05-10"),
    ]


def test_yearly_on_feb_29() -> None:
    rule = Rule(F.YEARLY, d("2028-02-29"))
    assert occurrences(rule, d("2028-01-01"), d("2032-12-31")) == [
        d("2028-02-29"),
        d("2029-02-28"),
        d("2030-02-28"),
        d("2031-02-28"),
        d("2032-02-29"),
    ]


def test_yearly_every_two_years() -> None:
    rule = Rule(F.YEARLY, d("2026-03-05"), interval=2)
    assert upcoming(rule, d("2026-04-01"), 2) == [d("2028-03-05"), d("2030-03-05")]


def test_every_two_weeks_across_december_into_january() -> None:
    rule = Rule(F.WEEKLY, d("2026-12-04"), interval=2)  # a Friday
    got = occurrences(rule, d("2026-12-01"), d("2027-01-31"))
    assert got == [
        d("2026-12-04"),
        d("2026-12-18"),
        d("2027-01-01"),
        d("2027-01-15"),
        d("2027-01-29"),
    ]
    assert {x.weekday() for x in got} == {4}


def test_weekly_keeps_the_weekday_far_from_the_anchor() -> None:
    rule = Rule(F.WEEKLY, d("2026-01-05"))  # a Monday
    assert next_on_or_after(rule, d("2030-06-12")).weekday() == 0  # type: ignore[union-attr]


def test_end_on_stops_the_occurrences_and_is_inclusive() -> None:
    rule = Rule(F.MONTHLY, d("2026-11-01"), end_on=d("2027-02-01"))
    assert occurrences(rule, d("2026-01-01"), d("2030-01-01")) == [
        d("2026-11-01"),
        d("2026-12-01"),
        d("2027-01-01"),
        d("2027-02-01"),
    ]
    assert next_on_or_after(rule, d("2027-02-02")) is None
    assert upcoming(rule, d("2027-01-15"), 3) == [d("2027-02-01")]


@pytest.mark.parametrize(
    ("rule", "day", "expected"),
    [
        (Rule(F.MONTHLY, d("2026-11-10")), "2026-11-10", "2026-11-10"),  # on the day counts
        (Rule(F.MONTHLY, d("2026-11-10")), "2026-11-11", "2026-12-10"),
        (Rule(F.MONTHLY, d("2026-11-10")), "2026-01-01", "2026-11-10"),  # before the start
        (Rule(F.MONTHLY, d("2026-01-31")), "2027-02-01", "2027-02-28"),
        (Rule(F.WEEKLY, d("2026-11-02")), "2026-11-03", "2026-11-09"),
        (Rule(F.YEARLY, d("2026-12-25")), "2027-12-26", "2028-12-25"),
    ],
)
def test_next_on_or_after(rule: Rule, day: str, expected: str) -> None:
    assert next_on_or_after(rule, d(day)) == d(expected)


def test_next_on_or_after_matches_a_brute_force_scan() -> None:
    rules = [
        Rule(F.MONTHLY, d("2024-01-31"), interval=3),
        Rule(F.MONTHLY, d("2023-12-29")),
        Rule(F.YEARLY, d("2020-02-29"), interval=1),
        Rule(F.WEEKLY, d("2025-03-03"), interval=5),
    ]
    for rule in rules:
        every = occurrences(rule, d("2020-01-01"), d("2031-12-31"))
        day = d("2026-01-01")
        while day < d("2028-01-01"):
            assert next_on_or_after(rule, day) == next(x for x in every if x >= day)
            day = date.fromordinal(day.toordinal() + 3)


def test_an_empty_or_reversed_range_has_no_occurrences() -> None:
    rule = Rule(F.WEEKLY, d("2026-11-02"))
    assert occurrences(rule, d("2026-12-01"), d("2026-11-01")) == []
    assert occurrences(rule, d("2026-11-03"), d("2026-11-08")) == []
