import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from kori.users.models import User
from kori.users.service import create_user

from .helpers import category

PASSWORD = "correct horse battery"  # noqa: S105  (fake password in tests)


@pytest.fixture
def user(db: Session) -> User:
    return create_user(db, email="owner@example.com", display_name="Owner", password=PASSWORD)


@pytest.fixture
def other_user(db: Session) -> User:
    return create_user(db, email="other@example.com", display_name="Other", password=PASSWORD)


@pytest.fixture
def signed_in(client: TestClient, user: User) -> TestClient:
    r = client.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD})
    assert r.status_code == 204
    return client


@pytest.fixture
def food(db: Session, user: User) -> str:
    return category(db, user, "Food & Dining")


@pytest.fixture
def other_signed_in(client: TestClient, other_user: User) -> TestClient:
    r = client.post("/api/v1/auth/login", json={"email": other_user.email, "password": PASSWORD})
    assert r.status_code == 204
    return client
