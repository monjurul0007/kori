.PHONY: api-dev api-test api-lint api-fmt openapi web-install web-dev web-test web-lint web-fmt web-build

api-dev:
	cd apps/api && uv run uvicorn kori.main:app_factory --factory --reload

api-test:
	cd apps/api && uv run pytest --cov-fail-under=85

api-lint:
	cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy

api-fmt:
	cd apps/api && uv run ruff check --fix . && uv run ruff format .

openapi:
	cd apps/api && uv run python scripts/export_openapi.py ../../openapi.json
	cd apps/web && pnpm gen:api

web-install:
	cd apps/web && pnpm install --frozen-lockfile

web-dev:
	cd apps/web && pnpm dev

web-test:
	cd apps/web && pnpm test

web-lint:
	cd apps/web && pnpm lint && pnpm typecheck

web-fmt:
	cd apps/web && pnpm exec eslint --fix . && pnpm format

web-build:
	cd apps/web && pnpm build
