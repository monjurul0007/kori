import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from kori.payment_methods.models import PaymentMethod
from kori.users.models import User

URL = "/api/v1/payment-methods"


def _find(client: TestClient, name: str, **params: str) -> dict:
    return next(p for p in client.get(URL, params=params).json() if p["name"] == name)


def test_list_returns_defaults_in_order(signed_in: TestClient) -> None:
    rows = signed_in.get(URL).json()
    assert [(p["name"], p["kind"]) for p in rows] == [
        ("Cash", "cash"),
        ("bKash", "mobile_wallet"),
        ("Nagad", "mobile_wallet"),
        ("Card", "card"),
    ]


def test_create_and_duplicate(signed_in: TestClient) -> None:
    r = signed_in.post(URL, json={"name": " Rocket ", "kind": "mobile_wallet"})
    assert r.status_code == 201
    assert r.json()["name"] == "Rocket"
    dup = signed_in.post(URL, json={"name": "BKASH", "kind": "mobile_wallet"})
    assert dup.status_code == 409
    assert dup.headers["content-type"].startswith("application/problem+json")


def test_patch_and_rename_conflict(signed_in: TestClient) -> None:
    cash = _find(signed_in, "Cash")
    r = signed_in.patch(f"{URL}/{cash['id']}", json={"kind": "other", "sort_order": 7})
    assert (r.json()["name"], r.json()["kind"], r.json()["sort_order"]) == ("Cash", "other", 7)
    assert signed_in.patch(f"{URL}/{cash['id']}", json={"name": "nagad"}).status_code == 409


def test_archive_unarchive_and_list_filter(signed_in: TestClient) -> None:
    nagad = _find(signed_in, "Nagad")
    assert signed_in.post(f"{URL}/{nagad['id']}/archive").json()["archived_at"] is not None
    assert all(p["name"] != "Nagad" for p in signed_in.get(URL).json())
    assert _find(signed_in, "Nagad", include_archived="true")["id"] == nagad["id"]
    assert signed_in.post(f"{URL}/{nagad['id']}/unarchive").json()["archived_at"] is None


def test_requires_a_session(client: TestClient, user: User) -> None:
    some_id = uuid.uuid4()
    assert client.get(URL).status_code == 401
    assert client.post(URL, json={"name": "X", "kind": "cash"}).status_code == 401
    assert client.patch(f"{URL}/{some_id}", json={"name": "X"}).status_code == 401
    assert client.post(f"{URL}/{some_id}/archive").status_code == 401
    assert client.post(f"{URL}/{some_id}/unarchive").status_code == 401


def test_isolation_other_users_ids_are_404(
    signed_in: TestClient, db: Session, other_user: User
) -> None:
    theirs = db.scalars(select(PaymentMethod).where(PaymentMethod.user_id == other_user.id)).first()
    assert theirs is not None
    url = f"{URL}/{theirs.id}"
    assert signed_in.patch(url, json={"name": "Hijack"}).status_code == 404
    assert signed_in.post(f"{url}/archive").status_code == 404
    assert signed_in.post(f"{url}/unarchive").status_code == 404
