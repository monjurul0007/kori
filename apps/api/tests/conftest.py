from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import Session

from kori.config import Env, Settings, get_settings
from kori.db.session import get_db
from kori.main import create_app


def _test_url() -> URL:
    url = make_url(get_settings().database_url)
    return url.set(database=f"{url.database}_test")


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """Create `<db>_test` once per session, migrate it to head, and yield an engine."""
    url = _test_url()
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()

    cfg = Config("alembic.ini")
    cfg.attributes["url"] = url.render_as_string(hide_password=False)
    command.upgrade(cfg, "head")

    eng = create_engine(url, pool_pre_ping=True)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    """A session inside an outer transaction that is rolled back after each test."""
    with engine.connect() as connection:
        outer = connection.begin()
        session = Session(connection, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            outer.rollback()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app = create_app(Settings(env=Env.TEST))
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(
        app, raise_server_exceptions=False, headers={"Origin": "http://localhost:5173"}
    ) as c:
        yield c
