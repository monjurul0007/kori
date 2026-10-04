import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from kori.common.enums import TransactionType
from kori.tags.models import Tag, TransactionTag
from kori.transactions.models import Transaction
from kori.users.models import User

URL = "/api/v1/tags"


def make_tag(db: Session, user: User, name: str) -> Tag:
    tag = Tag(user_id=user.id, name=name)
    db.add(tag)
    db.flush()
    return tag


def tag_transactions(db: Session, user: User, tag: Tag, count: int) -> list[Transaction]:
    txs = [
        Transaction(
            user_id=user.id,
            type=TransactionType.EXPENSE,
            occurred_on=date(2026, 9, 1),
            amount_minor=100,
        )
        for _ in range(count)
    ]
    db.add_all(txs)
    db.flush()
    db.add_all(TransactionTag(transaction_id=t.id, tag_id=tag.id) for t in txs)
    db.flush()
    return txs


def test_list_includes_usage_counts(signed_in: TestClient, db: Session, user: User) -> None:
    trip = make_tag(db, user, "trip")
    make_tag(db, user, "unused")
    tag_transactions(db, user, trip, 2)
    rows = {t["name"]: t["usage_count"] for t in signed_in.get(URL).json()}
    assert rows == {"trip": 2, "unused": 0}


def test_rename_normalizes_the_name(signed_in: TestClient, db: Session, user: User) -> None:
    tag = make_tag(db, user, "old")
    r = signed_in.patch(f"{URL}/{tag.id}", json={"name": "  Eid  Shopping "})
    assert r.status_code == 200
    assert r.json()["name"] == "eid-shopping"


@pytest.mark.parametrize("name", ["", "   ", "x" * 31])
def test_rename_rejects_bad_names(
    signed_in: TestClient, db: Session, user: User, name: str
) -> None:
    tag = make_tag(db, user, "old")
    assert signed_in.patch(f"{URL}/{tag.id}", json={"name": name}).status_code == 422


def test_rename_to_existing_name_merges(signed_in: TestClient, db: Session, user: User) -> None:
    src, dst = make_tag(db, user, "src"), make_tag(db, user, "dst")
    only_src = tag_transactions(db, user, src, 2)
    both = only_src[0]
    db.add(TransactionTag(transaction_id=both.id, tag_id=dst.id))
    tag_transactions(db, user, dst, 1)
    db.flush()

    r = signed_in.patch(f"{URL}/{src.id}", json={"name": "DST"})
    assert r.status_code == 200
    assert r.json() == {"id": str(dst.id), "name": "dst", "usage_count": 3}
    assert db.get(Tag, src.id) is None
    assert signed_in.get(URL).json() == [r.json()]


def test_delete_removes_links_but_not_transactions(
    signed_in: TestClient, db: Session, user: User
) -> None:
    tag = make_tag(db, user, "trip")
    txs = tag_transactions(db, user, tag, 2)
    assert signed_in.delete(f"{URL}/{tag.id}").status_code == 204
    assert db.scalars(select(TransactionTag)).all() == []
    assert db.get(Transaction, txs[0].id) is not None
    assert signed_in.get(URL).json() == []


def test_requires_a_session(client: TestClient, user: User) -> None:
    some_id = uuid.uuid4()
    assert client.get(URL).status_code == 401
    assert client.patch(f"{URL}/{some_id}", json={"name": "x"}).status_code == 401
    assert client.delete(f"{URL}/{some_id}").status_code == 401


def test_isolation_other_users_ids_are_404(
    signed_in: TestClient, db: Session, other_user: User
) -> None:
    theirs = make_tag(db, other_user, "theirs")
    assert signed_in.patch(f"{URL}/{theirs.id}", json={"name": "mine"}).status_code == 404
    assert signed_in.delete(f"{URL}/{theirs.id}").status_code == 404
    assert signed_in.get(URL).json() == []
    assert db.get(Tag, theirs.id) is not None


def test_merge_never_crosses_users(
    signed_in: TestClient, db: Session, user: User, other_user: User
) -> None:
    mine = make_tag(db, user, "a")
    make_tag(db, other_user, "b")
    r = signed_in.patch(f"{URL}/{mine.id}", json={"name": "b"})
    assert r.status_code == 200
    assert r.json()["id"] == str(mine.id)
