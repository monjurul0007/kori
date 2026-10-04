import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from kori.users.models import User

URL = "/api/v1/categories"


def _find(client: TestClient, name: str, **params: str) -> dict:
    return next(c for c in client.get(URL, params=params).json() if c["name"] == name)


def test_list_returns_defaults_and_filters_by_kind(signed_in: TestClient) -> None:
    assert len(signed_in.get(URL).json()) == 16
    income = signed_in.get(URL, params={"kind": "income"}).json()
    assert [c["name"] for c in income] == ["Salary", "Freelance", "Gifts Received", "Other Income"]


def test_create_trims_the_name(signed_in: TestClient) -> None:
    r = signed_in.post(URL, json={"name": "  Pets  ", "kind": "expense", "icon": "paw-print"})
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Pets"
    assert body["icon"] == "paw-print"
    assert body["archived_at"] is None


def test_create_rejects_blank_and_unknown_kind(signed_in: TestClient) -> None:
    assert signed_in.post(URL, json={"name": "   ", "kind": "expense"}).status_code == 422
    assert signed_in.post(URL, json={"name": "X", "kind": "nope"}).status_code == 422


def test_duplicate_name_is_a_409_problem(signed_in: TestClient) -> None:
    r = signed_in.post(URL, json={"name": "rent", "kind": "expense"})
    assert r.status_code == 409
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["request_id"]


def test_same_name_is_allowed_in_the_other_kind(signed_in: TestClient) -> None:
    assert signed_in.post(URL, json={"name": "Rent", "kind": "income"}).status_code == 201


def test_patch_updates_only_sent_fields(signed_in: TestClient) -> None:
    rent = _find(signed_in, "Rent")
    r = signed_in.patch(f"{URL}/{rent['id']}", json={"color": "#112233", "sort_order": 99})
    assert r.status_code == 200
    body = r.json()
    assert (body["name"], body["icon"], body["color"], body["sort_order"]) == (
        "Rent",
        "house",
        "#112233",
        99,
    )
    r = signed_in.patch(f"{URL}/{rent['id']}", json={"icon": None})
    assert r.json()["icon"] is None


def test_rename_to_existing_name_is_409_but_own_name_is_fine(signed_in: TestClient) -> None:
    rent = _find(signed_in, "Rent")
    assert signed_in.patch(f"{URL}/{rent['id']}", json={"name": "SHOPPING"}).status_code == 409
    assert signed_in.patch(f"{URL}/{rent['id']}", json={"name": "RENT"}).status_code == 200


def test_archive_unarchive_and_list_filter(signed_in: TestClient) -> None:
    rent = _find(signed_in, "Rent")
    r = signed_in.post(f"{URL}/{rent['id']}/archive")
    assert r.status_code == 200
    assert r.json()["archived_at"] is not None
    assert all(c["name"] != "Rent" for c in signed_in.get(URL).json())
    assert _find(signed_in, "Rent", include_archived="true")["archived_at"] is not None
    assert signed_in.post(f"{URL}/{rent['id']}/unarchive").json()["archived_at"] is None
    assert _find(signed_in, "Rent")["id"] == rent["id"]


def test_archived_name_can_be_reused_but_then_cannot_unarchive(signed_in: TestClient) -> None:
    rent = _find(signed_in, "Rent")
    signed_in.post(f"{URL}/{rent['id']}/archive")
    assert signed_in.post(URL, json={"name": "Rent", "kind": "expense"}).status_code == 201
    assert signed_in.post(f"{URL}/{rent['id']}/unarchive").status_code == 409


def test_requires_a_session(client: TestClient, user: User) -> None:
    some_id = uuid.uuid4()
    assert client.get(URL).status_code == 401
    assert client.post(URL, json={"name": "X", "kind": "expense"}).status_code == 401
    assert client.patch(f"{URL}/{some_id}", json={"name": "X"}).status_code == 401
    assert client.post(f"{URL}/{some_id}/archive").status_code == 401
    assert client.post(f"{URL}/{some_id}/unarchive").status_code == 401


def test_isolation_other_users_ids_are_404(
    signed_in: TestClient, db: Session, other_user: User
) -> None:
    from sqlalchemy import select

    from kori.categories.models import Category

    theirs = db.scalars(select(Category).where(Category.user_id == other_user.id)).first()
    assert theirs is not None
    url = f"{URL}/{theirs.id}"
    assert signed_in.patch(url, json={"name": "Hijack"}).status_code == 404
    assert signed_in.post(f"{url}/archive").status_code == 404
    assert signed_in.post(f"{url}/unarchive").status_code == 404
    assert len(signed_in.get(URL).json()) == 16  # the list never includes theirs
