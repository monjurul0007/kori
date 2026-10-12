# syntax=docker/dockerfile:1
# One image serving the API and the built web app. Build context: the repo root.

# --- 1. Build the web app ---
FROM node:lts-slim AS web
WORKDIR /web
RUN corepack enable
COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/web/ ./
RUN pnpm build

# --- 2. Install the API into a self-contained virtualenv ---
FROM python:3.12-slim AS api
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app/api
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY apps/api/src ./src
RUN uv sync --frozen --no-dev --no-editable

# --- 3. Runtime ---
FROM python:3.12-slim
RUN useradd --system --uid 10001 --no-create-home kori
WORKDIR /app/api
COPY --from=api /app/api/.venv /app/api/.venv
COPY apps/api/alembic.ini ./
COPY apps/api/migrations ./migrations
COPY --from=web /web/dist /app/static
COPY infra/docker/entrypoint.sh /app/entrypoint.sh
ENV PATH="/app/api/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    KORI_STATIC_DIR=/app/static \
    WEB_CONCURRENCY=2
USER kori
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/api/v1/healthz', timeout=3)"]
ENTRYPOINT ["/app/entrypoint.sh"]
