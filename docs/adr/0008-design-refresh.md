# 0008. Design refresh: "Neel and Gada"

- Status: Accepted
- Date: 2026-11-24
- Refs: DR-01 (https://trello.com/c/2xF8ao1x)

## Context

The November 2026 UX audit found that the web app works but looks and feels like a default
template: green primary colour, no brand, inconsistent forms and feedback, and a layout that was
designed for desktop first. The owner approved a full refresh on 2026-11-24 that covers every
screen at desktop and phone size, in light and dark.

## Decision

- **Palette "Neel and Gada":** indigo brand (Neel, `#2F3A99`), marigold accent (Gada, `#F2A93B`),
  **no green anywhere**. Income is shown in indigo with a "+" sign; status is always shown in words
  as well as colour. Tokens live in `docs/design/tokens.css`.
- **Fonts:** Anek Bangla for display and Hind Siliguri for body. Both cover Bangla and Latin.
  Money uses tabular figures.
- **Logo:** "Coin K", a marigold coin with a K, in `docs/brand/`.
- **Responsive sheet pattern:** forms open in a right-hand panel at 768px and wider and a
  full-height sheet on phones, with Save always visible in a footer.
- **Theme switch:** light, dark or system, in Settings → General.
- **Feedback:** every save, change and delete ends with a toast that names the result, with Undo
  where it can be undone.
- **Delivery:** cards DR-01 to DR-18, one PR each. Approved mockups are in `docs/design/`;
  [docs/DESIGN.md](../DESIGN.md) is the written reference.

### Alternatives considered

- **Keep green.** Rejected: green reads as generic finance and clashes with the "over budget" and
  "income" semantics we want to separate.
- **Cowrie-shell mark** (from the name কড়ি). Rejected: hard to read at 16px.
- **Logos B and C.** B is kept in `docs/brand/` for reference only; neither was chosen.

## Consequences

- Every web card after DR-01 must follow DESIGN.md and the mockups. Behaviour fixed by the BUG
  cards stays.
- DR-02 converts the hex tokens to the HSL triplets used by `apps/web/src/index.css`.
- Fonts are loaded from the web (self-hosting is decided in DR-02).
- Mockup amounts are example data and must never be copied into fixtures as real data.
