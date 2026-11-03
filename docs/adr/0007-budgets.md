# 0007. Budgets: carry-forward model

- Status: Accepted
- Date: 2026-11-01
- Refs: M2-01 (https://trello.com/c/yNWfGVoY), M2 (https://trello.com/c/jDreH7Jg)

## Context

Kori needs monthly budgets per expense category, plus an optional overall limit. They are standing
budgets: you set them once and they repeat until you change them. Reports (M2-02) compare spending
with the budget in effect for a month, and the AI will later set budgets through a `set_budget` tool
(M5). That makes three things matter:
- the stored shape has to be simple to reason about
- an old month's budget status must not change when you edit today's budget
- the write contract has to be precise enough for a model to call

## Decision

**Carry-forward rows, not a row per month.** The `budgets` table stores one row each time a budget
is set: `(user_id, category_id, effective_from, amount_minor)`, where `effective_from` is the 1st of
a month. The budget in effect for month M is, per category, the row with the latest `effective_from`
on or before the 1st of M. One `DISTINCT ON (category_id)` query in `budgets/service.py` implements
this, and M2-02 reuses it.

**Clearing keeps history.** `amount_minor` is nullable. A NULL row means "no budget from this month
on". We never delete rows, so earlier months keep their budget. Clearing a budget that isn't in
effect is a no-op and writes no row, so the table never fills with empty markers.

**The overall limit is its own slot.** `category_id IS NULL` is the overall limit. It is set
separately, optional, and not the sum of the category budgets. The unique constraint on
`(user_id, category_id, effective_from)` is `NULLS NOT DISTINCT` (Postgres 15+), so the overall slot
also has one row per month. A plain unique constraint would allow duplicates, because NULLs differ.

**Past months are read-only.** `set_budget` accepts months from the current month in the user's
time zone up to 12 months ahead, and returns 422 otherwise. A past month's budget therefore never
changes, so its budget status (M2-02) is stable. You can read any month.

**Write rules.** The category must belong to the user (another user's is 422, not 404, as in
transactions), be an expense category and not be archived. Amounts follow `parse_taka` (ADR-0004).
Setting the same month twice updates the row with `INSERT … ON CONFLICT DO UPDATE`. The service
functions `get_budgets(db, user, month)` and `set_budget(db, user, month, category_id, amount)` use
plain, typed arguments, so they can become AI tools unchanged.

**The database backs the invariants:** `effective_from` must be the 1st of a month, and `amount_minor`
must be NULL or positive. `category_id` is `ON DELETE RESTRICT`, as for transaction lines.

## Consequences

- Changing next month's budget never touches this month's. Reports for the past stay correct.
- The table stays small: one row per change, not per month.
- You can't fix a budget retroactively. If that proves annoying, we can allow the previous month in
  a new ADR. Rollover and savings goals (Backlog) would need their own tables.
- An archived category keeps its budget row, and it is still listed (marked `archived`) while a budget
  is in effect. Archiving doesn't clear the budget, because clearing on archive would be a hidden write.
- Income has no budgets.
