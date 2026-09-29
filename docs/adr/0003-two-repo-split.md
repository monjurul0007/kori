# 0003. Two repositories: `kori` and `kori-ai`

- Status: Accepted
- Date: 2026-09-28
- Refs: M1-01, M1-03, spike S1

## Context

Kori will gain three kinds of AI capability:
- answering questions about the user's data
- taking actions on the user's behalf
- background features: auto-categorization, insights and anomaly alerts

The owner builds these personally, as hands-on AI-engineering practice (M4–M8), and later runs
them as a separately deployed service, including on Kubernetes with a self-hosted model (M10). The
core app, by contrast, is written through small reviewed PRs and has to stay stable for daily use.

## Decision

- **`kori`** is a monorepo for the web app, the API, infrastructure and docs. It is the **only
  owner of financial data**.
- **`kori-ai`** is the AI service (FastAPI). It is **only a client of Kori's public API**:
  - It calls `/api/v1` **as the logged-in user**, with a short-lived, user-scoped token that Kori
    mints (the details come from spike S1, M3).
  - Its "tools" are typed API calls, generated from Kori's committed `openapi.json`.
  - It proposes writes. Kori applies them only after the user confirms in the UI.
- **The browser talks only to Kori.** AI endpoints are reached through Kori's `/api/v1/ai/*` proxy
  (M3), so auth stays in one place and there's one origin.

## Alternatives considered

- **A single monorepo with an AI package inside the API.**
  - For: simpler at first.
  - Against: it mixes the owner's experimental AI code with the reviewed core, and makes an
    independent deploy or runtime (vLLM, GPUs) harder later.
- **Three repos (web, api, ai).** Cross-repo PRs for every feature, and three CI pipelines, with no
  benefit for a single developer.

## Consequences

- **Security by construction.** The AI can never exceed the user's permissions, because the core
  API enforces scoping. Prompt injection in data (for example a transaction note) can't grant
  access to anything.
- **Versioned contract.** Changes to Kori's API must keep `kori-ai`'s generated client working.
  Drift is caught in CI with the committed `openapi.json`.
- **Local development** needs both services. From M3, Kori's Compose file runs the `kori-ai`
  image.
- **Some features take two PRs**, one per repo. That's accepted, because the boundary is stable
  and deliberate.
- **Where embeddings live** (Kori's database vs `kori-ai`'s) is still open and is decided in
  spike S1.
