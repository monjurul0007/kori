# ruff: noqa: S105, S106  (fake passwords in tests)
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.auth import passwords
from kori.users.models import User
from kori.users.service import create_user, get_user_by_email, normalize_email


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("a@b.co", "a@b.co"),
        ("  A@B.CO ", "a@b.co"),
        ("Mixed.Case@Example.COM", "mixed.case@example.com"),
    ],
)
def test_normalize_email(raw: str, expected: str) -> None:
    assert normalize_email(raw) == expected


def test_create_user_lowercases_email_and_stores_a_hash(db: Session) -> None:
    user = create_user(db, email=" New@Example.COM ", display_name="New", password="pw-123456")
    assert user.id is not None
    assert user.email == "new@example.com"
    assert user.display_name == "New"
    assert user.password_hash != "pw-123456"
    assert passwords.verify_password(user.password_hash, "pw-123456")


def test_create_user_rejects_a_duplicate_email_in_any_case(db: Session) -> None:
    create_user(db, email="dup@example.com", display_name="One", password="pw-123456")
    with pytest.raises(ValueError, match="already exists"):
        create_user(db, email="DUP@Example.com", display_name="Two", password="pw-123456")
    assert db.scalar(select(func.count()).select_from(User)) == 1


def test_get_user_by_email_is_case_and_whitespace_insensitive(db: Session) -> None:
    user = create_user(db, email="find@example.com", display_name="F", password="pw-123456")
    assert get_user_by_email(db, " FIND@example.com ") == user


def test_get_user_by_email_returns_none_when_missing(db: Session) -> None:
    assert get_user_by_email(db, "missing@example.com") is None
