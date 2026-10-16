# 0005. Hosting: Cloud Run and Neon

- Status: Proposed (needs the owner's verification, see "Not verified" below)
- Date: 2026-10-13
- Refs: S2 · https://trello.com/c/NSnepcGo (unblocks M1-16)

## Context

M1 only counts as done when Kori is used daily on a phone. That needs hosting that costs about $0, has
HTTPS and Postgres 16 with pgvector, and doesn't make the first open of the day painfully slow. Backups
must be private (never a GitHub Actions artifact on a public repo), secrets live in GitHub Environments,
and deploys run from GitHub Actions. There is no custom domain, so the app and API share one origin.

**How this was researched.** Current terms were read from web search results and vendor pages on
2026-10-13. The spike's method also asks for hello-world deploys and cold-start measurements from Dhaka
on a phone. That wasn't possible from the automated session that wrote this, so **no latency numbers
here are measured**. They are marked as such and M1-16 must measure them.

## Options

Free-tier terms change often. Treat every row as "as found on 2026-10-13".

| Option | Free limits | Sleep / cold start | Region near Dhaka | Backups | Lock-in |
|---|---|---|---|---|---|
| **Cloud Run** (container) | Request-based billing: 2M requests, 180k vCPU-s, 360k GiB-s a month, applied as a dollar discount at Tier 1 rates, pooled per billing account, **any region**. Needs a billing account | Scales to zero; cold start of a small image is typically a few seconds (**unmeasured**) | Mumbai (`asia-south1`), Singapore (`asia-southeast1`) | n/a | Low: plain OCI image |
| **Koyeb** | One free web service, 512 MB, 0.1 vCPU | Scales to zero after about an hour idle | Free service only in Frankfurt or Washington D.C. | n/a | Low |
| **Render** | 750 instance hours | Sleeps after 15 min, about 1 minute to wake | Singapore exists, free tier not confirmed | Free Postgres **expires after 30 days** and is then deleted | Low |
| **Fly.io** | None for new customers (short trial only) | n/a | Singapore | n/a | n/a, ruled out |
| **Oracle Always Free VM** | ARM VM, always on (limits not re-verified) | None | Region fixed at signup, may not be near Dhaka | DIY | Low, but you operate the OS |
| **Neon** (Postgres) | 0.5 GB storage, 100 CU-hours, pgvector included | Compute suspends after 5 min idle; resume adds a delay to the first query (**unmeasured**) | Singapore (`aws-ap-southeast-1`) | Short point-in-time restore window on free (**length unverified**) | Low: standard Postgres |
| **Supabase** (Postgres) | 500 MB, 2 projects | **Paused after 1 week of inactivity** | Singapore | **No automatic backups on free** | Low |

Findings that rule options out:
- Fly.io has no free allowance for new customers.
- Render's free Postgres is deleted after 30 days and its web service sleeps after 15 minutes.
- Supabase's free tier has no backups and pauses after a week.
- Koyeb's free web service can't run in Asia.

## Decision

- **Container:** Google Cloud Run in `asia-southeast1` (Singapore), `min-instances=0`, one container
  serving the API and the SPA from one origin on the default `*.run.app` HTTPS URL.
- **Database:** Neon Free, `aws-ap-southeast-1` (Singapore), Postgres 16 with `CREATE EXTENSION vector`
  run once. Connect with `sslmode=require`.
- **Images:** GHCR (`ghcr.io/monjurul0007/kori:<sha>`), as M1-16 specifies. Cloud Run pulls through an
  Artifact Registry remote repository, or the deploy step copies the image there.
- **Auth from CI:** GitHub OIDC to Google Workload Identity Federation, so no long-lived Google key is
  stored. Only `KORI_DATABASE_URL` is a stored secret.
- **Backups:** a scheduled GitHub Actions job runs `pg_dump`, encrypts it, and uploads it to a
  **private** object-storage bucket. Neon's own restore window is a second line of defence, not the plan.
- **Fallback:** if Cloud Run turns out to cost money in Singapore or cold starts are too slow, move
  to an Oracle Always Free VM running Docker Compose (the `compose.yaml` from M1-15 already works).
  The image and settings don't change.

## Consequences

- Expected cost is $0, but a Google billing account (with a card) is required. Set a
  budget alert at a few dollars.
- Two cold starts can stack on the first open of the day: Cloud Run's and Neon's resume. M1-16 must
  measure this from a phone in Dhaka over 4G and record it in `docs/deploy.md`. If it is over about
  5 seconds, use the fallback.
- The `kori-ai` service (M3) can run as a second Cloud Run service. Background jobs (S3) fit Cloud Run
  jobs or GitHub Actions schedules, since the container sleeps.
- Neon's 0.5 GB limit is ample for one user's transactions, but embeddings (M5) must be watched.

## Cloud Run free tier by region (verified)

Checked against Google's pricing page (PDF copy supplied by the owner, 2026-10-14):
- The free tier is **not restricted to US regions**. It is aggregated per billing account, resets monthly,
  and "is applied as a spending based discount using Tier 1 pricing" (Iowa rates). Earlier secondary
  sources claiming otherwise were wrong.
- That discount is worth about $5 a month for request-based billing (180k vCPU-s at $0.000024 plus
  360k GiB-s at $0.0000025). Singapore (`asia-southeast1`) is a **Tier 2** region, so its unit prices are
  higher and the same dollar amount covers fewer seconds. Mumbai (`asia-south1`) is Tier 1.
- One user's traffic is far below that either way, so the expected cost is $0 in both regions.
  Singapore is kept so the container sits next to Neon (no cross-region query latency). Mumbai is a
  valid alternative if Neon gets a nearby region.
- Artifact Registry and Cloud Build are priced separately and have their own free tiers, so keep the
  image small and prune old tags.

## Not verified (owner or M1-16 to confirm)

1. Neon's free-plan restore window and project limit (sources disagree on the project count).
2. Oracle Always Free limits and idle-reclaim policy. The Oracle docs were unreachable.
3. All cold-start and latency figures, and the hello-world deploys and backup restore test from the
   spike's method.

## Setup notes for M1-16

1. Create the Neon project (Singapore, Postgres 16), run `CREATE EXTENSION vector;`, copy the pooled
   connection string with `sslmode=require`.
2. Create a Google project, enable Cloud Run and Artifact Registry, set a budget alert, and create a
   Workload Identity Pool trusting `monjurul0007/kori` on `main` only.
3. Create the `production` GitHub Environment with secret `KORI_DATABASE_URL` and variable
   `KORI_APP_ORIGIN` (the `*.run.app` URL, known after the first deploy).
4. The deploy runs migrations first as a Cloud Run job, then deploys the new revision. A failed
   migration stops the deploy and the old revision keeps serving.
5. Create a private bucket for backups and add the scheduled dump job.
6. Measure cold start and warm latency from a phone in Dhaka and record them in `docs/deploy.md`.
