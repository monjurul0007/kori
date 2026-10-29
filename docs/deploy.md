# Deploying Kori

Every merge to `main` deploys to production through [`deploy.yml`](../.github/workflows/deploy.yml).
Hosting is Google Cloud Run (Singapore) with Neon Postgres (Singapore), see
[ADR-0005](adr/0005-hosting.md). This page is the runbook.

## What a deploy does

1. **Gate.** The merged PR must have green `pre-commit`, `api-ci`, `web-ci` and `build-image`.
2. **Build once** and push `ghcr.io/monjurul0007/kori:<sha>` and `:main`, plus the same image to
   Artifact Registry (Cloud Run can't pull from GHCR directly).
3. **Migrate** with the one-off Cloud Run job `kori-migrate` (`alembic upgrade head`).
   If it fails, the deploy stops and the previous revision keeps serving.
4. **Deploy** the new revision (`min-instances=0`, 512 MiB, `WEB_CONCURRENCY=1`).
5. **Smoke test** `/api/v1/healthz` and `/`.

Only one deploy runs at a time (`concurrency: deploy-production`).

**Migrations stay backward-compatible for one release (expand, then contract).** The old revision
keeps running against the migrated schema during a deploy and after a rollback, so add columns and
tables first, and drop or rename them in a later release.

## First-time setup

1. **Neon.** Create a project (Singapore, Postgres 16). Run `CREATE EXTENSION vector;`. Copy the
   **direct (non-pooled)** connection string, because migrations and `pg_dump` don't work reliably
   through a pooler. Convert it to the SQLAlchemy form:
   `postgresql+psycopg://USER:PASS@HOST/DB?sslmode=require`.
2. **Google Cloud.**
   - Create a project, enable Cloud Run, Artifact Registry and IAM Credentials. Set a budget alert
     of a few dollars.
   - Create a Docker Artifact Registry repository named `kori` in `asia-southeast1`. Add a cleanup
     policy that keeps the 10 most recent versions.
   - Create a deploy service account with `roles/run.admin`, `roles/artifactregistry.writer` and
     `roles/iam.serviceAccountUser` (on itself and on the Cloud Run runtime account), and
     `roles/storage.objectCreator` on the backup bucket.
   - Create a Workload Identity Pool and GitHub provider whose attribute condition allows only
     `assertion.repository == 'monjurul0007/kori'` and `assertion.ref == 'refs/heads/main'`.
     Let that principal impersonate the deploy service account.
3. **Backup bucket.** Create a private bucket (uniform access, public access prevented) with a
   lifecycle rule that deletes objects after 30 days. Generate an age key pair with
   `age-keygen -o kori-backup.key` and keep the private key **outside** the repo (password manager).
4. **GitHub `production` environment** (Settings → Environments). Optionally add yourself as a
   required reviewer to approve each deploy.

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `KORI_DATABASE_URL` | the string from step 1 |
   | Variable | `KORI_APP_ORIGIN` | `https://kori-<project-number>.asia-southeast1.run.app` |
   | Variable | `GCP_PROJECT_ID`, `GCP_REGION` (`asia-southeast1`) | |
   | Variable | `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` | from step 2 |
   | Variable | `BACKUP_BUCKET`, `BACKUP_AGE_RECIPIENT` | bucket name; the age **public** key |
   | Variable (optional) | `CLOUD_RUN_SERVICE` | defaults to `kori` |

   `KORI_APP_ORIGIN` must be set before the first deploy because the app refuses to start in
   production without it. The Cloud Run URL is predictable: service name, project **number**, region.
5. **Make the GHCR package private or public** as you like. CI pushes with the workflow token.
6. Merge a change to `main`, or run the `deploy` workflow manually.
7. **Create the production user** (see below).

## Create the production user

`kori create-user` prompts for the password, so it needs a terminal. From your machine, with the
direct connection string exported as `KORI_DATABASE_URL` and `KORI_ENV=production`:

```bash
docker run --rm -it -e KORI_ENV=production -e KORI_APP_ORIGIN -e KORI_DATABASE_URL \
  --entrypoint kori ghcr.io/monjurul0007/kori:main create-user --email you@example.com --name "Your Name"
```

Don't run `kori seed` against production; it refuses unless `--i-know-this-is-prod` is passed.

## Roll back

Fastest, no build: shift traffic to the previous revision.

```bash
gcloud run revisions list --service kori --region asia-southeast1
gcloud run services update-traffic kori --region asia-southeast1 --to-revisions=<previous-revision>=100
```

Or redeploy an older commit: run the `deploy` workflow manually with `ref` set to its SHA. It
rebuilds and re-runs the gate, migrations (a no-op for an older schema-compatible build) and smoke test.
Never roll back across a migration that dropped something; that is why migrations are expand-then-contract.

## Backups and restore

`backup.yml` runs nightly and uploads an age-encrypted `pg_dump` to the private bucket. Neon's own
point-in-time restore is a second line of defence only. To restore into a scratch database:

```bash
gcloud storage cp gs://<bucket>/kori-<timestamp>.dump.age .
age -d -i kori-backup.key kori-<timestamp>.dump.age > kori.dump
createdb kori_restore   # a scratch database, never production
pg_restore --no-owner -d kori_restore kori.dump
psql kori_restore -c 'SELECT count(*) FROM transactions;'
```

## Rotate secrets

- **Database password:** reset it in Neon, update the `KORI_DATABASE_URL` environment secret, then
  run the `deploy` workflow (the new value reaches Cloud Run only on deploy).
- **Backup key:** generate a new age pair, update `BACKUP_AGE_RECIPIENT`. Keep the old private key
  until the old dumps have expired.
- There is no stored Google key to rotate: CI uses OIDC.

## Measurements (to fill in by the owner)

Not measured yet. Record the first request after idle on a phone over 4G from Dhaka, a warm
request, and the date. ADR-0005 says to fall back to the Oracle VM if the cold path is over about 5 s.

| Date | Network | Cold (first open after idle) | Warm |
|---|---|---|---|
| | | | |
