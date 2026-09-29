from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from kori.config import Env, Settings
from kori.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app(Settings(env=Env.TEST))
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
