import json
import re

import pytest
import structlog
from fastapi import FastAPI
from fastapi.testclient import TestClient

from kori.config import Env, Settings
from kori.main import create_app


def test_inbound_request_id_is_echoed(client: TestClient) -> None:
    r = client.get("/api/v1/healthz", headers={"X-Request-ID": "abc_123-XYZ"})
    assert r.headers["X-Request-ID"] == "abc_123-XYZ"


@pytest.mark.parametrize("bad", ["has space", "x" * 129, "semi;colon"])
def test_invalid_request_id_is_replaced(client: TestClient, bad: str) -> None:
    r = client.get("/api/v1/healthz", headers={"X-Request-ID": bad})
    assert r.headers["X-Request-ID"] != bad
    assert re.fullmatch(r"[0-9a-f-]{36}", r.headers["X-Request-ID"])


def test_request_id_generated_when_missing(client: TestClient) -> None:
    r = client.get("/api/v1/healthz")
    assert re.fullmatch(r"[0-9a-f-]{36}", r.headers["X-Request-ID"])


def test_log_line_is_json_with_request_id(capsys: pytest.CaptureFixture[str]) -> None:
    app: FastAPI = create_app(Settings(env=Env.TEST))

    @app.get("/log")
    def log_it() -> dict[str, str]:
        structlog.get_logger().info("hello")
        return {}

    r = TestClient(app).get("/log", headers={"X-Request-ID": "req-1"})
    assert r.status_code == 200
    line = next(ln for ln in capsys.readouterr().out.splitlines() if '"hello"' in ln)
    data = json.loads(line)
    assert data["event"] == "hello"
    assert data["request_id"] == "req-1"
