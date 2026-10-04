import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from kori.auth.deps import CurrentUser
from kori.categories import service
from kori.categories.schemas import CategoryCreate, CategoryOut, CategoryUpdate
from kori.common.enums import CategoryKind
from kori.db.session import get_db

router = APIRouter(prefix="/categories", tags=["categories"])

Db = Annotated[Session, Depends(get_db)]


@router.get("")
def list_categories(
    user: CurrentUser,
    db: Db,
    kind: CategoryKind | None = None,
    include_archived: Annotated[bool, Query()] = False,
) -> list[CategoryOut]:
    rows = service.list_categories(db, user, kind=kind, include_archived=include_archived)
    return [CategoryOut.model_validate(r) for r in rows]


@router.post("", status_code=201)
def create_category(body: CategoryCreate, user: CurrentUser, db: Db) -> CategoryOut:
    return CategoryOut.model_validate(service.create_category(db, user, body))


@router.patch("/{category_id}")
def update_category(
    category_id: uuid.UUID, body: CategoryUpdate, user: CurrentUser, db: Db
) -> CategoryOut:
    return CategoryOut.model_validate(service.update_category(db, user, category_id, body))


@router.post("/{category_id}/archive")
def archive_category(category_id: uuid.UUID, user: CurrentUser, db: Db) -> CategoryOut:
    return CategoryOut.model_validate(service.archive_category(db, user, category_id))


@router.post("/{category_id}/unarchive")
def unarchive_category(category_id: uuid.UUID, user: CurrentUser, db: Db) -> CategoryOut:
    return CategoryOut.model_validate(service.unarchive_category(db, user, category_id))
