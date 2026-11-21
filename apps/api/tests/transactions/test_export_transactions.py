import csv
import io
import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from kori.common.enums import CategoryKind
from kori.transactions.csv_export import COLUMNS, guard
from kori.transactions.schemas import TransactionIn
from kori.transactions.service import create_transaction
from kori.users.models import User

from .helpers import category

URL = "/api/v1/transactions"
EXPORT = f"{URL}/export.csv"


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


def parse(r) -> list[dict[str, str]]:
    assert r.status_code == 200, r.text
    text = r.content.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text, newline="")))


def test_requires_a_session(client: TestClient) -> None:
    assert client.get(EXPORT).status_code == 401


def test_headers_and_column_order(signed_in: TestClient, food: str) -> None:
    add(signed_in, food)
    r = signed_in.get(EXPORT, params={"month": "2026-09"})
    assert r.headers["content-type"] == "text/csv; charset=utf-8"
    assert r.headers["cache-control"] == "no-store"
    assert (
        r.headers["content-disposition"] == 'attachment; filename="kori-transactions-2026-09.csv"'
    )
    assert r.content.startswith(b"\xef\xbb\xbf")
    first_line = r.content.decode("utf-8-sig").split("\r\n")[0]
    assert first_line == "date,type,amount,category,merchant,note,payment_method,tags,source,id"
    assert first_line.split(",") == COLUMNS


def test_filenames(signed_in: TestClient) -> None:
    def name(**params: str) -> str:
        r = signed_in.get(EXPORT, params=params)
        return r.headers["content-disposition"]

    assert name().endswith('kori-transactions-all.csv"')
    assert name(**{"from": "2026-01-01", "to": "2026-02-28"}).endswith(
        'kori-transactions-2026-01-01-to-2026-02-28.csv"'
    )


def test_rows_oldest_first_with_plain_amounts(signed_in: TestClient, food: str) -> None:
    newer = add(signed_in, food, occurred_on="2026-09-12", amount="1250.50", merchant="Newer")
    older = add(
        signed_in, food, occurred_on="2026-09-01", amount="5.00", note="n", tags=["lunch", "work"]
    )
    rows = parse(signed_in.get(EXPORT))
    assert [r["id"] for r in rows] == [older["id"], newer["id"]]
    assert rows[0]["date"] == "2026-09-01"
    assert rows[0]["amount"] == "5.00"
    assert rows[0]["category"] == "Food & Dining"
    assert rows[0]["tags"] == "lunch;work"
    assert rows[0]["source"] == "manual"
    assert rows[1]["amount"] == "1250.50"


def test_split_category_format(signed_in: TestClient, db: Session, user: User, food: str) -> None:
    health = category(db, user, "Health & Medicine")
    add(
        signed_in,
        food,
        amount="2450.00",
        category_id=None,
        lines=[
            {"category_id": food, "amount": "2000.00"},
            {"category_id": health, "amount": "450.00"},
        ],
    )
    (row,) = parse(signed_in.get(EXPORT))
    assert row["category"] == "Split: Food & Dining 2000.00; Health & Medicine 450.00"


def test_filter_parity_with_the_list(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    add(signed_in, food, merchant="Cafe Rio", tags=["x"])
    add(signed_in, food, occurred_on="2026-08-01")
    salary = category(db, user, "Salary", CategoryKind.INCOME)
    add(signed_in, food, merchant="Bonus", type="income", category_id=salary)
    for params in (
        {},
        {"month": "2026-09"},
        {"type": "expense"},
        {"category_id": food},
        {"tag": "x"},
        {"q": "rio"},
        {"from": "2026-08-15"},
    ):
        listed = signed_in.get(URL, params=params).json()["totals"]["count"]
        assert len(parse(signed_in.get(EXPORT, params=params))) == listed, params


def test_formula_cells_are_neutralised(signed_in: TestClient, food: str) -> None:
    add(signed_in, food, merchant='=HYPERLINK("http://x")', note="@cmd", tags=["ok"])
    (row,) = parse(signed_in.get(EXPORT))
    assert row["merchant"] == '\'=HYPERLINK("http://x")'
    assert row["note"] == "'@cmd"


def test_guard() -> None:
    for bad in ("=1", "+1", "-1", "@a", "\tx", "\rx"):
        assert guard(bad) == "'" + bad
    assert guard("safe") == "safe"
    assert guard("") == ""


def test_bangla_text_round_trips(signed_in: TestClient, food: str) -> None:
    add(signed_in, food, merchant="চায়ের দোকান", note='কমা, "quote"\nনতুন লাইন')
    (row,) = parse(signed_in.get(EXPORT))
    assert row["merchant"] == "চায়ের দোকান"
    assert row["note"] == 'কমা, "quote"\nনতুন লাইন'


def test_other_users_rows_never_appear(
    signed_in: TestClient, db: Session, other_user: User, food: str
) -> None:
    other_food = category(db, other_user, "Food & Dining")
    create_transaction(
        db,
        other_user,
        TransactionIn(
            type="expense",
            amount="50.00",
            occurred_on=date(2026, 9, 10),
            category_id=uuid.UUID(other_food),
            merchant="Secret Cafe",
        ),
    )
    add(signed_in, food, merchant="Mine")
    rows = parse(signed_in.get(EXPORT))
    assert [r["merchant"] for r in rows] == ["Mine"]


def test_invalid_filters_are_422(signed_in: TestClient) -> None:
    r = signed_in.get(EXPORT, params={"month": "2026-09", "from": "2026-09-01"})
    assert r.status_code == 422


def test_query_count_does_not_grow_per_row(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    def run(n: int) -> int:
        for _ in range(n):
            create_transaction(
                db,
                user,
                TransactionIn(
                    type="expense",
                    amount="1.00",
                    occurred_on=date(2026, 9, 1),
                    category_id=uuid.UUID(food),
                    tags=["t"],
                ),
            )
        count = 0

        def tick(*_: object) -> None:
            nonlocal count
            count += 1

        event.listen(db.get_bind(), "before_cursor_execute", tick)
        try:
            assert signed_in.get(EXPORT).status_code == 200
        finally:
            event.remove(db.get_bind(), "before_cursor_execute", tick)
        return count

    few = run(5)
    many = run(1200)
    # One query for the rows plus one per relationship per batch of 500: bounded by batches.
    assert many <= few + 3 * 3
