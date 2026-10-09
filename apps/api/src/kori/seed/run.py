"""Write the generated demo data through the transaction service."""

import random
from dataclasses import dataclass
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from kori.categories.models import Category
from kori.common.enums import CategorySource, TransactionSource
from kori.common.money import format_taka
from kori.payment_methods.models import PaymentMethod
from kori.seed.generator import TxSpec, generate
from kori.transactions.models import Transaction
from kori.transactions.schemas import LineIn, TransactionIn
from kori.transactions.service import create_transaction
from kori.users.models import User
from kori.users.service import create_user, get_user_by_email

DEMO_NAME = "Demo"


@dataclass(frozen=True)
class SeedResult:
    user: User
    created_user: bool
    transactions: int


def _to_input(spec: TxSpec, categories: dict[str, str], methods: dict[str, str]) -> TransactionIn:
    shared = {
        "type": spec.type,
        "amount": format_taka(spec.amount),
        "occurred_on": spec.occurred_on,
        "merchant": spec.merchant,
        "note": spec.note,
        "payment_method_id": methods[spec.payment_method],
        "tags": list(spec.tags),
    }
    if len(spec.lines) == 1:
        category_id = categories[spec.lines[0].category]
        return TransactionIn.model_validate(shared | {"category_id": category_id})
    lines = [
        LineIn(category_id=categories[ln.category], amount=format_taka(ln.amount))
        for ln in spec.lines
    ]
    return TransactionIn.model_validate(shared | {"lines": lines})


def seed(
    db: Session,
    *,
    email: str,
    password: str | None,
    months: int,
    seed: int,
    reset: bool = False,
    today: date | None = None,
) -> SeedResult:
    """Create the demo user if missing, then write `months` of transactions for it.

    `password` is only needed when the user doesn't exist yet. Raises `ValueError` for a missing
    password, bad `months`, or a user who already has seed data (pass `reset=True` to replace it).
    """
    user = get_user_by_email(db, email)
    created = user is None
    if user is None:
        if password is None:
            raise ValueError(f"No user {email}: a password is needed to create it")
        user = create_user(db, email=email, display_name=DEMO_NAME, password=password)
    today = today or datetime.now(ZoneInfo(user.timezone)).date()
    rng = random.Random(seed)  # noqa: S311  (fake data, not security)
    specs = generate(rng, months, today)  # also validates `months`

    if reset:
        db.execute(delete(Transaction).where(Transaction.user_id == user.id))
    elif db.scalar(select(func.count()).where(Transaction.user_id == user.id)):
        raise ValueError(f"{user.email} already has transactions; use --reset to replace them")

    cats = db.scalars(select(Category).where(Category.user_id == user.id))
    categories = {c.name: str(c.id) for c in cats}
    pms = db.scalars(select(PaymentMethod).where(PaymentMethod.user_id == user.id))
    methods = {m.name: str(m.id) for m in pms}
    for spec in specs:
        create_transaction(
            db,
            user,
            _to_input(spec, categories, methods),
            source=TransactionSource.SEED,
            category_source=CategorySource.SEED,
        )
    return SeedResult(user, created, len(specs))
