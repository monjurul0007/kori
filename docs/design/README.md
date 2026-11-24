# Kori design refresh: "Neel and Gada"

The approved design for the Kori refresh (owner approval 2026-11-24). It covers every screen at desktop and phone size, in light and dark. DR-01 put this folder in `docs/design/` and the logos in `docs/brand/`, so every later design-refresh card reads it from there. See [../DESIGN.md](../DESIGN.md) for the written design system.

| File | What it is |
|---|---|
| `concept.html` | The full concept page. Open it in a browser (it loads Anek Bangla and Hind Siliguri from Google Fonts). Each mockup is real HTML/CSS: search for its `aria-label` (e.g. `Desktop dashboard mockup`) to read exact spacing, sizes and colours. The `.mock` CSS block holds the light tokens; `[data-mock="dark"] .mock` holds the dark ones. |
| `tokens.css` | Every colour token (light and dark), plus type, radius and spacing notes. Source of truth for DR-02. |
| `../brand/kori-logo-coin-k.svg` | The chosen logo, "Coin K" (paths only). Source of truth for DR-03. |
| `../brand/kori-logo-coin-k-maskable.svg` | Full-bleed maskable variant; the mark sits inside the 80% safe zone. |
| `../brand/kori-logo-coin-k-mono.svg` | One-colour mark (`currentColor`) for small inline use. |
| `../brand/kori-logo-kori-coin-alt.svg` | Alternative direction B, kept for reference (not chosen). |
| `screens/*.png` | One image per screen, in light and dark (`-light.png`, `-dark.png`). |

## Screens and the cards that build them

| Screen | Desktop image | Phone image | Card |
|---|---|---|---|
| Log in | `desktop-01-log-in-*` | `phone-01-log-in-*` | DR-15 |
| Dashboard | `desktop-02-dashboard-*` | `phone-02-dashboard-*` | DR-09 (hero, totals, attention, recent), DR-10 (where it went, trend chart) |
| First run | none | `phone-03-first-run-*` | DR-16 |
| Transactions | `desktop-03-transactions-*` | `phone-04-transactions-*` | DR-11 |
| Add transaction | `desktop-04-add-transaction-*` | `phone-05-add-expense-*` | DR-07 (create), DR-08 (edit, delete, tags) |
| Budgets | `desktop-05-budgets-*` | `phone-06-budgets-*` | DR-12 |
| Settings: General | `desktop-06-settings-general-*` | `phone-07-settings-*` | DR-13 |
| Settings: Categories | `desktop-07-settings-categories-*` | `phone-08-categories-*` | DR-14 |
| Settings: Payment methods | `desktop-08-settings-payment-methods-*` | none (same row pattern as Categories) | DR-14 |
| Settings: Tags | `desktop-09-settings-tags-*` | `phone-09-tags-*` | DR-14 |
| Page not found | none | `phone-10-page-not-found-*` | DR-05 |
| Side nav, bottom tab bar, page headers | every desktop image (left side) | every phone image (bottom) | DR-05 |
| Month control | the pill in every page header | the pill on phone headers | DR-06 |
| Buttons, inputs, chips, status labels, toasts | `foundations-light.png`, `components-dark.png` | | DR-04 |
| Logo | `logo-options.png` | | DR-03 |

## Rules the mockups follow
- **No green anywhere.** Brand is indigo (Neel, `#2F3A99`); the accent is marigold (Gada, `#F2A93B`), used only for the logo coin, progress on the hero panel and near-limit bars, and never as text.
- **Income** is shown in brand indigo with a "+" sign. Expenses are plain ink.
- **Status** is shown with words as well as colour: "৳150 over", "৳800 left", "Fully used".
- **Forms:** right-hand panel at 768px and wider, full-height sheet on phones, with Save always visible in a footer.
- **Every save, change and delete** ends with a toast that names what happened, with Undo where it can be undone.
- **Touch targets:** at least 44px on phones.
- All amounts, merchants and dates in the mockups are **example data**. Never copy them into code or fixtures as if they were real.
