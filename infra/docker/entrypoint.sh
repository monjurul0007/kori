#!/bin/sh
# Migrate, then serve. A failed migration stops the container before it takes traffic.
set -eu
alembic upgrade head
exec uvicorn kori.main:app_factory --factory --host 0.0.0.0 --port 8000 \
    --workers "${WEB_CONCURRENCY:-2}" --proxy-headers --forwarded-allow-ips='*'
