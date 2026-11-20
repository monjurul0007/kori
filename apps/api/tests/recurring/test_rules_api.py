import uuid
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.recurring import service
from kori.recurring.models import RecurringRule
from kori.recurring.schemas import RuleIn
from kori.transactions.models import Transaction
from kori.users.models import User

from .helpers import category, payment_method

URL = "/api/v1/recurring-rules"
TODAY = date(2026, 11, 20)  # a Friday


@pytest.fixture(autouse=True)
def _today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service, "_today", lambda user: TODAY)


def body(food: str, **overrides: object) -> dict[str, Any]:
    return {
        "name": "Rent",
        "type": "expense",
        "amount": "15000",
        "category_id": food,
        "frequency": "monthly",
        "start_on": "2026-11-01",
    } | overrides


def make(c: TestClient, food: str, **overrides: object) -> dict[str, Any]:
    r = c.post(URL, json=body(food, **overrides))
    assert r.status_code == 201, r.text
    return r.json()


def error_locs(r: Any) -> list[list[Any]]:
    return [e["loc"] for e in r.json()["errors"]]


def other_rule(db: Session, other_user: User) -> RecurringRule:
    data = RuleIn(
        name="Theirs",
        type="expense",
        amount="10",
        category_id=uuid.UUID(category(db, other_user, "Food & Dining")),
        frequency="monthly",
        start_on=date(2026, 11, 25),
    )
    return service.create_rule(db, other_user, data)


# --- auth and isolation ---------------------------------------------------------------------


def test_every_endpoint_requires_a_session(client: TestClient) -> None:
    some = uuid.uuid4()
    calls = [
        client.get(URL),
        client.post(URL, json={}),
        client.get(f"{URL}/{some}"),
        client.patch(f"{URL}/{some}", json={}),
        client.post(f"{URL}/{some}/pause"),
        client.post(f"{URL}/{some}/resume"),
        client.delete(f"{URL}/{some}"),
    ]
    assert [r.status_code for r in calls] == [401] * 7


def test_another_users_rule_is_404_on_every_route(
    signed_in: TestClient, db: Session, other_user: User
) -> None:
    theirs = other_rule(db, other_user)
    url = f"{URL}/{theirs.id}"
    calls = [
        signed_in.get(url),
        signed_in.patch(url, json={"name": "Mine now"}),
        signed_in.post(f"{url}/pause"),
        signed_in.post(f"{url}/resume"),
        signed_in.delete(url),
    ]
    assert [r.status_code for r in calls] == [404] * 5
    assert theirs.name == "Theirs"
    assert theirs.paused_at is None
    assert signed_in.get(URL, params={"include_ended": True}).json() == []


def test_other_users_category_and_payment_method_are_422(
    signed_in: TestClient, db: Session, other_user: User
) -> None:
    theirs = category(db, other_user, "Food & Dining")
    r = signed_in.post(URL, json=body(theirs, payment_method_id=payment_method(db, other_user)))
    assert r.status_code == 422
    assert error_locs(r) == [["body", "category_id"], ["body", "payment_method_id"]]


# --- create ---------------------------------------------------------------------------------


def test_create_returns_the_rule(signed_in: TestClient, db: Session, user: User, food: str) -> None:
    cash = payment_method(db, user)
    rule = make(
        signed_in, food, payment_method_id=cash, merchant="Landlord", note="Flat 4B", interval=1
    )
    assert rule["name"] == "Rent"
    assert rule["amount"] == "15000.00"
    assert rule["category"]["name"] == "Food & Dining"
    assert rule["payment_method"]["name"] == "Cash"
    assert (rule["merchant"], rule["note"]) == ("Landlord", "Flat 4B")
    assert rule["status"] == "active"
    assert rule["last_error"] is None
    assert signed_in.get(f"{URL}/{rule['id']}").json() == rule


def test_create_never_backfills_a_past_date(signed_in: TestClient, food: str) -> None:
    # Anchored on the 1st, a year ago: the next occurrence is in the future, never in the past.
    rule = make(signed_in, food, start_on="2026-01-01")
    assert rule["next_due_on"] == "2026-12-01"
    assert rule["upcoming"] == ["2026-12-01", "2027-01-01", "2027-02-01"]


def test_a_rule_due_today_starts_today(signed_in: TestClient, food: str) -> None:
    assert make(signed_in, food, start_on="2026-11-20")["next_due_on"] == "2026-11-20"


def test_a_future_start_is_the_first_occurrence(signed_in: TestClient, food: str) -> None:
    assert make(signed_in, food, start_on="2027-03-15")["next_due_on"] == "2027-03-15"


def test_create_does_not_add_transactions(signed_in: TestClient, db: Session, food: str) -> None:
    make(signed_in, food, start_on="2026-01-01")
    assert db.scalar(select(func.count()).select_from(Transaction)) == 0


def test_a_rule_that_ended_before_today_is_ended(signed_in: TestClient, food: str) -> None:
    rule = make(signed_in, food, start_on="2026-01-01", end_on="2026-06-30")
    assert rule["next_due_on"] is None
    assert rule["status"] == "ended"
    assert rule["upcoming"] == []


def test_wrong_kind_and_archived_categories_are_422(
    signed_in: TestClient, db: Session, food: str, salary: str
) -> None:
    r = signed_in.post(URL, json=body(salary))  # an expense needs an expense category
    assert r.status_code == 422
    assert error_locs(r) == [["body", "category_id"]]
    assert signed_in.post(URL, json=body(salary, type="income")).status_code == 201

    from kori.categories.models import Category

    db.get_one(Category, uuid.UUID(food)).archived_at = func.now()
    db.flush()
    r = signed_in.post(URL, json=body(food))
    assert r.status_code == 422
    assert r.json()["errors"][0]["type"] == "archived"


def test_an_archived_payment_method_is_422(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    from kori.payment_methods.models import PaymentMethod

    cash = payment_method(db, user)
    db.get_one(PaymentMethod, uuid.UUID(cash)).archived_at = func.now()
    db.flush()
    r = signed_in.post(URL, json=body(food, payment_method_id=cash))
    assert error_locs(r) == [["body", "payment_method_id"]]


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": ""},
        {"name": "x" * 61},
        {"amount": "0"},
        {"amount": "10.999"},
        {"interval": 0},
        {"interval": 13},
        {"frequency": "daily"},
        {"merchant": "x" * 121},
        {"note": "x" * 501},
        {"start_on": "2026-11-20", "end_on": "2026-11-19"},
    ],
)
def test_invalid_bodies_are_422(signed_in: TestClient, food: str, overrides: dict) -> None:
    assert signed_in.post(URL, json=body(food, **overrides)).status_code == 422


@pytest.mark.parametrize("start_on", ["1999-12-31", "2027-11-21"])
def test_start_must_be_between_2000_and_a_year_ahead(
    signed_in: TestClient, food: str, start_on: str
) -> None:
    r = signed_in.post(URL, json=body(food, start_on=start_on))
    assert r.status_code == 422
    assert error_locs(r) == [["body", "start_on"]]


def test_start_a_year_ahead_is_allowed(signed_in: TestClient, food: str) -> None:
    assert signed_in.post(URL, json=body(food, start_on="2027-11-20")).status_code == 201


# --- list -----------------------------------------------------------------------------------


def test_list_hides_ended_rules_unless_asked(signed_in: TestClient, food: str) -> None:
    soon = make(signed_in, food, name="Soon", start_on="2026-11-22")
    later = make(signed_in, food, name="Later", start_on="2027-02-01")
    paused = make(signed_in, food, name="Paused", start_on="2026-11-25")
    ended = make(signed_in, food, name="Ended", start_on="2026-01-01", end_on="2026-02-01")
    signed_in.post(f"{URL}/{paused['id']}/pause")

    names = [r["name"] for r in signed_in.get(URL).json()]
    assert names == ["Soon", "Paused", "Later"]
    everything = signed_in.get(URL, params={"include_ended": True}).json()
    assert [r["name"] for r in everything] == ["Soon", "Paused", "Later", "Ended"]
    assert {r["id"] for r in everything} == {soon["id"], later["id"], paused["id"], ended["id"]}


# --- patch ----------------------------------------------------------------------------------


def test_patch_changes_details_without_touching_the_schedule(
    signed_in: TestClient, db: Session, food: str
) -> None:
    rule = make(signed_in, food, start_on="2026-11-25")
    other = category(db, signed_in_user(db), "Transport")
    r = signed_in.patch(
        f"{URL}/{rule['id']}",
        json={"name": "Flat rent", "amount": "16000.50", "category_id": other, "note": "up"},
    )
    assert r.status_code == 200
    out = r.json()
    assert (out["name"], out["amount"], out["note"]) == ("Flat rent", "16000.50", "up")
    assert out["category"]["name"] == "Transport"
    assert out["next_due_on"] == rule["next_due_on"] == "2026-11-25"


def signed_in_user(db: Session) -> User:
    return db.scalars(select(User).where(User.email == "owner@example.com")).one()


def test_patch_can_clear_nullable_fields(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    rule = make(
        signed_in,
        food,
        merchant="Landlord",
        note="n",
        payment_method_id=payment_method(db, user),
        end_on="2027-12-31",
    )
    r = signed_in.patch(
        f"{URL}/{rule['id']}",
        json={"merchant": None, "note": None, "payment_method_id": None, "end_on": None},
    )
    out = r.json()
    assert (out["merchant"], out["note"], out["payment_method"], out["end_on"]) == (None,) * 4


@pytest.mark.parametrize(
    "field", ["name", "amount", "category_id", "frequency", "interval", "start_on"]
)
def test_patch_cannot_null_required_fields(signed_in: TestClient, food: str, field: str) -> None:
    rule = make(signed_in, food)
    assert signed_in.patch(f"{URL}/{rule['id']}", json={field: None}).status_code == 422


def test_patch_cannot_change_the_type(signed_in: TestClient, food: str) -> None:
    rule = make(signed_in, food)
    r = signed_in.patch(f"{URL}/{rule['id']}", json={"type": "income"})
    assert r.json()["type"] == "expense"  # an unknown field is ignored


@pytest.mark.parametrize(
    ("change", "expected_next"),
    [
        ({"frequency": "weekly", "start_on": "2026-11-02"}, "2026-11-23"),
        ({"interval": 2, "start_on": "2026-10-10"}, "2026-12-10"),
        ({"start_on": "2026-11-30"}, "2026-11-30"),
    ],
)
def test_patching_the_schedule_recomputes_next_due_from_today(
    signed_in: TestClient, food: str, change: dict, expected_next: str
) -> None:
    rule = make(signed_in, food, start_on="2026-11-25")
    r = signed_in.patch(f"{URL}/{rule['id']}", json=change)
    assert r.status_code == 200
    assert r.json()["next_due_on"] == expected_next


def test_patch_amount_leaves_existing_transactions_alone(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    rule = make(signed_in, food)
    tx = Transaction(
        user_id=user.id,
        type="expense",
        occurred_on=date(2026, 11, 1),
        amount_minor=1_500_000,
        recurring_rule_id=uuid.UUID(rule["id"]),
    )
    db.add(tx)
    db.flush()
    signed_in.patch(f"{URL}/{rule['id']}", json={"amount": "99"})
    db.refresh(tx)
    assert tx.amount_minor == 1_500_000


def test_patch_end_on_before_the_next_due_date_ends_the_rule(
    signed_in: TestClient, food: str
) -> None:
    rule = make(signed_in, food, start_on="2026-11-01")  # next due Dec 1
    out = signed_in.patch(f"{URL}/{rule['id']}", json={"end_on": "2026-11-30"}).json()
    assert (out["next_due_on"], out["status"]) == (None, "ended")


def test_patch_a_later_end_on_revives_an_ended_rule(signed_in: TestClient, food: str) -> None:
    rule = make(signed_in, food, start_on="2026-01-01", end_on="2026-06-01")
    assert rule["status"] == "ended"
    out = signed_in.patch(f"{URL}/{rule['id']}", json={"end_on": None}).json()
    assert (out["next_due_on"], out["status"]) == ("2026-12-01", "active")


def test_patch_end_on_before_start_on_is_422(signed_in: TestClient, food: str) -> None:
    rule = make(signed_in, food, start_on="2026-11-25")
    r = signed_in.patch(f"{URL}/{rule['id']}", json={"end_on": "2026-11-01"})
    assert r.status_code == 422
    assert error_locs(r) == [["body", "end_on"]]


def test_patch_validates_references_and_start(
    signed_in: TestClient, db: Session, other_user: User, food: str, salary: str
) -> None:
    rule = make(signed_in, food)
    url = f"{URL}/{rule['id']}"
    assert signed_in.patch(url, json={"category_id": salary}).status_code == 422
    theirs = category(db, other_user, "Food & Dining")
    assert signed_in.patch(url, json={"category_id": theirs}).status_code == 422
    assert signed_in.patch(url, json={"start_on": "1990-01-01"}).status_code == 422


# --- pause and resume -----------------------------------------------------------------------


def test_pause_and_resume(signed_in: TestClient, food: str) -> None:
    rule = make(signed_in, food, start_on="2026-11-25")
    url = f"{URL}/{rule['id']}"
    paused = signed_in.post(f"{url}/pause").json()
    assert paused["status"] == "paused"
    assert paused["paused_at"] is not None
    assert signed_in.post(f"{url}/pause").json()["paused_at"] == paused["paused_at"]
    resumed = signed_in.post(f"{url}/resume").json()
    assert (resumed["status"], resumed["paused_at"]) == ("active", None)


def test_resume_skips_what_was_missed_while_paused(
    signed_in: TestClient, db: Session, food: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    rule = make(signed_in, food, start_on="2026-11-25")  # next due Nov 25
    url = f"{URL}/{rule['id']}"
    signed_in.post(f"{url}/pause")
    # Weeks pass: the rule was due on Nov 25 and Dec 25 while paused, and now it is Dec 30.
    row = db.get_one(RecurringRule, uuid.UUID(rule["id"]))
    row.last_error = "boom"
    db.flush()
    monkeypatch.setattr(service, "_today", lambda user: date(2026, 12, 30))
    out = signed_in.post(f"{url}/resume").json()
    assert out["next_due_on"] == "2027-01-25"
    assert out["last_error"] is None


def test_resuming_a_rule_that_is_not_paused_changes_nothing(
    signed_in: TestClient, food: str
) -> None:
    rule = make(signed_in, food, start_on="2026-11-25")
    assert signed_in.post(f"{URL}/{rule['id']}/resume").json()["next_due_on"] == "2026-11-25"


# --- delete ---------------------------------------------------------------------------------


def test_delete_keeps_past_transactions(
    signed_in: TestClient, db: Session, user: User, food: str
) -> None:
    rule = make(signed_in, food)
    tx = Transaction(
        user_id=user.id,
        type="expense",
        occurred_on=date(2026, 11, 1),
        amount_minor=100,
        recurring_rule_id=uuid.UUID(rule["id"]),
    )
    db.add(tx)
    db.flush()
    assert signed_in.delete(f"{URL}/{rule['id']}").status_code == 204
    assert signed_in.get(f"{URL}/{rule['id']}").status_code == 404
    db.refresh(tx)
    assert tx.recurring_rule_id is None
    assert tx.amount_minor == 100


def test_unknown_rule_is_404(signed_in: TestClient) -> None:
    assert signed_in.get(f"{URL}/{uuid.uuid4()}").status_code == 404


# --- transactions expose the rule -------------------------------------------------------------


def test_transaction_out_includes_recurring_rule_id(signed_in: TestClient, food: str) -> None:
    r = signed_in.post(
        "/api/v1/transactions",
        json={"type": "expense", "amount": "5", "occurred_on": "2026-09-01", "category_id": food},
    )
    assert r.json()["recurring_rule_id"] is None
