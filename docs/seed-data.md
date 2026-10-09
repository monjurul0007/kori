# Demo seed data

`kori seed` fills a demo user with six months of fake, deterministic BDT spending. It is for local
development, README screenshots and, later, embeddings (M5), anomaly alerts (M7) and evals (M8).
It contains no real data.

## Running it

```bash
make seed   # = kori seed --email demo@kori.local --months 6 --seed 42 --reset
```

- The first run for a new email prompts for a password (twice, never an argument) and creates the
  user with the default categories and payment methods.
- `--reset` deletes that user's transactions first. Without it, a user who already has
  transactions is refused, so a second run can't double the data.
- `--months` is 5 to 24 and covers whole calendar months ending with the current one (the current
  month stops at today). Five is the minimum so the planted anomalies are fully in the past.
- With `KORI_ENV=production` the command refuses unless `--i-know-this-is-prod` is passed. It should
  never be needed.
- Rows are written through `create_transaction` with `source='seed'` and `category_source='seed'`.

## Determinism

`generate(rng, months, today)` in `src/kori/seed/generator.py` is a pure function. The only source
of randomness is `random.Random(seed)` and `today` is an argument, so the same seed, month count and
date always give the same list. Change the seed (`--seed`) for a different life, or edit the ranges
in `src/kori/seed/profiles.py` to match yours, then run `make seed` again.

## Patterns

Amounts are whole taka, rounded to a "price-like" step, and stay inside the range below.

| Profile | When | Amount (৳) | Category |
|---|---|---|---|
| Food | 1–3 a day | 60–450 | Food & Dining |
| Transport | 0–3 a day | 30–400 | Transport |
| Bazar | every Friday; a third are split ~70/30 with Shopping (household) | 1,500–4,500 | Groceries & Bazar |
| Rent | 1st | 25,000 | Rent |
| Electricity | 5th–10th | 1,200–2,500 | Utilities |
| Gas | 3rd | 1,080 | Utilities |
| Internet | 7th | 1,000 | Mobile & Internet |
| Mobile recharge | 2–4 a month | 100–500 | Mobile & Internet |
| Health | 40% of months | 300–3,000 | Health & Medicine |
| Family | 50% of months, always in the Eid month | 2,000–10,000 | Family & Gifts |
| Salary | 1st | 120,000 | Salary (income) |
| Freelance | 40% of months | 10,000–40,000 | Freelance (income) |

Merchants are realistic (Star Kabab, Shwapno, Pathao, Grameenphone, DESCO, Coffee World, ...) and
some notes are Banglish ("dupur er khabar"). Roughly 580 transactions are produced for six months.

Tags: `coxs-bazar-trip` on food and transport on three days of month 0 plus a hotel booking
(৳3,000–9,000), and `eid` on the Eid shopping below.

## Planted anomalies

Positions are fixed offsets from the first month of the window (month 0). Month 0 is the month
`months - 1` before the current one. The example column is for `--months 6` run on
2026-10-06, where month 0 is May 2026.

| # | What | Offset | Example |
|---|---|---|---|
| 1 | Food & Dining at 3× the median week: four "Kacchi Bhai" dawats, topped up so that the week's total is exactly 3× the median week | Tue, Thu, Fri and Sat of the week starting on the first Monday on or after day 8 of month 1 | 2026-06-09, 06-11, 06-12 and 06-13, ৳1,305 each; the week of Monday 2026-06-08 |
| 2 | One-off Health & Medicine expense, Square Hospital, ৳18,500 | Day 9 of month 2 | 2026-07-09 |
| 3 | Eid shopping (tag `eid`), ৳42,000 over 3 days: ৳15,000, ৳14,000 and ৳13,000 | Days 10, 11 and 12 of month 3 | 2026-08-10, 08-11 and 08-12 |

The food-spike top-up amount depends on the seed (it is computed from that run's median week), so
the ৳1,305 above is for seed 42.
