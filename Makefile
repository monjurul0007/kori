.PHONY: api-dev api-test api-lint api-fmt

api-dev:
	cd apps/api && uv run uvicorn kori.main:app_factory --factory --reload

api-test:
	cd apps/api && uv run pytest --cov-fail-under=85

api-lint:
	cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy

api-fmt:
	cd apps/api && uv run ruff check --fix . && uv run ruff format .
