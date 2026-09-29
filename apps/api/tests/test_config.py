import pytest
from pydantic import ValidationError

from kori.config import Env, Settings


def test_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("KORI_ENV", raising=False)
    s = Settings(_env_file=None)
    assert s.env is Env.DEVELOPMENT
    assert s.log_level == "INFO"


def test_env_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KORI_ENV", "test")
    monkeypatch.setenv("KORI_LOG_LEVEL", "DEBUG")
    s = Settings(_env_file=None)
    assert s.env is Env.TEST
    assert s.log_level == "DEBUG"


def test_production_requires_app_origin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KORI_ENV", "production")
    monkeypatch.delenv("KORI_APP_ORIGIN", raising=False)
    with pytest.raises(ValidationError, match="KORI_APP_ORIGIN is required"):
        Settings(_env_file=None)


def test_production_with_origin_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KORI_ENV", "production")
    monkeypatch.setenv("KORI_APP_ORIGIN", "https://kori.example.com")
    assert Settings(_env_file=None).app_origin == "https://kori.example.com"
