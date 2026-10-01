# AGENTS.md: working agreement for AI coding agents

Read this file first in every session. It is the one set of rules for every AI coding agent
(Claude Code, Codex, Cursor, Copilot, Gemini CLI and others). Tool-specific files such as
[`CLAUDE.md`](CLAUDE.md) only point here.

Each task runs in a **fresh session** with no memory of earlier ones. This file, the Trello card
and the docs it links to are your only context.

## The project in one paragraph

Kori (কড়ি) is a personal expense and budget app for one user in Dhaka, paid in BDT.
- It's a web app you can install on a phone (a PWA).
- It will gain AI features in stages. Those live in the separate `kori-ai` repo.
- The owner (Monjurul) reviews every PR and builds the AI features in M4–M8.
- An AI coding agent (currently Claude Code) writes the core app. Claude Cowork does project
  management only.

## Where things are

- **Backlog:** the Trello board "Kori", https://trello.com/b/yYbrEc3C/kori
  - Lists: `📌 Start here` · `Backlog` · `Spikes` · `Future Milestones` · `Milestone 1 · Log it, live` · `In Review` · `Done`
  - Reference cards: How we work (https://trello.com/c/h4Mm3VqB) and the Project brief
    (https://trello.com/c/bcmnXqx0)
- **This repo (`kori`):**
  - `apps/api` (FastAPI, from M1-02)
  - `apps/web` (React, from M1-11)
  - `infra/`
  - `docs/`
- **AI service:** https://github.com/monjurul0007/kori-ai
- **Read before coding:**
  - [docs/architecture.md](docs/architecture.md)
  - [ADR-0002 (stack)](docs/adr/0002-tech-stack.md)
  - [ADR-0003 (two-repo split)](docs/adr/0003-two-repo-split.md)
  - [ADR-0004 (money and dates)](docs/adr/0004-money-and-dates.md)
  - [CONTRIBUTING.md](CONTRIBUTING.md)

## Workflow: one card, one session, one PR

1. **Read the card and every card it links to.** The card is the spec: goal, in and out of scope,
   technical notes, test plan and acceptance criteria.
2. **Check dependencies.** Every card listed under "Blocked by" must be in **Done**, with its PR
   merged. If one isn't, stop and tell the owner.
3. **Branch from an up-to-date `main`** using the branch name on the card.
4. **Implement only what is in scope.** If you find necessary work outside the scope, don't do it.
   Describe it in the PR and suggest a new card.
5. **Run all checks locally** (see Commands) until they're green. Don't push red code.
6. **Commit** using Conventional Commits (see CONTRIBUTING).
7. **Push and open the PR** from the template:
   - the title is the card's PR title
   - the body includes `Refs: <card-id>` and the card URL
   - add the card's review label
8. **Update Trello:**
   - comment the PR link on the card
   - tick only the acceptance-criteria items you actually verified
   - move the card to **In Review**
9. **Address review comments in the same session** when asked. The owner merges. Never merge
   your own PR.

## Architecture rules (don't break these)

- **Kori owns the financial data.** All reads and writes go through the service layer. Service
  functions take `(db, user, …)` explicitly and always filter by `user.id`.
- **Isolation:** another user's resource returns **404**, never 403, and every endpoint has an
  isolation test.
- **Money:**
  - The API uses decimal strings in taka (`"1250.50"`, at most 2 decimal places).
  - The DB stores integer **poisha** (`bigint`).
  - Never use floats for money, in Python or TypeScript.
- **Dates:** `occurred_on` is a local calendar date in the user's time zone (Asia/Dhaka), and
  audit timestamps are `timestamptz`.
- **Errors:** RFC 9457 `application/problem+json`, always including `request_id`.
- **AI:** the AI never writes directly. Writes are proposals the user confirms, and AI-set fields
  are marked (`source` / `category_source`).

## Conventions

- **Branch:** `<type>/<card-id>-<slug>`.
- **Commits and PR titles:** `<type>(<scope>): summary`.
- **PR size:** one concern, roughly 300 changed lines at most, not counting generated files.
- **Review labels:** `review:skim`, `review:read` or `review:scrutinize`, as given on the card.
- **Decisions:** anything significant gets a new ADR in `docs/adr/`.
- **Agent instructions:** edit this file, not a tool-specific copy. If another tool needs its own
  file (for example `.github/copilot-instructions.md`), make it a short pointer to `AGENTS.md`.

## Commands

| Task | Command |
|---|---|
| Run all repo hooks | `pre-commit run --all-files` |
| Install API deps | `cd apps/api && uv sync` |
| Run the API (dev) | `make api-dev` |
| API tests (coverage ≥ 85%) | `make api-test` |
| API lint, format check, types | `make api-lint` |
| API auto-fix and format | `make api-fmt` |
| Start local Postgres (needs `apps/api/.env`, copy from `.env.example`) | `make db-up` |
| Apply migrations | `make migrate` |
| New migration from model changes | `make makemigration m="add foo"` |
| Export OpenAPI and regenerate the web client | `make openapi` |
| Install web deps | `make web-install` |
| Run the web app (dev, proxies `/api` to :8000) | `make web-dev` |
| Web tests | `make web-test` |
| Web lint, format check, types | `make web-lint` |
| Web auto-fix and format | `make web-fmt` |
| Web production build | `make web-build` |

Later PRs add rows here for the DB, Docker and seed commands.

## Never

- Commit real financial data, statements or personal information. Use seed data only.
- Commit secrets or tokens, or print them in logs or CI output.
- Skip, disable or weaken tests or checks to make CI pass.
- Force-push `main`, rewrite shared history, or merge PRs.
- Widen a PR beyond its card, or change a card's scope or acceptance criteria without the owner.

## Roles

| Who | Does |
|---|---|
| Owner (Monjurul) | Product decisions, every review and merge, the AI features in M4–M8 |
| Kori Engineer Routine (Claude Code, scheduled Sun, Tue and Thu) | Fixes review feedback on open PRs, then takes the next unblocked card, with at most one new PR per run and at most 3 PRs open at once. See the Trello card "Kori Engineer Routine" |
| AI coding agent, manual session (currently Claude Code) | One task card per session when the owner starts one: code, tests, PR, card update |
| Claude Cowork | Board grooming, weekly status, milestone planning. Never writes code |
