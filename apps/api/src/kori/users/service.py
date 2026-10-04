from sqlalchemy import select
from sqlalchemy.orm import Session

from kori.auth.passwords import hash_password
from kori.users.defaults import seed_defaults
from kori.users.models import User


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def create_user(db: Session, *, email: str, display_name: str, password: str) -> User:
    """Create a user with a lowercased email. Raises `ValueError` if the email is taken."""
    email = normalize_email(email)
    if get_user_by_email(db, email) is not None:
        raise ValueError(f"A user with email {email} already exists")
    user = User(email=email, display_name=display_name, password_hash=hash_password(password))
    db.add(user)
    db.flush()
    seed_defaults(db, user)
    return user
