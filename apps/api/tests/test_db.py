from typing import Annotated

from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session

from kori.config import Env, Settings
from kori.db import get_db, make_sessionmaker
from kori.db.base import NAMING_CONVENTION, Base
from kori.main import create_app


def test_extensions_installed(db: Session) -> None:
    rows = db.execute(text("SELECT extname FROM pg_extension")).scalars().all()
    assert {"vector", "pg_trgm"} <= set(rows)


def test_naming_convention_applied() -> None:
    assert Base.metadata.naming_convention == NAMING_CONVENTION


def test_isolation_write(db: Session) -> None:
    db.execute(text("CREATE TEMP TABLE iso_probe (id int)"))
    db.execute(text("INSERT INTO iso_probe VALUES (1)"))
    assert db.execute(text("SELECT count(*) FROM iso_probe")).scalar_one() == 1


def test_isolation_rolled_back(db: Session) -> None:
    # Temp tables are per-connection; a leaked outer transaction would keep the table alive.
    exists = db.execute(text("SELECT to_regclass('pg_temp.iso_probe')")).scalar_one()
    assert exists is None


def test_readyz_ok(client: TestClient) -> None:
    r = client.get("/api/v1/readyz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_readyz_503_when_db_down() -> None:
    dead = create_engine(
        "postgresql+psycopg://x:x@127.0.0.1:1/x", connect_args={"connect_timeout": 1}
    )
    app = create_app(Settings(env=Env.TEST))
    app.state.engine = dead
    app.state.session_factory = make_sessionmaker(dead)
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/api/v1/readyz")
    assert r.status_code == 503
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["request_id"]


def test_get_db_commits_on_success(engine: Engine) -> None:
    app = create_app(Settings(env=Env.TEST))
    app.state.session_factory = make_sessionmaker(engine)

    @app.get("/_probe/ok")
    def ok(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
        db.execute(text("CREATE TABLE IF NOT EXISTS commit_probe (v int)"))
        db.execute(text("INSERT INTO commit_probe VALUES (1)"))
        return {}

    @app.get("/_probe/fail")
    def fail(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
        db.execute(text("INSERT INTO commit_probe VALUES (2)"))
        raise RuntimeError("boom")

    with TestClient(app, raise_server_exceptions=False) as c:
        assert c.get("/_probe/ok").status_code == 200
        assert c.get("/_probe/fail").status_code == 500
    try:
        with engine.connect() as conn:
            vals = conn.execute(text("SELECT v FROM commit_probe")).scalars().all()
        assert vals == [1]
    finally:
        with engine.begin() as conn:
            conn.execute(text("DROP TABLE IF EXISTS commit_probe"))
