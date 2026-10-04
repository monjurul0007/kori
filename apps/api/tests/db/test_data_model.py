import uuid
from datetime import date

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from kori.config import get_settings


def _user(db: Session, email: str = "a@example.com") -> uuid.UUID:
    return db.execute(
        text(
            "INSERT INTO users (email, password_hash, display_name) "
            "VALUES (:e, 'x', 'A') RETURNING id"
        ),
        {"e": email},
    ).scalar_one()


def _category(
    db: Session, user_id: uuid.UUID, name: str = "Food", archived: bool = False
) -> uuid.UUID:
    return db.execute(
        text(
            "INSERT INTO categories (user_id, name, kind, archived_at) "
            "VALUES (:u, :n, 'expense', CASE WHEN :a THEN now() END) RETURNING id"
        ),
        {"u": user_id, "n": name, "a": archived},
    ).scalar_one()


def _tx(db: Session, user_id: uuid.UUID, amount: int = 1000) -> uuid.UUID:
    return db.execute(
        text(
            "INSERT INTO transactions (user_id, type, occurred_on, amount_minor) "
            "VALUES (:u, 'expense', :d, :a) RETURNING id"
        ),
        {"u": user_id, "d": date(2026, 10, 1), "a": amount},
    ).scalar_one()


def _line(db: Session, tx_id: uuid.UUID, cat_id: uuid.UUID, amount: int, position: int = 0) -> None:
    db.execute(
        text(
            "INSERT INTO transaction_lines (transaction_id, category_id, amount_minor, position) "
            "VALUES (:t, :c, :a, :p)"
        ),
        {"t": tx_id, "c": cat_id, "a": amount, "p": position},
    )


def _commit_check(db: Session) -> None:
    """Fire deferred constraint triggers now, as a commit would."""
    db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))


def test_user_email_must_be_lowercase(db: Session) -> None:
    with pytest.raises(IntegrityError):
        _user(db, "Mixed@Example.com")


@pytest.mark.parametrize("amount", [0, -5])
def test_non_positive_transaction_amount_rejected(db: Session, amount: int) -> None:
    user_id = _user(db)
    with pytest.raises(IntegrityError):
        _tx(db, user_id, amount)


def test_duplicate_active_category_name_rejected_case_insensitively(db: Session) -> None:
    user_id = _user(db)
    _category(db, user_id, "Food")
    with pytest.raises(IntegrityError):
        _category(db, user_id, "FOOD")


def test_archived_category_frees_the_name(db: Session) -> None:
    user_id = _user(db)
    _category(db, user_id, "Food", archived=True)
    _category(db, user_id, "food")


def test_transaction_without_lines_rejected_at_commit(db: Session) -> None:
    _tx(db, _user(db))
    with pytest.raises(DBAPIError) as exc:
        _commit_check(db)
    assert exc.value.orig.sqlstate == "23514"  # type: ignore[union-attr]


def test_lines_that_do_not_sum_rejected_at_commit(db: Session) -> None:
    user_id = _user(db)
    tx_id = _tx(db, user_id, 1000)
    _line(db, tx_id, _category(db, user_id), 900)
    with pytest.raises(DBAPIError) as exc:
        _commit_check(db)
    assert exc.value.orig.sqlstate == "23514"  # type: ignore[union-attr]


def test_correct_split_accepted(db: Session) -> None:
    user_id = _user(db)
    tx_id = _tx(db, user_id, 1000)
    _line(db, tx_id, _category(db, user_id, "Food"), 600, 0)
    _line(db, tx_id, _category(db, user_id, "Transport"), 400, 1)
    _commit_check(db)


def test_changing_transaction_amount_rechecks_lines(db: Session) -> None:
    user_id = _user(db)
    tx_id = _tx(db, user_id, 1000)
    _line(db, tx_id, _category(db, user_id), 1000)
    _commit_check(db)
    db.execute(text("SET CONSTRAINTS ALL DEFERRED"))
    db.execute(text("UPDATE transactions SET amount_minor = 2000 WHERE id = :t"), {"t": tx_id})
    with pytest.raises(DBAPIError):
        _commit_check(db)


def test_delete_transaction_cascades_and_skips_check(db: Session) -> None:
    user_id = _user(db)
    tag_id = db.execute(
        text("INSERT INTO tags (user_id, name) VALUES (:u, 'trip') RETURNING id"), {"u": user_id}
    ).scalar_one()
    tx_id = _tx(db, user_id)
    _line(db, tx_id, _category(db, user_id), 1000)
    db.execute(
        text("INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (:t, :g)"),
        {"t": tx_id, "g": tag_id},
    )
    _commit_check(db)
    db.execute(text("SET CONSTRAINTS ALL DEFERRED"))
    db.execute(text("DELETE FROM transactions WHERE id = :t"), {"t": tx_id})
    _commit_check(db)
    for table in ("transaction_lines", "transaction_tags"):
        assert db.execute(text(f"SELECT count(*) FROM {table}")).scalar_one() == 0  # noqa: S608


def test_deleting_category_with_lines_fails(db: Session) -> None:
    user_id = _user(db)
    cat_id = _category(db, user_id)
    _line(db, _tx(db, user_id), cat_id, 1000)
    with pytest.raises(IntegrityError):
        db.execute(text("DELETE FROM categories WHERE id = :c"), {"c": cat_id})


def test_tag_names_lowercase_and_unique_per_user(db: Session) -> None:
    user_id = _user(db)
    db.execute(text("INSERT INTO tags (user_id, name) VALUES (:u, 'trip')"), {"u": user_id})
    with pytest.raises(IntegrityError):
        db.execute(text("INSERT INTO tags (user_id, name) VALUES (:u, 'trip')"), {"u": user_id})


def test_tag_name_must_be_lowercase(db: Session) -> None:
    with pytest.raises(IntegrityError):
        db.execute(text("INSERT INTO tags (user_id, name) VALUES (:u, 'Trip')"), {"u": _user(db)})


def test_deleting_user_cascades_once_transactions_are_gone(db: Session) -> None:
    # RESTRICT on lines.category_id is checked immediately, so a bare DELETE FROM users fails
    # while transactions exist. Account deletion removes transactions first (docs/data-model.md).
    user_id = _user(db)
    cat_id = _category(db, user_id)
    db.execute(
        text("INSERT INTO tags (user_id, name) VALUES (:u, 'x') RETURNING id"), {"u": user_id}
    ).scalar_one()
    _line(db, _tx(db, user_id), cat_id, 1000)
    _commit_check(db)
    with pytest.raises(IntegrityError), db.begin_nested():
        db.execute(text("DELETE FROM users WHERE id = :u"), {"u": user_id})
    db.execute(text("SET CONSTRAINTS ALL DEFERRED"))
    db.execute(text("DELETE FROM transactions WHERE user_id = :u"), {"u": user_id})
    db.execute(text("DELETE FROM users WHERE id = :u"), {"u": user_id})
    _commit_check(db)
    for table in ("categories", "tags"):
        assert db.execute(text(f"SELECT count(*) FROM {table}")).scalar_one() == 0  # noqa: S608


def test_category_confidence_range(db: Session) -> None:
    user_id = _user(db)
    tx_id = _tx(db, user_id)
    with pytest.raises(IntegrityError):
        db.execute(
            text(
                "INSERT INTO transaction_lines "
                "(transaction_id, category_id, amount_minor, category_confidence) "
                "VALUES (:t, :c, 1000, 1.5)"
            ),
            {"t": tx_id, "c": _category(db, user_id)},
        )


def test_migration_round_trip() -> None:
    """upgrade → downgrade → upgrade on a scratch database leaves no stray types or tables."""
    base = make_url(get_settings().database_url)
    name = f"{base.database}_migrate_test"
    url = base.set(database=name)
    admin = create_engine(base.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    cfg = Config("alembic.ini")
    cfg.attributes["url"] = url.render_as_string(hide_password=False)
    try:
        command.upgrade(cfg, "head")
        command.downgrade(cfg, "0001")
        eng = create_engine(url)
        with eng.connect() as conn:
            assert (
                conn.execute(
                    text("SELECT count(*) FROM pg_type WHERE typname = 'category_kind'")
                ).scalar_one()
                == 0
            )
            assert conn.execute(text("SELECT to_regclass('public.users')")).scalar_one() is None
        eng.dispose()
        command.upgrade(cfg, "head")
    finally:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()
