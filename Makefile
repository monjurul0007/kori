.PHONY: api-dev api-test api-lint api-fmt db-up migrate makemigration

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

migrate:
	cd apps/api && uv run alembic upgrade head

makemigration:
	cd apps/api && uv run alembic revision --autogenerate -m "$(m)"
