import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from kori.auth.deps import CurrentUser
from kori.db.session import get_db
from kori.tags import service
from kori.tags.schemas import TagOut, TagUpdate

router = APIRouter(prefix="/tags", tags=["tags"])

Db = Annotated[Session, Depends(get_db)]


@router.get("")
def list_tags(user: CurrentUser, db: Db) -> list[TagOut]:
    return [
        TagOut(id=tag.id, name=tag.name, usage_count=count)
        for tag, count in service.list_tags(db, user)
    ]


@router.patch("/{tag_id}")
def rename_tag(tag_id: uuid.UUID, body: TagUpdate, user: CurrentUser, db: Db) -> TagOut:
    """Rename a tag. If the new name exists, the tag is merged into it and that tag returned."""
    tag, count = service.rename_tag(db, user, tag_id, body.name)
    return TagOut(id=tag.id, name=tag.name, usage_count=count)


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: uuid.UUID, user: CurrentUser, db: Db) -> Response:
    service.delete_tag(db, user, tag_id)
    return Response(status_code=204)
