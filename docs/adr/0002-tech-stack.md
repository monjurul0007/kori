# 0002. Tech stack

- Status: Accepted
- Date: 2026-09-28
- Refs: M1-01, Project brief

## Context

Kori has four drivers:
- it must be useful every day on a phone
- it must look like production-quality work to a hiring manager
- it's the base for the owner's own AI engineering work, which is in Python
- hosting has to fit free tiers

The owner is strongest in backend and system design. Review time, at 2–4 PRs a week, is the real
bottleneck, so we prefer boring, well-documented technology.

## Decision

| Layer | Choice | Why |
|---|---|---|
| Language and tooling | Python 3.12, **uv** | The AI work is in Python. uv is fast and gives reproducible lockfiles |
| API | **FastAPI** | Typed, and generates OpenAPI (which drives both typed clients). Same framework as `kori-ai` |
| ORM and migrations | **SQLAlchemy 2.0 (sync) + psycopg 3**, **Alembic** | Mature and well documented. Synchronous code keeps transactions and tests simple, and performance doesn't matter for one user |
| Validation and config | **Pydantic v2**, pydantic-settings | The same idiom used later to validate LLM output |
| Auth | **argon2id** (argon2-cffi) plus a server-side **sessions** table | OWASP-recommended hashing, sessions can be revoked, and no vendor lock-in |
| Database | **Postgres 16 + pgvector + pg_trgm** | One database for app data and embeddings, and trigram search |
| CLI and logs | **Typer**; **structlog** (JSON logs with request IDs) | Admin commands, and logs that can be searched in production |
| Web | **React + TypeScript (strict) + Vite**, pnpm | Mainstream and fast. The app is behind a login, so it needs no server-side rendering |
| Data and forms | **TanStack Query**, React Router, react-hook-form + zod | Standard solutions for caching, routing and forms |
| UI | **Tailwind CSS + shadcn/ui** (Radix), lucide icons | Accessible components that live in the repo, and responsive by default |
| API client | **openapi-typescript + openapi-fetch** from a committed `openapi.json` | End-to-end types, with drift caught in CI |
| PWA | **vite-plugin-pwa** | An installable app shell without a native app |
| Tests | **pytest + httpx** against real Postgres; **Vitest + React Testing Library + MSW**; **Playwright** from M2 | Tests hit the real database engine instead of a lookalike |
| Lint and types | **ruff**, **mypy --strict**; **ESLint + Prettier**, `tsc` | Industry standard, and enforced in CI |
| Delivery | **Docker** multi-stage builds, **Compose**, **GitHub Actions**, **GHCR** | One command to run locally; free CI and registry for a public repo |
| Hosting | Free tiers, chosen by spike S2 (ADR-0005) | Costs about $0 |

## Alternatives considered

- **Django + DRF.**
  - For: less code for auth and admin.
  - Against: less natural for async streaming and for Pydantic-native tool schemas, and a weaker
    signal for AI-engineering roles.
- **Next.js full-stack.** It would mean two backends (TypeScript for the app, Python for the AI)
  for one developer.
- **Async SQLAlchemy.** It adds complexity (async sessions, event loops in tests) with no benefit
  at single-user scale. We can revisit it if streaming endpoints need it.
- **SQLite for tests.** It diverges from Postgres on constraints, triggers, enums and pgvector.
  Rejected.
- **Managed auth (Clerk or Supabase Auth).** It adds a vendor dependency and removes backend work
  that's worth showing.

## Consequences

- There are two languages: Python for the API and AI, and TypeScript for the web app. The committed
  OpenAPI spec keeps them in sync.
- CI needs Postgres, as a service container.
- The PWA avoids app-store overhead, but iOS limits apply. Spike S6 assesses them.
