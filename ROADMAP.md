# Roadmap

Kori is built in small milestones. The core app comes first, so it's useful every day. The AI
features then arrive in stages, each with measured quality.

**Status:** ✅ done · 🚧 in progress · ⏭️ next · 📋 planned

## Milestones

| # | Milestone | Goal | Status |
|---|---|---|---|
| M1 | **Log it, live** | Log real expenses on my phone in a deployed app: auth, transactions with splits and tags, a monthly list with totals, an installable PWA, seed data, CI/CD, and the `kori-ai` scaffold | 🚧 |
| M2 | **Plan it** | Monthly budgets, a dashboard, a reports API, a split editor, recurring transactions, PWA polish and E2E tests | ⏭️ |
| M3 | **AI seams** | Contract and auth between Kori and `kori-ai`, an AI proxy, insights storage, background hooks, and UI slots for the assistant, quick-add and confirmation cards | 📋 |
| M4 | **Natural-language entry** | "Spent 350 on lunch yesterday" becomes a proposed transaction you confirm, including Banglish input | 📋 |
| M5 | **Ask Kori** | Embeddings, semantic search and tool-based Q&A whose answers match SQL exactly | 📋 |
| M6 | **Agent with confirmed actions** | A LangGraph agent with persistent conversations that never writes without confirmation | 📋 |
| M7 | **Background intelligence** | Auto-categorization, monthly summaries and statistical anomaly alerts | 📋 |
| M8 | **Evals and tracing** | An evaluation suite including prompt-injection cases, tracing, and before/after results | 📋 |
| M9 | **Portfolio launch (v1.0)** | Polished docs, a demo, eval results, and a write-up | 📋 |
| M10 | **Platform** | Kubernetes (k3s and Helm), a self-hosted open model on vLLM, model routing, observability, receipt scanning | 📋 |
| M11 | **Data** | Statement import (bKash, Nagad, banks), merchant cleanup with embeddings, and my own categorization model | 📋 |

## How the AI arrives

- **Placeholders first (M3).** Interfaces, stub endpoints and UI slots are wired end to end before
  any model is called.
- **One capability per milestone (M4–M7).** Each one replaces a stub with real logic in
  [`kori-ai`](https://github.com/monjurul0007/kori-ai).
- **Measured, not guessed (M8).** Every number the AI states comes from SQL, and quality is
  tracked with evals.
- **Safe by design.** The AI acts only as the logged-in user and proposes changes, and nothing is
  written without confirmation. See [ADR-0003](docs/adr/0003-two-repo-split.md).

## Open research (spikes)

Before planning some milestones, a few questions need answers:
- free-tier hosting
- PWA capabilities on iOS and Android
- background jobs on hosts that scale to zero
- the Kori ↔ `kori-ai` contract
- LLM provider and cost caps
- statement formats

Each spike ends in an ADR under [docs/adr](docs/adr/README.md).

---

*Updated at the end of each milestone.*
