from enum import StrEnum
from functools import lru_cache
from typing import Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    database_url: str = "postgresql+psycopg://kori:kori@localhost:5432/kori"

    @model_validator(mode="after")
    def _require_origin_in_production(self) -> Self:
        if self.env is Env.PRODUCTION and not self.app_origin:
            raise ValueError("KORI_APP_ORIGIN is required when KORI_ENV=production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
