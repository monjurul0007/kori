from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from kori.config import Env, Settings
from kori.main import create_app
from kori.static import IMMUTABLE, NO_CACHE

HTML = {"Accept": "text/html,application/xhtml+xml"}


@pytest.fixture
def web(tmp_path: Path) -> Path:
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>kori</html>")
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log(1)")
    (tmp_path / "manifest.webmanifest").write_text("{}")
    (tmp_path.parent / "secret.txt").write_text("secret")
    return tmp_path


@pytest.fixture
def spa(web: Path) -> TestClient:
    app = create_app(Settings(env=Env.TEST, static_dir=str(web)))
    return TestClient(app, raise_server_exceptions=False)


def test_disabled_without_static_dir() -> None:
    client = TestClient(create_app(Settings(env=Env.TEST)))
    assert client.get("/", headers=HTML).status_code == 404


def test_missing_index_fails_fast(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match=r"index\.html"):
        create_app(Settings(env=Env.TEST, static_dir=str(tmp_path)))


def test_root_serves_index_uncached(spa: TestClient) -> None:
    r = spa.get("/", headers=HTML)
    assert r.status_code == 200
    assert "kori" in r.text
    assert r.headers["cache-control"] == NO_CACHE


def test_assets_are_immutable(spa: TestClient) -> None:
    r = spa.get("/assets/app-abc123.js")
    assert r.status_code == 200
    assert r.headers["cache-control"] == IMMUTABLE


def test_other_files_are_not_cached(spa: TestClient) -> None:
    r = spa.get("/manifest.webmanifest")
    assert r.status_code == 200
    assert r.headers["cache-control"] == NO_CACHE


def test_deep_link_falls_back_to_index(spa: TestClient) -> None:
    r = spa.get("/transactions?month=2026-09", headers=HTML)
    assert r.status_code == 200
    assert r.text == "<html>kori</html>"
    assert r.headers["cache-control"] == NO_CACHE


def test_non_html_unknown_path_is_404(spa: TestClient) -> None:
    assert spa.get("/transactions", headers={"Accept": "application/json"}).status_code == 404


def test_missing_asset_is_404_not_index(spa: TestClient) -> None:
    assert spa.get("/assets/gone.js", headers=HTML).status_code == 404


def test_unknown_api_path_is_problem_json(spa: TestClient) -> None:
    r = spa.get("/api/v1/nope", headers=HTML)
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/problem+json")
    assert "request_id" in r.json()


def test_api_routes_still_work(spa: TestClient) -> None:
    assert spa.get("/api/v1/healthz").json() == {"status": "ok"}


def test_path_traversal_is_blocked(spa: TestClient) -> None:
    r = spa.get("/%2e%2e/secret.txt")
    assert r.status_code == 404
    assert r.text.count("secret") <= 1  # only the echoed path, never the file content
    assert r.text != "secret"


def test_head_is_supported(spa: TestClient) -> None:
    assert spa.head("/manifest.webmanifest").status_code == 200
