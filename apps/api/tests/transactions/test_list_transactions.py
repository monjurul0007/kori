import base64
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from kori.common.enums import CategoryKind
from kori.common.pagination import Cursor, InvalidCursorError, decode_cursor, encode_cursor
from kori.transactions.models import Transaction
from kori.transactions.schemas import TransactionIn
from kori.transactions.service import create_transaction
from kori.users.models import User

from .helpers import category, payment_method

URL = "/api/v1/transactions"


def add(client: TestClient, food: str, **overrides: object) -> dict:
    payload = {
        "type": "expense",
        "amount": "100.00",
        "occurred_on": "2026-09-10",
        "category_id": food,
    } | overrides
    r = client.post(URL, json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def ids(r) -> list[str]:
    assert r.status_code == 200, r.text
    return [i["id"] for i in r.json()["items"]]


# --- auth and isolation ---------------------------------------------------------------------


def test_list_requires_a_session(client: TestClient) -> None:
    assert client.get(URL).status_code == 401


def test_other_users_rows_never_appear(
    signed_in: TestClient, db: Session, other_user: User, food: str
) -> None:
    other_food = category(db, other_user, "Food & Dining")
    tx = create_transaction(
        db,
        other_user,
        TransactionIn(
            type="expense",
            amount="50.00",
            occurred_on=date(2026, 9, 10),
            category_id=uuid.UUID(other_food),
            merchant="Secret Cafe",
            tags=["private"],
        ),
    )
    mine = add(signed_in, food, merchant="Secret Cafe", tags=["private"])
    for params in ({}, {"q": "secret"}, {"tag": "private"}, {"category_id": other_food}):
        r = signed_in.get(URL, params=params)
        assert tx.id not in {uuid.UUID(i) for i in ids(r)}
    assert ids(signed_in.get(URL, params={"q": "secret"})) == [mine["id"]]
    assert signed_in.get(URL, params={"category_id": other_food}).json()["totals"]["count"] == 0


# --- month and range ------------------------------------------------------------------------


def test_month_filter_returns_that_month_newest_first(
    signed_in: TestClient, db: Session, food: str
) -> None:
    add(signed_in, food, occurred_on="2026-08-31")
    sep1 = add(signed_in, food, occurred_on="2026-09-01")
    sep30 = add(signed_in, food, occurred_on="2026-09-30")
    sep30b = add(signed_in, food, occurred_on="2026-09-30")
    add(signed_in, food, occurred_on="2026-10-01")
    # now() is fixed inside the test transaction, so give the tie a real created_at order.
    db.execute(
        update(Transaction)
        .where(Transaction.id == uuid.UUID(sep30b["id"]))
        .values(created_at=func.now() + timedelta(seconds=1))
    )
    r = signed_in.get(URL, params={"month": "2026-09"})
    assert ids(r) == [sep30b["id"], sep30["id"], sep1["id"]]
    assert r.json()["totals"]["count"] == 3


def test_from_to_is_inclusive_and_cannot_mix_with_month(signed_in: TestClient, food: str) -> None:
    a = add(signed_in, food, occurred_on="2026-09-05")
    b = add(signed_in, food, occurred_on="2026-09-07")
    add(signed_in, food, occurred_on="2026-09-08")
    r = signed_in.get(URL, params={"from": "2026-09-05", "to": "2026-09-07"})
    assert ids(r) == [b["id"], a["id"]]
    assert signed_in.get(URL, params={"month": "2026-09", "from": "2026-09-01"}).status_code == 422
    assert signed_in.get(URL, params={"from": "2026-09-08", "to": "2026-09-01"}).status_code == 422
    assert signed_in.get(URL, params={"month": "2026-13"}).status_code == 422


# --- filters --------------------------------------------------------------------------------


def test_type_payment_method_and_tag_filters(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    salary = category(db, user, "Salary", CategoryKind.INCOME)
    cash = payment_method(db, user)
    e = add(signed_in, food, payment_method_id=cash, tags=["Work"])
    i = add(signed_in, salary, type="income", amount="5000.00")
    assert ids(signed_in.get(URL, params={"type": "income"})) == [i["id"]]
    assert ids(signed_in.get(URL, params={"payment_method_id": cash})) == [e["id"]]
    assert ids(signed_in.get(URL, params={"tag": " WORK "})) == [e["id"]]
    assert ids(signed_in.get(URL, params={"tag": "nope"})) == []


def test_category_filter_matches_any_line_of_a_split(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    transport = category(db, user, "Transport")
    shopping = category(db, user, "Shopping")
    split = add(
        signed_in,
        food,
        amount="300.00",
        category_id=None,
        lines=[
            {"category_id": food, "amount": "100.00"},
            {"category_id": transport, "amount": "200.00"},
        ],
    )
    plain = add(signed_in, shopping)
    assert ids(signed_in.get(URL, params={"category_id": transport})) == [split["id"]]
    both = signed_in.get(URL, params=[("category_id", transport), ("category_id", shopping)])
    assert set(ids(both)) == {split["id"], plain["id"]}
    # A split matching two requested categories is still one row.
    twice = signed_in.get(URL, params=[("category_id", food), ("category_id", transport)])
    assert ids(twice) == [split["id"]]
    assert twice.json()["totals"]["count"] == 1


def test_search_matches_merchant_or_note_ignoring_case(signed_in: TestClient, food: str) -> None:
    a = add(signed_in, food, merchant="Coffee World")
    b = add(signed_in, food, note="Iced COFFEE with a friend")
    add(signed_in, food, merchant="Tea House")
    assert set(ids(signed_in.get(URL, params={"q": "coff"}))) == {a["id"], b["id"]}


def test_search_escapes_like_wildcards(signed_in: TestClient, food: str) -> None:
    pct = add(signed_in, food, merchant="100% Juice")
    add(signed_in, food, merchant="1000 Juice")
    under = add(signed_in, food, merchant="a_b shop")
    add(signed_in, food, merchant="axb shop")
    back = add(signed_in, food, merchant="c\\d shop")
    assert ids(signed_in.get(URL, params={"q": "0% J"})) == [pct["id"]]
    assert ids(signed_in.get(URL, params={"q": "a_b"})) == [under["id"]]
    assert ids(signed_in.get(URL, params={"q": "c\\d"})) == [back["id"]]


@pytest.mark.parametrize("params", [{"q": "a"}, {"q": "x" * 101}, {"limit": 0}, {"limit": 101}])
def test_invalid_query_parameters_are_422(signed_in: TestClient, params: dict) -> None:
    assert signed_in.get(URL, params=params).status_code == 422


# --- totals ---------------------------------------------------------------------------------


def test_totals_cover_the_whole_filtered_set_not_the_page(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    salary = category(db, user, "Salary", CategoryKind.INCOME)
    for _ in range(3):
        add(signed_in, food, amount="10.25")
    add(signed_in, salary, type="income", amount="500.50")
    add(signed_in, food, amount="999.00", occurred_on="2026-08-01")
    r = signed_in.get(URL, params={"month": "2026-09", "limit": 2})
    assert len(r.json()["items"]) == 2
    assert r.json()["totals"] == {"expense": "30.75", "income": "500.50", "count": 4}
    expected = db.scalar(
        select(func.sum(Transaction.amount_minor)).where(
            Transaction.user_id == user.id,
            Transaction.type == "expense",
            Transaction.occurred_on >= date(2026, 9, 1),
            Transaction.occurred_on <= date(2026, 9, 30),
        )
    )
    assert expected == 3075


# --- pagination -----------------------------------------------------------------------------


def seed_many(db: Session, user: User, food: str, n: int) -> list[uuid.UUID]:
    """Rows with many ties on date and created_at, to exercise every tie-breaker."""
    from kori.transactions.models import TransactionLine

    stamp = datetime(2026, 9, 1, 12, tzinfo=UTC)
    made = []
    for i in range(n):
        tx = Transaction(
            user_id=user.id,
            type="expense",
            occurred_on=date(2026, 9, 1) + timedelta(days=i % 5),
            amount_minor=100,
            created_at=stamp + timedelta(seconds=(i // 10) % 3),
        )
        db.add(tx)
        db.flush()
        db.add(TransactionLine(transaction_id=tx.id, category_id=uuid.UUID(food), amount_minor=100))
        made.append(tx.id)
    db.flush()
    return made


def test_paging_returns_every_row_once_even_when_rows_are_inserted(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    made = seed_many(db, user, food, 120)
    seen: list[str] = []
    cursor = None
    pages = 0
    while True:
        params: dict = {"limit": 50} | ({"cursor": cursor} if cursor else {})
        r = signed_in.get(URL, params=params)
        assert r.status_code == 200
        seen += [i["id"] for i in r.json()["items"]]
        cursor = r.json()["next_cursor"]
        pages += 1
        if pages == 1:
            add(signed_in, food, occurred_on="2026-09-20")  # newest row, lands before the cursor
        if cursor is None:
            break
    assert pages == 3
    assert len(seen) == len(set(seen)) == 120
    assert set(seen) == {str(i) for i in made}


def test_last_page_has_no_cursor_and_exact_multiple_does_not_loop(
    signed_in: TestClient, food: str
) -> None:
    for _ in range(4):
        add(signed_in, food)
    r = signed_in.get(URL, params={"limit": 4})
    assert len(r.json()["items"]) == 4
    assert r.json()["next_cursor"] is None


@pytest.mark.parametrize(
    "cursor", ["not-base64!!", base64.urlsafe_b64encode(b"a|b|c").decode(), "e30", ""]
)
def test_invalid_cursor_is_422(signed_in: TestClient, cursor: str) -> None:
    r = signed_in.get(URL, params={"cursor": cursor})
    assert r.status_code == 422
    assert r.json()["errors"][0]["loc"] == ["query", "cursor"]


def test_cursor_round_trip() -> None:
    c = Cursor(date(2026, 9, 1), datetime(2026, 9, 1, 12, 0, 0, 123456, tzinfo=UTC), uuid.uuid4())
    token = encode_cursor(c)
    assert "=" not in token
    assert decode_cursor(token) == c
    with pytest.raises(InvalidCursorError):
        decode_cursor(encode_cursor(c)[:-4])


# --- query count ----------------------------------------------------------------------------


def count_queries(engine: Engine, fn) -> int:
    n = 0

    def hit(*_a, **_k) -> None:
        nonlocal n
        n += 1

    event.listen(engine, "before_cursor_execute", hit)
    try:
        fn()
    finally:
        event.remove(engine, "before_cursor_execute", hit)
    return n


def test_query_count_does_not_grow_with_rows(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    engine = db.get_bind().engine

    def measure() -> int:
        db.expire_all()
        signed_in.get(URL, params={"limit": 1})  # warm the per-request user and session loads
        db.expire_all()
        signed_in.get(URL, params={"limit": 1})
        return count_queries(engine, lambda: signed_in.get(URL, params={"limit": 100}))

    seed_many(db, user, food, 10)
    small = measure()
    seed_many(db, user, food, 90)
    assert measure() == small
