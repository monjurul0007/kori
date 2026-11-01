import uuid
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from kori.budgets import service
from kori.budgets.models import Budget
from kori.common.enums import CategoryKind
from kori.common.errors import UnprocessableError
from kori.users.models import User

from .conftest import PASSWORD, category_id

URL = "/api/v1/budgets"


@pytest.fixture(autouse=True)
def _now(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pin "this month" to 2026-11, so the writable window is 2026-11 to 2027-11."""
    monkeypatch.setattr(service, "current_month", lambda user: "2026-11")


def put(c: TestClient, month: str, category: str | None, amount: str | None) -> Any:
    return c.put(URL, json={"month": month, "category_id": category, "amount": amount})


def month_categories(c: TestClient, month: str) -> dict[str, str]:
    body = c.get(URL, params={"month": month}).json()
    return {b["category"]["name"]: b["amount"] for b in body["categories"]}


def count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Budget)) or 0


def test_requires_login(client: TestClient) -> None:
    assert client.get(URL).status_code == 401
    body = {"month": "2026-11", "category_id": None, "amount": "1"}
    assert client.put(URL, json=body).status_code == 401


def test_empty_by_default(signed_in: TestClient) -> None:
    body = signed_in.get(URL).json()
    assert body == {"month": "2026-11", "overall": None, "categories": []}


def test_carry_forward_change_and_clear(signed_in: TestClient, food: str) -> None:
    r = put(signed_in, "2026-11", food, "5000")
    assert r.status_code == 200
    assert r.json()["month"] == "2026-11"
    assert r.json()["categories"][0]["effective_from"] == "2026-11-01"
    for month in ("2026-11", "2026-12", "2027-03"):
        assert month_categories(signed_in, month) == {"Food & Dining": "5000.00"}
    assert month_categories(signed_in, "2026-10") == {}

    # A change in 2027-01 applies from then on; 2026-12 is untouched.
    put(signed_in, "2027-01", food, "6000.50")
    assert month_categories(signed_in, "2026-12") == {"Food & Dining": "5000.00"}
    assert month_categories(signed_in, "2027-01") == {"Food & Dining": "6000.50"}
    assert month_categories(signed_in, "2027-06") == {"Food & Dining": "6000.50"}

    # Clearing in 2027-02 removes it from then on; 2027-01 keeps it.
    r = put(signed_in, "2027-02", food, None)
    assert r.status_code == 200
    assert r.json()["categories"] == []
    assert month_categories(signed_in, "2027-01") == {"Food & Dining": "6000.50"}
    assert month_categories(signed_in, "2027-05") == {}

    # Setting it again after a clear starts a new run.
    put(signed_in, "2027-04", food, "700")
    assert month_categories(signed_in, "2027-03") == {}
    assert month_categories(signed_in, "2027-04") == {"Food & Dining": "700.00"}


def test_set_twice_updates_the_row(db: Session, signed_in: TestClient, food: str) -> None:
    put(signed_in, "2026-12", food, "100")
    put(signed_in, "2026-12", food, "200")
    put(signed_in, "2026-12", None, "100")
    put(signed_in, "2026-12", None, "300")
    assert count(db) == 2
    body = signed_in.get(URL, params={"month": "2026-12"}).json()
    assert body["overall"] == {"amount": "300.00", "effective_from": "2026-12-01"}
    assert body["categories"][0]["amount"] == "200.00"


def test_overall_limit_is_separate(signed_in: TestClient, food: str) -> None:
    put(signed_in, "2026-11", None, "30000")
    body = put(signed_in, "2026-11", food, "5000").json()
    assert body["overall"]["amount"] == "30000.00"
    assert [c["amount"] for c in body["categories"]] == ["5000.00"]
    body = put(signed_in, "2026-11", None, None).json()
    assert body["overall"] is None
    assert [c["amount"] for c in body["categories"]] == ["5000.00"]


def test_clearing_an_unset_budget_is_a_noop(db: Session, signed_in: TestClient, food: str) -> None:
    assert put(signed_in, "2026-11", food, None).status_code == 200
    assert put(signed_in, "2026-11", None, None).status_code == 200
    assert count(db) == 0
    # Clearing an already cleared budget adds no second marker.
    put(signed_in, "2026-11", food, "10")
    put(signed_in, "2026-12", food, None)
    put(signed_in, "2027-01", food, None)
    assert count(db) == 2


def test_month_window(signed_in: TestClient, food: str) -> None:
    assert put(signed_in, "2027-11", food, "10").status_code == 200  # 12 months ahead
    assert put(signed_in, "2027-12", food, "10").status_code == 422  # 13 months ahead
    r = put(signed_in, "2026-10", food, "10")  # a past month is read-only
    assert r.status_code == 422
    assert r.json()["errors"][0]["loc"] == ["body", "month"]
    assert "request_id" in r.json()
    assert put(signed_in, "2026-11", food, "10").status_code == 200  # this month


def test_invalid_month(db: Session, user: User, signed_in: TestClient, food: str) -> None:
    assert put(signed_in, "2026-13", food, "10").status_code == 422
    assert signed_in.get(URL, params={"month": "2026-13"}).status_code == 422
    with pytest.raises(UnprocessableError):
        service.set_budget(db, user, "nope", None, "10")
    with pytest.raises(UnprocessableError):
        service.get_budgets(db, user, "2026-1")


def test_category_rules(
    db: Session, user: User, other_user: User, signed_in: TestClient, food: str
) -> None:
    salary = category_id(db, user, "Salary", CategoryKind.INCOME)
    foreign = category_id(db, other_user, "Food & Dining")
    for bad in (salary, foreign, str(uuid.uuid4())):
        r = put(signed_in, "2026-11", bad, "10")
        assert r.status_code == 422
        assert r.json()["errors"][0]["loc"] == ["body", "category_id"]
    assert signed_in.post(f"/api/v1/categories/{food}/archive").status_code == 200
    assert put(signed_in, "2026-11", food, "10").status_code == 422
    assert count(db) == 0


@pytest.mark.parametrize("amount", ["0", "-5", "12.345", "abc", "1e3", "", "0.00"])
def test_bad_amounts(signed_in: TestClient, food: str, amount: str) -> None:
    assert put(signed_in, "2026-11", food, amount).status_code == 422


def test_missing_fields(signed_in: TestClient) -> None:
    assert signed_in.put(URL, json={"month": "2026-11", "amount": "5"}).status_code == 422


def test_archived_category_listed_while_budget_in_effect(signed_in: TestClient, food: str) -> None:
    put(signed_in, "2026-11", food, "10")
    signed_in.post(f"/api/v1/categories/{food}/archive")
    item = signed_in.get(URL).json()["categories"][0]
    assert item["category"] == {
        "id": food,
        "name": "Food & Dining",
        "kind": "expense",
        "archived": True,
    }


def test_categories_sorted_by_sort_order_then_name(signed_in: TestClient) -> None:
    for name, order in (("Zeta", 0), ("Alpha", 5), ("Beta", 5), ("Omega", 9)):
        body = {"name": name, "kind": "expense", "sort_order": order}
        cid = signed_in.post("/api/v1/categories", json=body).json()["id"]
        put(signed_in, "2026-11", cid, "10")
    got = [(c["category"]["name"]) for c in signed_in.get(URL).json()["categories"]]
    assert got == ["Zeta", "Alpha", "Beta", "Omega"]


def test_isolation(client: TestClient, other_user: User, signed_in: TestClient, food: str) -> None:
    put(signed_in, "2026-11", food, "5000")
    put(signed_in, "2026-11", None, "9000")
    client.post("/api/v1/auth/logout")
    login = {"email": other_user.email, "password": PASSWORD}
    assert client.post("/api/v1/auth/login", json=login).status_code == 204
    assert client.get(URL).json() == {"month": "2026-11", "overall": None, "categories": []}


def _insert(db: Session, user: User, day: date, amount: int | None = 100) -> None:
    db.execute(
        text("INSERT INTO budgets (user_id, effective_from, amount_minor) VALUES (:u, :d, :a)"),
        {"u": user.id, "d": day, "a": amount},
    )


def test_db_rejects_a_date_that_is_not_the_first(db: Session, user: User) -> None:
    with pytest.raises(IntegrityError), db.begin_nested():
        _insert(db, user, date(2026, 11, 2))


def test_db_rejects_a_non_positive_amount(db: Session, user: User) -> None:
    with pytest.raises(IntegrityError), db.begin_nested():
        _insert(db, user, date(2026, 11, 1), 0)


def test_db_allows_a_null_amount(db: Session, user: User) -> None:
    _insert(db, user, date(2026, 11, 1), None)


def test_db_has_one_overall_row_per_month(db: Session, user: User) -> None:
    _insert(db, user, date(2026, 11, 1))
    _insert(db, user, date(2026, 12, 1))
    with pytest.raises(IntegrityError), db.begin_nested():
        _insert(db, user, date(2026, 11, 1), 200)


def test_service_functions_take_plain_arguments(db: Session, user: User, food: str) -> None:
    result = service.set_budget(db, user, "2026-11", uuid.UUID(food), "1250.50")
    assert result.categories[0].amount == "1250.50"
    assert service.get_budgets(db, user, "2026-11") == result


def test_service_rejects_a_bad_amount_for_ai_callers(db: Session, user: User) -> None:
    with pytest.raises(UnprocessableError) as exc:
        service.set_budget(db, user, "2026-11", None, "12.345")
    assert exc.value.errors[0]["loc"] == ["body", "amount"]
