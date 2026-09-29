# 0004. Money and date representation

- Status: Accepted
- Date: 2026-09-28
- Refs: M1-05, M1-08, M1-11

## Context

Kori stores personal finances in BDT (৳). Money bugs are silent and corrosive, and floating-point
arithmetic can't represent 0.10 exactly. Amounts also cross three boundaries:
- the database
- the JSON API
- LLM tool calls (M5+), where a model misreading "50000 poisha" as ৳50,000 is a realistic failure

Dates matter too. A lunch at 00:30 on 1 October in Dhaka (UTC+6) happens on 30 September in UTC.
"This month" has to follow the user's calendar.

## Decision

**Money**

- **Database:** `amount_minor BIGINT` in **poisha** (1 taka = 100 poisha), with `CHECK (> 0)`. The
  direction is carried by `type` (expense or income), not by the sign. A `currency CHAR(3)` column
  is stored, and is always `BDT` for now.
- **API (JSON):** a **decimal string in taka** with at most 2 decimal places, e.g. `"1250.50"`.
  More precision is rejected with 422. Integer minor units never appear in the public API.
- **Python:** parse with `decimal.Decimal` and convert to integer poisha at the boundary
  (`common/money.py`). Floats are never used.
- **TypeScript:** keep amounts as strings until display. Format with lakh grouping, e.g.
  `৳12,50,000.50`, and hide `.00` on whole amounts.

**Dates and times**

- **`occurred_on DATE`:** the user's local calendar date (the time zone is stored per user, default
  `Asia/Dhaka`). "Today" and "this month" are computed in that time zone.
- **Audit timestamps** (`created_at`, `updated_at`, session times) are `TIMESTAMPTZ`, in UTC.
- **Months** are calendar months: the 1st to the last day.
- **Weeks** start on Saturday, for display only.

## Consequences

- There are no rounding errors, and totals are exact integer sums in SQL. Reports and evals can
  compare against SQL exactly.
- An LLM reads and writes human amounts ("500", "1250.50"), which removes a ×100 class of mistake.
- Every API boundary needs conversion helpers, and they're unit-tested in M1-08 and M1-11.
- Multi-currency later (see the Backlog) is additive: the original amount and currency get their
  own columns, and `amount_minor` stays the BDT actually charged.
- Changing a user's time zone doesn't rewrite historical `occurred_on` values. That's intended.
