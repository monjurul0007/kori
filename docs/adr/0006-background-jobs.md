# 0006. Background jobs on scale-to-zero hosting

- Status: Proposed (needs the owner's verification, see "Not verified" below)
- Date: 2026-11-24
- Refs: S3 · https://trello.com/c/g3gEBMcz (unblocks M2-09, M3's background hook)

## Context

Cloud Run scales to zero and Neon suspends after 5 minutes idle ([ADR-0005](0005-hosting.md)), so
nothing inside the app process can be relied on to wake up on its own. Three kinds of work need a
trigger:

| Job | Milestone | Needs |
|---|---|---|
| Materialize due recurring rules into transactions | M2 | Once a day, plus when you open the app |
| Auto-categorize a transaction after it is created | M3, M7 | Soon after the write |
| Monthly summaries, anomaly checks | M7 | Daily or monthly schedule |

Constraints: $0; **idempotent** (a double trigger never duplicates a transaction); observable (logs and
a last-run timestamp); and any internal endpoint is authenticated, never public.

**How this was researched.** Options were compared on paper against the ADR-0005 host and the existing
code (`recurring_rules.next_due_on`, the CSRF middleware, `backup.yml`). The spike also asks for a
prototype against the **deployed** app. This automated session has no access to the deployment, so
**nothing here was run against production**. The owner step is listed under "Not verified".

## Options

| Option | $0 | Fits scale-to-zero | Notes |
|---|---|---|---|
| 1. Lazy on request (catch-up when the app is opened) | Yes | Yes | Never misses, but only runs when you visit. Alone it can't do "00:10 daily" or push work |
| 2. GitHub Actions cron calling an internal endpoint | Yes (public repo) | Yes, the call wakes Cloud Run | Same mechanism as `backup.yml`. Cron can drift by minutes and is skipped on repos idle for 60 days (a public repo with active commits is fine) |
| 3. Cloud Scheduler | Free tier of 3 jobs, needs the billing account that ADR-0005 already requires | Yes | Equivalent to 2 but a second place holding the secret and schedule. Keep as the fallback |
| 4. Postgres queue (`procrastinate`, `SKIP LOCKED`) | Yes | Needs a worker, which scale-to-zero doesn't have | A worker would have to be woken by 2 or 3 anyway. Extra moving part for one user |
| 5. In-process `BackgroundTasks` | Yes | Only for work that finishes within the request's lifetime | Cloud Run (request-based billing) throttles the CPU once the response is sent, so it is unsafe for anything that matters |

## Decision

**Scheduled work: option 2, with option 1 as the safety net.**
- A GitHub Actions workflow (`jobs-tick.yml`) runs daily at 00:10 Asia/Dhaka (18:10 UTC) and on
  `workflow_dispatch`. It calls `POST /internal/jobs/tick` on the production app and fails on any non-2xx.
- The tick endpoint runs every due job. For M2 that is the recurring materializer. Later jobs (M7
  summaries) register in the same tick, so there is one trigger, one secret and one log line per run.
- **Catch-up when the app is opened:** the authenticated session bootstrap (the first
  `GET /api/v1/auth/me` of a session) calls `materialize_due(db, user, today)` for that user only. It
  must cost one indexed query when nothing is due (`ix_recurring_rules_next_due_on` is partial for this).
  A missed or delayed cron therefore heals itself on your next visit.

**Work after a write (M3 auto-categorization): not a scheduled job.** Kori calls `kori-ai` directly
from the request that created the transaction, under a short timeout, and treats failure as "leave
uncategorized". It is only a *proposal* (AGENTS.md), so losing it is harmless. Anything that must
be retried is picked up by the next tick, which scans for uncategorized AI-eligible rows. Neither
`BackgroundTasks` nor a queue is introduced.

**How `kori-ai` background work (M3/M7) is triggered: kori calls kori-ai, never the reverse.** The tick
endpoint (or the write request) calls kori-ai's HTTP API with service auth. `kori-ai` has no schedule,
no database access and no polling loop. This matches ADR-0003: kori-ai only returns proposals, and a
sleeping kori-ai wakes on the call just as kori does.

### The internal endpoint

- `POST /internal/jobs/tick`, outside `/api/v1`, excluded from OpenAPI (`include_in_schema=False`).
- Authenticated by `X-Kori-Job-Token`, compared with `hmac.compare_digest` against `KORI_JOB_TOKEN`.
  Wrong or missing token: 401 problem+json. Setting unset: 404, so the route doesn't exist on
  deployments that don't use it.
- Exempt from the CSRF Origin check by **exact path** (the middleware only guards `/api/`, so no
  change is needed unless that scope widens; M2-09 adds a test that pins this).
- The token is a 32-byte random value stored as a secret in the `production` GitHub Environment and as
  a Cloud Run secret. It is never logged. Rotation: set the new value in both places, redeploy, run
  the workflow once (documented in `docs/deploy.md` by M2-09).
- GitHub OIDC is the stronger option but would need verification code on the app side for little gain
  with a single user. Revisit if more internal callers appear.

### Idempotency rules

1. **Cursor:** each rule's `next_due_on` is the only cursor. It moves forward in the same database
   transaction that creates the occurrence. A deleted occurrence is therefore **never recreated**
   ("delete = skip this occurrence").
2. **Backstop:** `UNIQUE (recurring_rule_id, occurred_on)` on `transactions`. Inserting inside a
   savepoint, a conflict means "already done", not an error.
3. **Concurrency:** rules are selected `FOR UPDATE SKIP LOCKED`, one database transaction per rule, so
   two overlapping ticks (or a tick plus a catch-up) never process the same rule at once.
4. **Time zone:** "today" is per user in their own zone (Asia/Dhaka), never UTC.
5. **Catch-up cap:** at most 12 occurrences per rule per run; the remainder is logged as a warning and
   finished by the next run.
6. A rule whose category or payment method was archived is paused with `last_error` set, not retried
   forever.

### Observability

One structured log line per run (rules scanned, created, skipped, failed, duration), and a last-run
timestamp stored in a `job_runs` table (one row per run) and returned by the endpoint. The workflow
run history on GitHub is the second record.

## Consequences

- No new infrastructure and $0 cost. The only new secret is `KORI_JOB_TOKEN`.
- The cron can start minutes late; a recurring transaction may show up a few minutes after midnight,
  or on your next visit at the latest. That is acceptable for a personal budget.
- A tick wakes Cloud Run and Neon once a day, which also warms the first open of the morning slightly.
- Scheduled work is limited to what finishes within one request (Cloud Run's request timeout, set to
  300 s). If M7 jobs outgrow that, move them to a Cloud Run job triggered by the same workflow, which
  doesn't change the endpoint contract for M2.
- If GitHub cron proves unreliable, Cloud Scheduler can call the same endpoint with the same header.
  Nothing in the app changes.

## Not verified (owner to confirm)

1. The prototype against the deployed app: a manual `workflow_dispatch` of the tick, then a second
   call is a no-op. This ADR is **Proposed** until that is done, and S3's checklist items for the
   deployed proof stay unticked.
2. GitHub's current scheduled-workflow delay and the 60-day inactivity rule were taken from general
   knowledge of Actions, not re-checked today.
3. Cloud Scheduler's current free allowance (3 jobs) was not re-checked.
