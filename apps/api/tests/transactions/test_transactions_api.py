import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.categories.models import Category
from kori.common.enums import CategoryKind
from kori.tags.models import Tag, TransactionTag
from kori.transactions.models import Transaction, TransactionLine
from kori.users.models import User

from .helpers import category, payment_method

URL = "/api/v1/transactions"


def body(food: str, **overrides: object) -> dict:
    return {
        "type": "expense",
        "amount": "250.50",
        "occurred_on": "2026-09-30",
        "category_id": food,
    } | overrides


def count(db: Session, model: type) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def error_locs(r) -> list[list]:
    return [e["loc"] for e in r.json()["errors"]]


# --- auth ---------------------------------------------------------------------------------


def test_every_endpoint_requires_a_session(client: TestClient) -> None:
    tx_id = uuid.uuid4()
    assert client.post(URL, json={}).status_code == 401
    assert client.get(f"{URL}/{tx_id}").status_code == 401
    assert client.put(f"{URL}/{tx_id}", json={}).status_code == 401
    assert client.delete(f"{URL}/{tx_id}").status_code == 401


# --- create -------------------------------------------------------------------------------


def test_create_with_category_shorthand_makes_one_line(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    cash = payment_method(db, user)
    r = signed_in.post(
        URL,
        json=body(
            food, merchant="  Star Kabab ", note="lunch", payment_method_id=cash, tags=["Work"]
        ),
    )
    assert r.status_code == 201
    out = r.json()
    assert r.headers["location"] == f"/api/v1/transactions/{out['id']}"
    assert out["amount"] == "250.50"
    assert out["merchant"] == "Star Kabab"
    assert out["is_split"] is False
    assert out["source"] == "manual"
    assert out["payment_method"] == {"id": cash, "name": "Cash"}
    assert out["tags"] == ["work"]
    assert len(out["lines"]) == 1
    line = out["lines"][0]
    assert line["amount"] == "250.50"
    assert line["category_source"] == "user"
    assert line["category"] == {"id": food, "name": "Food & Dining", "kind": "expense"}
    assert signed_in.get(f"{URL}/{out['id']}").json() == out


def test_create_split_with_three_lines(signed_in: TestClient, db: Session, user: User) -> None:
    ids = [category(db, user, n) for n in ("Groceries & Bazar", "Transport", "Other")]
    lines = [
        {"category_id": ids[0], "amount": "100.00"},
        {"category_id": ids[1], "amount": "50.25"},
        {"category_id": ids[2], "amount": "0.25"},
    ]
    r = signed_in.post(URL, json=body("", amount="150.50", category_id=None, lines=lines))
    assert r.status_code == 201
    out = r.json()
    assert out["is_split"] is True
    assert [ln["amount"] for ln in out["lines"]] == ["100.00", "50.25", "0.25"]


def test_income_uses_an_income_category(signed_in: TestClient, db: Session, user: User) -> None:
    salary = category(db, user, "Salary", CategoryKind.INCOME)
    r = signed_in.post(URL, json=body(salary, type="income", amount="50000"))
    assert r.status_code == 201
    assert r.json()["amount"] == "50000.00"


def test_split_that_does_not_add_up_is_422(signed_in: TestClient, db: Session, user: User) -> None:
    other = category(db, user, "Other")
    lines = [{"category_id": other, "amount": "100"}, {"category_id": other, "amount": "50"}]
    r = signed_in.post(URL, json=body("", amount="151", category_id=None, lines=lines))
    assert r.status_code == 422
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["request_id"]
    assert count(db, Transaction) == 0


@pytest.mark.parametrize("amount", ["12.345", "-5", "abc", "0", "", "1e3", 12.5, 100])
def test_bad_amounts_are_422(signed_in: TestClient, food: str, amount: object) -> None:
    r = signed_in.post(URL, json=body(food, amount=amount))
    assert r.status_code == 422
    assert ["body", "amount"] in error_locs(r)


def test_category_and_lines_are_mutually_exclusive(signed_in: TestClient, food: str) -> None:
    lines = [{"category_id": food, "amount": "250.50"}]
    assert signed_in.post(URL, json=body(food, lines=lines)).status_code == 422
    neither = body(food)
    del neither["category_id"]
    assert signed_in.post(URL, json=neither).status_code == 422


def test_line_count_bounds(signed_in: TestClient, food: str) -> None:
    assert signed_in.post(URL, json=body("", category_id=None, lines=[])).status_code == 422
    many = [{"category_id": food, "amount": "1"}] * 21
    r = signed_in.post(URL, json=body("", amount="21", category_id=None, lines=many))
    assert r.status_code == 422
    twenty = [{"category_id": food, "amount": "1"}] * 20
    r = signed_in.post(URL, json=body("", amount="20", category_id=None, lines=twenty))
    assert r.status_code == 201


def test_wrong_kind_category_is_422(signed_in: TestClient, db: Session, user: User) -> None:
    salary = category(db, user, "Salary", CategoryKind.INCOME)
    r = signed_in.post(URL, json=body(salary))  # an expense with an income category
    assert r.status_code == 422
    assert error_locs(r) == [["body", "category_id"]]


def test_archived_category_is_422(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    signed_in.post(f"/api/v1/categories/{food}/archive")
    r = signed_in.post(URL, json=body(food))
    assert r.status_code == 422
    assert r.json()["errors"][0]["type"] == "archived"


def test_other_users_category_and_payment_method_are_422(
    signed_in: TestClient, db: Session, other_user: User, food: str
) -> None:
    theirs = category(db, other_user, "Food & Dining")
    r = signed_in.post(URL, json=body(theirs, payment_method_id=payment_method(db, other_user)))
    assert r.status_code == 422
    assert sorted(error_locs(r)) == [["body", "category_id"], ["body", "payment_method_id"]]
    assert {e["type"] for e in r.json()["errors"]} == {"not_found"}


def test_split_line_errors_point_at_the_line(
    signed_in: TestClient, db: Session, other_user: User, food: str
) -> None:
    theirs = category(db, other_user, "Other")
    lines = [{"category_id": food, "amount": "1"}, {"category_id": theirs, "amount": "1"}]
    r = signed_in.post(URL, json=body("", amount="2", category_id=None, lines=lines))
    assert error_locs(r) == [["body", "lines", 1, "category_id"]]


def test_archived_payment_method_is_422(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    cash = payment_method(db, user)
    signed_in.post(f"/api/v1/payment-methods/{cash}/archive")
    r = signed_in.post(URL, json=body(food, payment_method_id=cash))
    assert r.status_code == 422
    assert error_locs(r) == [["body", "payment_method_id"]]


def test_date_bounds(signed_in: TestClient, food: str) -> None:
    today = date.today()
    assert signed_in.post(URL, json=body(food, occurred_on="1999-12-31")).status_code == 422
    assert signed_in.post(URL, json=body(food, occurred_on="2000-01-01")).status_code == 201
    tomorrow = (today + timedelta(days=2)).isoformat()
    assert signed_in.post(URL, json=body(food, occurred_on=tomorrow)).status_code == 422
    assert signed_in.post(URL, json=body(food, occurred_on=today.isoformat())).status_code == 201


def test_tags_are_case_insensitive_reused_and_limited(
    signed_in: TestClient, db: Session, food: str
) -> None:
    a = signed_in.post(URL, json=body(food, tags=["Work", "road trip"])).json()
    b = signed_in.post(URL, json=body(food, tags=["WORK", " work ", "Eid"])).json()
    assert a["tags"] == ["road-trip", "work"]
    assert b["tags"] == ["eid", "work"]
    assert count(db, Tag) == 3
    too_many = [f"t{i}" for i in range(11)]
    assert signed_in.post(URL, json=body(food, tags=too_many)).status_code == 422
    assert signed_in.post(URL, json=body(food, tags=too_many[:10])).status_code == 201
    assert signed_in.post(URL, json=body(food, tags=["x" * 31])).status_code == 422


def test_rejects_unknown_type_and_bad_text(signed_in: TestClient, food: str) -> None:
    assert signed_in.post(URL, json=body(food, type="transfer")).status_code == 422
    assert signed_in.post(URL, json=body(food, merchant="x" * 121)).status_code == 422
    assert signed_in.post(URL, json=body(food, note="x" * 501)).status_code == 422


# --- get / put / delete -------------------------------------------------------------------


def test_put_replaces_everything(signed_in: TestClient, db: Session, user: User, food: str) -> None:
    other = category(db, user, "Other")
    created = signed_in.post(URL, json=body(food, merchant="Old", tags=["a", "b"])).json()
    lines = [{"category_id": food, "amount": "100"}, {"category_id": other, "amount": "50"}]
    r = signed_in.put(
        f"{URL}/{created['id']}",
        json=body("", amount="150", category_id=None, lines=lines, tags=["b", "c"]),
    )
    assert r.status_code == 200
    out = r.json()
    assert out["id"] == created["id"]
    assert out["amount"] == "150.00"
    assert out["merchant"] is None
    assert out["is_split"] is True
    assert out["tags"] == ["b", "c"]
    assert out["created_at"] == created["created_at"]
    assert count(db, TransactionLine) == 2
    assert count(db, TransactionTag) == 2
    # and back to a single line
    r = signed_in.put(f"{URL}/{created['id']}", json=body(other, amount="9.99"))
    assert [ln["amount"] for ln in r.json()["lines"]] == ["9.99"]
    assert count(db, TransactionLine) == 1


def test_failed_put_leaves_the_row_unchanged(signed_in: TestClient, food: str) -> None:
    created = signed_in.post(URL, json=body(food, merchant="Keep", tags=["keep"])).json()
    bad = body(
        food,
        amount="999",
        merchant="Changed",
        tags=["changed"],
        payment_method_id=str(uuid.uuid4()),
    )
    assert signed_in.put(f"{URL}/{created['id']}", json=bad).status_code == 422
    assert signed_in.put(f"{URL}/{created['id']}", json=body(food, amount="abc")).status_code == 422
    assert signed_in.get(f"{URL}/{created['id']}").json() == created


def test_delete_cascades(signed_in: TestClient, db: Session, food: str) -> None:
    created = signed_in.post(URL, json=body(food, tags=["x"])).json()
    assert signed_in.delete(f"{URL}/{created['id']}").status_code == 204
    assert signed_in.get(f"{URL}/{created['id']}").status_code == 404
    assert signed_in.delete(f"{URL}/{created['id']}").status_code == 404
    assert count(db, Transaction) == 0
    assert count(db, TransactionLine) == 0
    assert count(db, TransactionTag) == 0
    assert count(db, Tag) == 1  # tags outlive their transactions
    assert count(db, Category) > 0


def test_unknown_id_is_404_and_bad_id_is_422(signed_in: TestClient) -> None:
    assert signed_in.get(f"{URL}/{uuid.uuid4()}").status_code == 404
    assert signed_in.get(f"{URL}/nope").status_code == 422


# --- isolation ----------------------------------------------------------------------------


def test_another_users_transaction_is_404(
    signed_in: TestClient, db: Session, other_user: User
) -> None:
    theirs = Transaction(
        user_id=other_user.id, type="expense", occurred_on=date(2026, 9, 1), amount_minor=100
    )
    db.add(theirs)
    db.flush()
    db.add(
        TransactionLine(
            transaction_id=theirs.id,
            category_id=uuid.UUID(category(db, other_user, "Other")),
            amount_minor=100,
        )
    )
    db.flush()
    mine = category(db, signed_in_user(db), "Other")
    url = f"{URL}/{theirs.id}"
    assert signed_in.get(url).status_code == 404
    assert signed_in.put(url, json=body(mine, amount="1")).status_code == 404
    assert signed_in.delete(url).status_code == 404
    assert db.get(Transaction, theirs.id) is not None


def signed_in_user(db: Session) -> User:
    return db.scalars(select(User).where(User.email == "owner@example.com")).one()
