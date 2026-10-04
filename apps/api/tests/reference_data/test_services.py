import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.categories import service as categories
from kori.categories.models import Category
from kori.categories.schemas import CategoryCreate, CategoryUpdate
from kori.common.enums import CategoryKind, PaymentMethodKind
from kori.common.errors import ConflictError, NotFoundError
from kori.payment_methods import service as payment_methods
from kori.payment_methods.schemas import PaymentMethodCreate, PaymentMethodUpdate
from kori.tags import service as tags
from kori.tags.models import Tag, TransactionTag
from kori.users import service as users
from kori.users.models import User

from .test_tags_api import make_tag, tag_transactions

EXPENSE = CategoryKind.EXPENSE


# --- categories ---


def test_list_categories_filters_and_orders(db: Session, user: User) -> None:
    assert len(categories.list_categories(db, user)) == 16
    income = categories.list_categories(db, user, kind=CategoryKind.INCOME)
    assert income[0].name == "Salary"
    rent = next(c for c in categories.list_categories(db, user) if c.name == "Rent")
    categories.archive_category(db, user, rent.id)
    assert rent not in categories.list_categories(db, user)
    assert rent in categories.list_categories(db, user, include_archived=True)


def test_create_category_rejects_duplicates_case_insensitively(db: Session, user: User) -> None:
    with pytest.raises(ConflictError):
        categories.create_category(db, user, CategoryCreate(name="rent", kind=EXPENSE))
    categories.create_category(db, user, CategoryCreate(name="Rent", kind=CategoryKind.INCOME))


def test_get_category_resolves_archived_but_not_foreign_or_missing(
    db: Session, user: User, other_user: User
) -> None:
    rent = next(c for c in categories.list_categories(db, user) if c.name == "Rent")
    categories.archive_category(db, user, rent.id)
    assert categories.get_category(db, user, rent.id).id == rent.id
    theirs = categories.list_categories(db, other_user)[0]
    for missing in (theirs.id, uuid.uuid4()):
        with pytest.raises(NotFoundError):
            categories.get_category(db, user, missing)


def test_update_category_changes_only_sent_fields(db: Session, user: User) -> None:
    rent = next(c for c in categories.list_categories(db, user) if c.name == "Rent")
    updated = categories.update_category(db, user, rent.id, CategoryUpdate(color="#fff"))
    assert (updated.name, updated.icon, updated.color) == ("Rent", "house", "#fff")
    cleared = categories.update_category(db, user, rent.id, CategoryUpdate(icon=None))
    assert cleared.icon is None
    with pytest.raises(ConflictError):
        categories.update_category(db, user, rent.id, CategoryUpdate(name="shopping"))


def test_archive_and_unarchive_are_idempotent(db: Session, user: User) -> None:
    rent = next(c for c in categories.list_categories(db, user) if c.name == "Rent")
    first = categories.archive_category(db, user, rent.id).archived_at
    assert first is not None
    assert categories.archive_category(db, user, rent.id).archived_at == first
    assert categories.unarchive_category(db, user, rent.id).archived_at is None
    assert categories.unarchive_category(db, user, rent.id).archived_at is None


def test_unarchive_conflicts_with_a_new_active_name(db: Session, user: User) -> None:
    rent = next(c for c in categories.list_categories(db, user) if c.name == "Rent")
    categories.archive_category(db, user, rent.id)
    categories.create_category(db, user, CategoryCreate(name="Rent", kind=EXPENSE))
    with pytest.raises(ConflictError):
        categories.unarchive_category(db, user, rent.id)


# --- payment methods ---


def test_payment_method_lifecycle(db: Session, user: User, other_user: User) -> None:
    created = payment_methods.create_payment_method(
        db, user, PaymentMethodCreate(name="Rocket", kind=PaymentMethodKind.MOBILE_WALLET)
    )
    with pytest.raises(ConflictError):
        payment_methods.create_payment_method(
            db, user, PaymentMethodCreate(name="ROCKET", kind=PaymentMethodKind.OTHER)
        )
    updated = payment_methods.update_payment_method(
        db, user, created.id, PaymentMethodUpdate(kind=PaymentMethodKind.BANK, sort_order=9)
    )
    assert (updated.name, updated.kind, updated.sort_order) == ("Rocket", PaymentMethodKind.BANK, 9)
    with pytest.raises(ConflictError):
        payment_methods.update_payment_method(
            db, user, created.id, PaymentMethodUpdate(name="bkash")
        )

    archived = payment_methods.archive_payment_method(db, user, created.id)
    assert archived.archived_at is not None
    assert created not in payment_methods.list_payment_methods(db, user)
    assert created in payment_methods.list_payment_methods(db, user, include_archived=True)
    assert payment_methods.get_payment_method(db, user, created.id) is created
    assert payment_methods.unarchive_payment_method(db, user, created.id).archived_at is None

    with pytest.raises(NotFoundError):
        payment_methods.get_payment_method(db, other_user, created.id)


def test_payment_method_unarchive_conflicts_with_active_name(db: Session, user: User) -> None:
    nagad = next(p for p in payment_methods.list_payment_methods(db, user) if p.name == "Nagad")
    payment_methods.archive_payment_method(db, user, nagad.id)
    payment_methods.create_payment_method(
        db, user, PaymentMethodCreate(name="Nagad", kind=PaymentMethodKind.MOBILE_WALLET)
    )
    with pytest.raises(ConflictError):
        payment_methods.unarchive_payment_method(db, user, nagad.id)


# --- tags ---


def test_list_tags_counts_usage_per_user(db: Session, user: User, other_user: User) -> None:
    trip = make_tag(db, user, "trip")
    make_tag(db, user, "idle")
    tag_transactions(db, user, trip, 2)
    make_tag(db, other_user, "theirs")
    assert [(t.name, n) for t, n in tags.list_tags(db, user)] == [("idle", 0), ("trip", 2)]


def test_rename_tag_without_conflict_keeps_the_tag(db: Session, user: User) -> None:
    tag = make_tag(db, user, "old")
    tag_transactions(db, user, tag, 1)
    renamed, count = tags.rename_tag(db, user, tag.id, "new")
    assert (renamed.id, renamed.name, count) == (tag.id, "new", 1)


def test_rename_tag_merges_into_existing_without_duplicate_links(db: Session, user: User) -> None:
    src, dst = make_tag(db, user, "src"), make_tag(db, user, "dst")
    shared, *_ = tag_transactions(db, user, src, 2)
    db.add(TransactionTag(transaction_id=shared.id, tag_id=dst.id))
    db.flush()
    merged, count = tags.rename_tag(db, user, src.id, "dst")
    assert (merged.id, count) == (dst.id, 2)
    assert db.get(Tag, src.id) is None


def test_delete_tag_and_missing_tag(db: Session, user: User, other_user: User) -> None:
    tag = make_tag(db, user, "gone")
    tag_transactions(db, user, tag, 1)
    tags.delete_tag(db, user, tag.id)
    assert db.scalar(select(func.count()).select_from(TransactionTag)) == 0
    theirs = make_tag(db, other_user, "theirs")
    for call in (
        lambda: tags.delete_tag(db, user, theirs.id),
        lambda: tags.rename_tag(db, user, theirs.id, "x"),
        lambda: tags.get_tag(db, user, uuid.uuid4()),
    ):
        with pytest.raises(NotFoundError):
            call()


# --- create_user seeds the defaults atomically ---


def test_create_user_rolls_back_when_seeding_fails(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(*_: object) -> None:
        raise RuntimeError("seed failed")

    monkeypatch.setattr(users, "seed_defaults", boom)
    with pytest.raises(RuntimeError):
        users.create_user(db, email="x@example.com", display_name="X", password="pw-123456")  # noqa: S106
    assert users.get_user_by_email(db, "x@example.com") is None
    assert db.scalar(select(func.count()).select_from(Category)) == 0
