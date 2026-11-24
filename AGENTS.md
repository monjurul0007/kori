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
  - Lists: `📌 Start here` · `Backlog` · `Spikes` · `Future Milestones` · `🎨 Design Refresh · Neel and Gada` (DR cards) · one `Milestone <N> · <name>` list per planned milestone (for example `Milestone 2 · Plan it`) · `In Review` · `Done`
  - Reference cards: How we work (https://trello.com/c/h4Mm3VqB), the Project brief
    (https://trello.com/c/bcmnXqx0) and the Kori Engineer Routine (https://trello.com/c/dvZifuoD)
- **This repo (`kori`):**
  - `apps/api` (FastAPI, from M1-02)
  - `apps/web` (React, from M1-11)
  - `infra/`
  - `docs/`
  - `docs/design/` (approved mockups and tokens) and `docs/brand/` (logos)
- **AI service:** https://github.com/monjurul0007/kori-ai
- **Read before coding:**
  - [docs/architecture.md](docs/architecture.md)
  - [ADR-0002 (stack)](docs/adr/0002-tech-stack.md)
  - [ADR-0003 (two-repo split)](docs/adr/0003-two-repo-split.md)
  - [ADR-0004 (money and dates)](docs/adr/0004-money-and-dates.md)
  - [docs/DESIGN.md](docs/DESIGN.md) and the mockups in [docs/design/](docs/design/README.md), for any web UI change
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
   Then **review your own diff** against "Code quality" below, as the owner's reviewer will. Fix
   what you find before pushing.
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

## Code quality

The linters (ruff, mypy `strict`, ESLint, Prettier, `tsc`) catch formatting and many bugs. These
rules cover what they can't. Match the surrounding code first: copy the existing module layout and
naming before inventing a new one. The Kori Code Reviewer checks these too.

**Readable**
- **Names say what a thing is or does.** Use full words and domain terms (`poisha`, `occurred_on`,
  `category`), not `data`, `tmp`, `val`, `mgr` or one-letter names outside tiny loops. Functions are
  verbs, booleans read as questions (`is_active`, `has_budget`).
- **Small functions that do one thing**, at one level of detail. If you need "and" to describe a
  function, or a comment to explain a block, extract a named function instead.
- **Keep nesting shallow.** Use early returns and guard clauses. Avoid more than 3 levels of
  indentation and long boolean expressions; give conditions a name.
- **No magic numbers or strings.** Name constants (`MAX_MONTHS_AHEAD`) and use the enums in
  `kori/common/enums.py`.
- **Comments explain why, not what.** Never leave commented-out code, stray `print` or
  `console.log` calls, or `TODO`s without a card reference.

**Structured**
- **Follow the layers.** API: `router.py` (HTTP only) → `service.py` (business rules, all DB access)
  → `models.py`; request and response shapes in `schemas.py`. Routers never query the DB, and
  services never import FastAPI. Web: pages in `features/<name>/`, shared UI in
  `components/`, pure helpers in `lib/`, server calls through hooks (`hooks.ts`) and the generated
  client in `src/api`.
- **Reuse before you add.** Search for an existing helper first (`kori/common/` for money, dates,
  errors and pagination; `src/lib/` and `components/ui/` on the web). Don't copy-paste a block a
  third time: extract it. But don't build an abstraction for a single use either.
- **Keep files and components focused.** If a file passes roughly 300 lines or a component mixes
  data fetching, state and layout, split it by responsibility. Don't split just to hit a number.
- **Types carry the rules.** Python is fully typed with no `Any` and no bare `# type: ignore`. TypeScript has
  no `any`, no non-null `!` assertions to silence the compiler, and no unchecked `as` casts; derive
  types from the generated API client instead of retyping them. Make impossible states
  unrepresentable (enums or unions, not loose strings and booleans).

**Safe**
- **Handle errors on purpose.** No bare `except:` or `except Exception: pass`, no empty `catch`
  blocks, no fallback that hides a failure. Raise the typed errors in `kori/common/errors.py` so the
  API returns `problem+json`. On the web, show the user an error state; never swallow a failed
  request.
- **Validate at the edge.** Parse and validate input once, in the schema. Inside the service layer,
  trust typed values, and never build SQL from strings. Use SQLAlchemy expressions.
- **No hidden side effects.** Keep functions pure where you can, don't mutate arguments, and keep
  I/O in the service layer (API) or in hooks (web). No module-level state or singletons that tests
  have to reset.
- **Don't log secrets, tokens or personal data.**

**Tested and maintainable**
- **Tests describe behaviour.** Name them for what should happen (`test_other_users_budget_returns_404`),
  one behaviour per test, with no logic in the test, and no snapshot tests. A test must fail if the
  change it covers is removed. Cover the failure and boundary cases, not only the happy path, and
  money rounding at 2 decimals.
- **Don't change behaviour while refactoring.** Make refactors a separate commit, and only inside
  the card's scope. Leave code better than you found it in the lines you touch, but don't clean up
  unrelated code in the same PR; suggest a card instead.
- **Dependencies are a decision.** Don't add a library for something the standard library or an
  existing dependency does. A new dependency needs a line in the PR explaining why.
- **Docs follow code.** Update the docs, ADR, `openapi.json` and regenerated client in the same PR
  when behaviour or an API changes.

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
| Fill the demo user with fake data ([docs](docs/seed-data.md)) | `make seed` |
| New migration from model changes | `make makemigration m="add foo"` |
| Export OpenAPI and regenerate the web client | `make openapi` |
| Install web deps | `make web-install` |
| Run the web app (dev, proxies `/api` to :8000) | `make web-dev` |
| Web tests | `make web-test` |
| Web lint, format check, types | `make web-lint` |
| Web auto-fix and format | `make web-fmt` |
| Web production build | `make web-build` |
| End-to-end smoke test (needs `make up` and a user, see the Makefile) | `make e2e` |
| Build and start the whole stack (app + Postgres) at http://localhost:8000 | `make up` |
| Stop the stack / follow the app logs | `make down` / `make logs` |
| Create a user in the running stack | `make create-user email=… name=…` |

Later PRs add rows here for the remaining Docker commands.

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
