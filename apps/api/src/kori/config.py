from enum import StrEnum
from functools import lru_cache
from typing import Self

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_JOB_TOKEN_LENGTH = 32


class Env(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Application settings, read from `KORI_*` environment variables."""

    model_config = SettingsConfigDict(env_prefix="KORI_", env_file=".env", extra="ignore")

    env: Env = Env.DEVELOPMENT
    log_level: str = "INFO"
    app_origin: str | None = None
    static_dir: str | None = None  # built web app to serve; unset in dev (Vite serves it)
    database_url: str  # required, no default: set KORI_DATABASE_URL (see .env.example)

    # Shared secret for POST /internal/jobs/tick (ADR-0006). Unset: the route answers 404.
    job_token: SecretStr | None = None

    @field_validator("job_token", mode="before")
    @classmethod
    def _check_job_token(cls, value: object) -> object:
        if value is None or value == "":
            return None
        raw = value.get_secret_value() if isinstance(value, SecretStr) else str(value)
        if len(raw) < MIN_JOB_TOKEN_LENGTH:
            raise ValueError(f"KORI_JOB_TOKEN must be at least {MIN_JOB_TOKEN_LENGTH} characters")
        return value

    @model_validator(mode="after")
    def _require_origin_in_production(self) -> Self:
        if self.env is Env.PRODUCTION and not self.app_origin:
            raise ValueError("KORI_APP_ORIGIN is required when KORI_ENV=production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
