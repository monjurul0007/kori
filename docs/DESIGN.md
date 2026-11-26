# Kori design system: "Neel and Gada"

The reference for any web UI change. The approved mockups are in [docs/design/](design/README.md)
(read `concept.html` for exact CSS, `screens/*.png` for each screen, light and dark). Logos are in
[docs/brand/](brand/). The decision is [ADR-0008](adr/0008-design-refresh.md). Hex values below are
copied from [design/tokens.css](design/tokens.css), which is the source of truth.

**Note:** the screenshots in `docs/design/screens/` are temporary. Clear them up (delete them) when the design refresh is done; see [design/README.md](design/README.md).

Mockup amounts, merchants and dates are **example data**, never fixtures.

## Colour tokens

No green anywhere. Marigold (`--accent`) is never used as text.

| Token                                 | Light                           | Dark                            | Use                                       |
| ------------------------------------- | ------------------------------- | ------------------------------- | ----------------------------------------- |
| `--paper`                             | `#F5F6FA`                       | `#0E1022`                       | Page ground                               |
| `--surface`                           | `#FFFFFF`                       | `#161936`                       | Cards, sheets, inputs                     |
| `--ink`                               | `#161A33`                       | `#E8E9F5`                       | Text                                      |
| `--muted`                             | `#5A5F78`                       | `#A3A7C2`                       | Secondary text                            |
| `--line`                              | `#DFE1EC`                       | `#2A2E52`                       | Borders, dividers                         |
| `--track`                             | `#E9EBF3`                       | `#23274A`                       | Progress-bar track                        |
| `--brand`                             | `#2F3A99`                       | `#8F9BFF`                       | Primary actions, active nav, links        |
| `--brand-strong`                      | `#232C7A`                       | `#6F7CF0`                       | Hover, pressed                            |
| `--brand-soft`                        | `#E8EAF8`                       | `#23285A`                       | Selected chips, active nav background     |
| `--on-brand`                          | `#FFFFFF`                       | `#0E1022`                       | Text on `--brand`                         |
| `--brand-text`                        | `#2F3A99`                       | `#B3BBFF`                       | Brand-coloured text                       |
| `--hero`, `--hero-fg`, `--hero-muted` | `#2F3A99`, `#FFFFFF`, `#C9CEF5` | `#1C2152`, `#E8E9F5`, `#A9B0E8` | "Left to spend" panel, login panel        |
| `--accent`                            | `#F2A93B`                       | `#F5B04C`                       | Logo coin, hero progress, near-limit bars |
| `--income`                            | `#2F3A99`                       | `#B3BBFF`                       | Income figures, always with "+"           |
| `--over`                              | `#B3261E`                       | `#F28B82`                       | Over budget, errors, destructive          |
| `--warn`                              | `#8A5A00`                       | `#F2B84B`                       | Near-limit text                           |
| `--scrim`                             | `rgba(22,26,51,.45)`            | `rgba(0,0,0,.6)`                | Behind sheets                             |

Category colours (charts and tiles) are in `tokens.css` (`--cat-*`). Status is always shown in
words as well as colour: "৳150 over", "৳800 left", "Fully used".

## Type

- Display: **Anek Bangla** (variable width 75–125, weight 300–800). Body: **Hind Siliguri**
  (400, 500, 600, 700).
- Scale (px): display 46 (width 122, weight 680), title 24 (650), section 14–16 (600), body 15,
  small 12.
- Money and any column of figures use `font-variant-numeric: tabular-nums`.
- Mark Bangla text with `lang="bn"`.

## Spacing, radius, elevation

- 4px base. Card padding 16×18. Page padding 22×28 on desktop, 14×13 on phone.
- Radius: cards 16, inputs and buttons 11, chips 999.
- Elevation is subtle: cards use a 1px border and at most `0 1px 2px` shadow. Sheets and menus use
  a soft large shadow plus `--scrim`. Focus ring is a 3px brand ring at about 22% opacity.

## Motion

- 150 ms for feedback (hover, press, colour changes). 220 ms for sheets and toasts.
- Respect `prefers-reduced-motion`: drop movement and keep opacity changes.

## Theming

- Dark tokens apply under the `.dark` class on `<html>` (Tailwind `darkMode: "class"`); there is no `prefers-color-scheme` CSS.
- The choice (`system`, `light` or `dark`) is in `localStorage` under `kori.theme`; `useTheme` in `src/lib/theme.ts` reads it, follows the OS live for `system`, and updates `<meta name="theme-color">`.
- A small inline script in `apps/web/index.html` sets the class before first paint, so there is no flash. It repeats the key and colours from `theme.ts`; `theme.test.tsx` runs it to keep them in step.
- No CSP exists yet. When one is added, the inline script needs a hash or nonce.

## Touch targets

At least 44×44px on phones, including close buttons, tag remove and links in lists.

## Copy voice

- Sentence case everywhere. Plain words; no jargon.
- Toasts name the result: "Saved ৳320 to Food", "Deleted. Undo".
- Errors say what to do: "Enter an amount like 250 or 250.50", not "Invalid input".

## Components

| Component                             | Status                                          | Notes                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buttons, inputs, chips, status labels | partly built (DR-02); restyle in each page card | See `foundations-light.png`, `components-dark.png`                                                                                                |
| FormSheet                             | built (DR-04)                                   | `components/ui/form-sheet.tsx`. Right panel at ≥768px, full-height sheet on phones, Save in a fixed footer, "Discard changes?" guard when `dirty` |
| Field                                 | built (DR-04)                                   | `components/ui/field.tsx`. Render prop hands `id`, `aria-invalid` and `aria-describedby` to the control                                           |
| IconButton, RemovableChip             | built (DR-04)                                   | `icon-button.tsx` (44px on touch, `aria-label` required), `removable-chip.tsx` (32px remove button)                                               |
| Money                                 | built (DR-04)                                   | `money.tsx`. Decimal-string in, tabular figures, "+" for income, never floats                                                                     |
| EmptyState                            | built (DR-04)                                   | `empty-state.tsx`. Variants empty, no-results, error                                                                                              |
| MonthPicker                           | planned in DR-06                                | Accessible month control in the page header                                                                                                       |
| Toasts                                | built (DR-04)                                   | `toastSuccess(message, { undo })` in `lib/toast.ts`                                                                                               |
| Form errors                           | built (DR-04)                                   | `problemFieldErrors` (`lib/problem.ts`) maps 422s to fields; `moneyAmount` (`lib/moneySchema.ts`) validates amounts                               |

## Patterns

- **Forms:** one sheet pattern for create and edit. Save is always visible. Inline field errors.
  Warn before discarding unsaved changes.
- **Feedback:** every save, change and delete ends with a toast. Destructive actions ask first or
  offer Undo.
- **Lists you manage** (categories, payment methods, tags): one row pattern with add, rename,
  archive.
- **Empty states:** a short explanation plus one clear action. First run uses a checklist.
- **Navigation:** side nav on desktop, bottom tab bar on phones, page header with the month pill.
  Unknown URLs show a real "Page not found" page.
