# Reports

Three read-only reports in `apps/api/src/kori/reports/`. They become the AI's `get_spending` and
`get_budget_status` tools in M5, so every number must equal the raw SQL below, down to the poisha.
All sums are integer poisha; amounts are formatted as taka strings at the edge. There are no floats.

Shared rules:

- **Spent** means the sum of `transaction_lines.amount_minor` of `expense` transactions, joined to
  `transactions` for the user, the type and `occurred_on`.
- **A split** counts toward each of its categories by its line amount.
- **Archived categories** still appear, flagged `archived`.
- **`percent`** is a string with one decimal (`"34.5"`), computed with integers and rounded half up.
- **`count`** is the number of distinct transactions; per category, those with a line in it.

## Spending: `GET /api/v1/reports/spending`

`month=YYYY-MM` (the default is the current month), or both `from` and `to` (inclusive);
`type=expense|income` (default `expense`). Returns the range, `total`, `count` and `by_category`
(largest amount first, then name). `total` equals `totals.expense` (or `income`) of the
transactions list for the same range.

```sql
SELECT l.category_id, sum(l.amount_minor), count(DISTINCT t.id)
FROM transaction_lines l JOIN transactions t ON t.id = l.transaction_id
WHERE t.user_id = :user AND t.type = 'expense'
  AND t.occurred_on BETWEEN :from AND :to
GROUP BY l.category_id;
```

## Budget status: `GET /api/v1/reports/budget-status`

`month=YYYY-MM` (default: the current month in the user's time zone). For each category with a
budget in effect (the latest row on or before the month, ADR-0007; a cleared budget is dropped):
`limit`, `spent`, `remaining` (negative when over), `percent` and `level`.

- **Level:** `ok` below 80%, `warning` from 80% up to 100%, `over` from 100%. The thresholds are
  constants in `reports/service.py` and are compared with integers (`spent * 100 >= limit * 80`).
- **Overall:** the overall limit if one is set (`limit_source: "set"`), otherwise the sum of the
  category budgets (`"sum_of_categories"`), otherwise `null`. Its `spent` counts **every** expense in
  the month, including categories with no budget.
- **Unbudgeted:** `unbudgeted.spent` is the spending in categories with no budget that month.
- **Days:** `days_elapsed` uses today in the user's time zone. A past month is fully elapsed and a
  future month has 0; `days_left = days_in_month - days_elapsed`.

The spent figure per category is the spending query above for the month's first and last day.

## Trend: `GET /api/v1/reports/trend`

`end=YYYY-MM` (default: the current month), `months` 1 to 24 (default 6), optional `category_id`
(another user's category is a 404). Returns `months` entries, oldest first, with empty months as
`"0.00"`. With `category_id`, only that category's lines are counted.

```sql
SELECT to_char(t.occurred_on, 'YYYY-MM'), t.type, sum(t.amount_minor)   -- without category_id
FROM transactions t
WHERE t.user_id = :user AND t.occurred_on BETWEEN :first_day AND :last_day
GROUP BY 1, 2;
-- with category_id: join transaction_lines l ON l.transaction_id = t.id AND l.category_id = :cat
-- and sum(l.amount_minor) instead.
```

## Performance

Each report runs a constant number of queries (at most 3), whatever the data size; a test counts
them for 10 and for 1,000 transactions. They use the existing
`(user_id, occurred_on …)` index on `transactions`, so no new index was added.
