.PHONY: up down logs create-user seed api-dev api-test api-lint api-fmt db-up migrate makemigration openapi web-install web-dev web-test web-lint web-fmt web-build

up:
	docker compose up -d --build --wait

down:
	docker compose down

logs:
	docker compose logs -f app

# Usage: make create-user email=me@example.com name="Your Name" (prompts for the password)
create-user:
	docker compose exec app kori create-user --email "$(email)" --name "$(name)"

api-dev:
	cd apps/api && uv run uvicorn kori.main:app_factory --factory --reload

api-test:
	cd apps/api && uv run pytest --cov-fail-under=85

api-lint:
	cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy

api-fmt:
	cd apps/api && uv run ruff check --fix . && uv run ruff format .

db-up:
	docker compose up -d --wait db

seed:
	cd apps/api && uv run kori seed --email demo@kori.local --months 6 --seed 42 --reset

migrate:
	cd apps/api && uv run alembic upgrade head

makemigration:
	cd apps/api && uv run alembic revision --autogenerate -m "$(m)"

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
