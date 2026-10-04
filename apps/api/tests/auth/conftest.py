# ruff: noqa: S105  (fake password in tests)
import pytest
from sqlalchemy.orm import Session

from kori.users.models import User
from kori.users.service import create_user

PASSWORD = "correct horse battery"


@pytest.fixture
def user(db: Session) -> User:
    return create_user(db, email="Owner@Example.com", display_name="Owner", password=PASSWORD)
