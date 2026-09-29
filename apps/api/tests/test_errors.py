from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from kori.config import Env, Settings
from kori.main import create_app


def test_unknown_route_is_problem_json(client: TestClient) -> None:
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/problem+json")
    body = r.json()
    assert body["status"] == 404
    assert body["title"] == "Not Found"
    assert body["instance"] == "/api/v1/nope"
    assert body["request_id"] == r.headers["X-Request-ID"]


class Payload(BaseModel):
    amount: str


def _app_with_routes() -> FastAPI:
    app = create_app(Settings(env=Env.TEST))

    @app.post("/echo")
    def echo(p: Payload) -> Payload:
        return p

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    return app


def test_validation_error_shape() -> None:
    client = TestClient(_app_with_routes())
    r = client.post("/echo", json={})
    assert r.status_code == 422
    assert r.headers["content-type"].startswith("application/problem+json")
    body = r.json()
    assert body["request_id"]
    assert body["errors"] == [
        {"loc": ["body", "amount"], "msg": "Field required", "type": "missing"}
    ]


def test_unhandled_error_hides_internals() -> None:
    client = TestClient(_app_with_routes(), raise_server_exceptions=False)
    r = client.get("/boom")
    assert r.status_code == 500
    assert r.headers["content-type"].startswith("application/problem+json")
    assert "secret" not in r.text
    assert "Traceback" not in r.text
    assert r.json()["request_id"] == r.headers["X-Request-ID"]
