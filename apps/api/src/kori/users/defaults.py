from sqlalchemy.orm import Session

from kori.categories.defaults import seed_categories
from kori.payment_methods.defaults import seed_payment_methods
from kori.users.models import User


def seed_defaults(db: Session, user: User) -> None:
    """Give a user the default categories and payment methods. Idempotent."""
    seed_categories(db, user)
    seed_payment_methods(db, user)
