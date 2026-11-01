# ruff: noqa: S105  (fake passwords in tests)
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from kori.categories.models import Category
from kori.common.enums import CategoryKind
from kori.users.models import User
from kori.users.service import create_user

PASSWORD = "correct horse battery"


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


def category_id(
    db: Session, user: User, name: str, kind: CategoryKind = CategoryKind.EXPENSE
) -> str:
    row = db.scalar(
        select(Category).where(
            Category.user_id == user.id, Category.name == name, Category.kind == kind
        )
    )
    assert row is not None
    return str(row.id)


@pytest.fixture
def food(db: Session, user: User) -> str:
    return category_id(db, user, "Food & Dining")
