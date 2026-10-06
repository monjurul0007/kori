"""Pure, deterministic generation of demo transactions: a function of (rng, months, today).

Nothing here reads the clock or touches the database. Anomaly positions are fixed offsets from the
first month of the window, documented in docs/seed-data.md.
"""

import random
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import date, timedelta

from kori.seed.profiles import FOOD_PER_DAY, PROFILES, TRANSPORT_PER_DAY, Profile

MIN_MONTHS = 5  # the planted anomalies sit in months 1 to 3 and must be fully in the past
MAX_MONTHS = 24

TRIP_TAG = "coxs-bazar-trip"
EID_TAG = "eid"
INCOME_PROFILES = frozenset({"salary", "freelance"})

# Fixed offsets (month index from the start month, 0-based) and days of the planted events.
TRIP_MONTH, TRIP_DAYS = 0, (18, 19, 20)
FOOD_SPIKE_MONTH, FOOD_SPIKE_FROM_DAY = 1, 8  # the first Monday on or after this day
HEALTH_MONTH, HEALTH_DAY, HEALTH_POISHA = 2, 9, 18_500_00
EID_MONTH, EID_SHOPPING = 3, ((10, 15_000), (11, 14_000), (12, 13_000))  # (day, taka)


@dataclass(frozen=True)
class LineSpec:
    category: str
    amount: int  # poisha


@dataclass(frozen=True)
class TxSpec:
    occurred_on: date
    type: str  # "expense" or "income"
    amount: int  # poisha
    lines: tuple[LineSpec, ...]  # more than one line is a split
    merchant: str | None
    note: str | None
    payment_method: str
    tags: tuple[str, ...]
    profile: str  # key into PROFILES, or "anomaly-N" for a planted one
    anomaly: int | None = None  # 1, 2 or 3 for the planted anomalies


def add_months(first: date, n: int) -> date:
    index = first.year * 12 + first.month - 1 + n
    return date(index // 12, index % 12 + 1, 1)


def window_start(today: date, months: int) -> date:
    return add_months(today.replace(day=1), -(months - 1))


def _taka(rng: random.Random, p: Profile) -> int:
    """A random price in the profile's range, in poisha."""
    return rng.randrange(p.lo // p.step, p.hi // p.step + 1) * p.step * 100


def _spec(
    rng: random.Random, day: date, profile: str, amount: int | None = None, split: bool = False
) -> TxSpec:
    p = PROFILES[profile]
    merchant, note = rng.choice(p.merchants)
    total = _taka(rng, p) if amount is None else amount
    lines: tuple[LineSpec, ...] = (LineSpec(p.category, total),)
    if split:  # bazar and household things in one receipt
        household = (total * 3 // 10) // 100 * 100
        lines = (LineSpec(p.category, total - household), LineSpec("Shopping", household))
        note = "bazar ar household"
    return TxSpec(
        day,
        "income" if profile in INCOME_PROFILES else "expense",
        total,
        lines,
        merchant,
        note,
        rng.choice(p.methods),
        (),
        profile,
    )


def _days(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _monthly(rng: random.Random, first: date, index: int) -> list[tuple[date, str]]:
    """(day, profile) pairs for one month: the bills, salary and the occasional extras."""
    on = first.replace
    items = [(on(day=1), "rent"), (on(day=1), "salary"), (on(day=3), "gas")]
    items += [(on(day=7), "internet"), (on(day=rng.randint(5, 10)), "electricity")]
    items += [(on(day=rng.randint(1, 28)), "recharge") for _ in range(rng.randint(2, 4))]
    if rng.random() < 0.4:
        items.append((on(day=rng.randint(1, 28)), "health"))
    if rng.random() < 0.5 or index == EID_MONTH:
        items.append((on(day=rng.randint(1, 28)), "family"))
    if rng.random() < 0.4:
        items.append((on(day=rng.randint(1, 28)), "freelance"))
    return items


def _plant_trip(specs: list[TxSpec], rng: random.Random, start: date) -> list[TxSpec]:
    days = {add_months(start, TRIP_MONTH).replace(day=d) for d in TRIP_DAYS}
    tagged = [
        replace(s, tags=(TRIP_TAG,))
        if s.occurred_on in days and s.profile in ("food", "transport")
        else s
        for s in specs
    ]
    hotel = replace(_spec(rng, min(days), "trip_hotel"), tags=(TRIP_TAG,))
    return [*tagged, hotel]


def _plant_food_spike(specs: list[TxSpec], rng: random.Random, start: date) -> list[TxSpec]:
    """Anomaly 1: one week of Food & Dining at 3x the median week, topped up with dawats."""
    weeks: dict[date, int] = defaultdict(int)
    for s in specs:
        if s.profile == "food":
            weeks[s.occurred_on - timedelta(days=s.occurred_on.weekday())] += s.amount
    median = sorted(weeks.values())[len(weeks) // 2]
    first = add_months(start, FOOD_SPIKE_MONTH).replace(day=FOOD_SPIKE_FROM_DAY)
    monday = first + timedelta(days=(7 - first.weekday()) % 7)
    extra_total = max(3 * median - weeks[monday], median)
    share = extra_total // 4 // 100 * 100
    extra = []
    for i, offset in enumerate((1, 3, 4, 5)):  # Tue, Thu, Fri, Sat
        amount = share if i < 3 else extra_total - 3 * share
        s = _spec(rng, monday + timedelta(days=offset), "food", amount)
        extra.append(
            replace(s, merchant="Kacchi Bhai", note="dawat", profile="anomaly-1", anomaly=1)
        )
    return [*specs, *extra]


def _plant_one_offs(specs: list[TxSpec], rng: random.Random, start: date) -> list[TxSpec]:
    health_day = add_months(start, HEALTH_MONTH).replace(day=HEALTH_DAY)
    hospital = _spec(rng, health_day, "health", HEALTH_POISHA)
    extra = [
        replace(
            hospital,
            merchant="Square Hospital",
            note="dental surgery",
            profile="anomaly-2",
            anomaly=2,
        )
    ]
    eid = add_months(start, EID_MONTH)
    for day, taka in EID_SHOPPING:
        shop = rng.choice(("Aarong", "Bashundhara City", "Jamuna Future Park"))
        amount = taka * 100
        extra.append(
            TxSpec(
                eid.replace(day=day),
                "expense",
                amount,
                (LineSpec("Shopping", amount),),
                shop,
                "eid er kenakata",
                "Card",
                (EID_TAG,),
                "anomaly-3",
                3,
            )
        )
    return [*specs, *extra]


def generate(rng: random.Random, months: int, today: date) -> list[TxSpec]:
    """Transactions for the `months` calendar months ending with the month of `today`."""
    if not MIN_MONTHS <= months <= MAX_MONTHS:
        raise ValueError(f"months must be between {MIN_MONTHS} and {MAX_MONTHS}")
    start = window_start(today, months)
    specs: list[TxSpec] = []
    for day in _days(start, today):
        for _ in range(rng.choice(FOOD_PER_DAY)):
            specs.append(_spec(rng, day, "food"))
        for _ in range(rng.choice(TRANSPORT_PER_DAY)):
            specs.append(_spec(rng, day, "transport"))
        if day.weekday() == 4:  # Friday bazar; every third one is a split
            specs.append(_spec(rng, day, "bazar", split=rng.random() < 1 / 3))
    for index in range(months):
        for day, profile in _monthly(rng, add_months(start, index), index):
            if day <= today:
                specs.append(_spec(rng, day, profile))
    specs = _plant_trip(specs, rng, start)
    specs = _plant_food_spike(specs, rng, start)
    specs = _plant_one_offs(specs, rng, start)
    return sorted(specs, key=lambda s: s.occurred_on)  # stable: ties keep generation order
