import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from kori.common.errors import NotFoundError
from kori.tags.models import Tag, TransactionTag
from kori.users.models import User


def list_tags(db: Session, user: User) -> list[tuple[Tag, int]]:
    """Each tag with the number of transactions that use it."""
    stmt = (
        select(Tag, func.count(TransactionTag.transaction_id))
        .outerjoin(TransactionTag, TransactionTag.tag_id == Tag.id)
        .where(Tag.user_id == user.id)
        .group_by(Tag.id)
        .order_by(Tag.name)
    )
    return [(tag, count) for tag, count in db.execute(stmt)]


def get_tag(db: Session, user: User, tag_id: uuid.UUID) -> Tag:
    tag = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.user_id == user.id))
    if tag is None:
        raise NotFoundError("Tag not found")
    return tag


def _usage_count(db: Session, tag_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count()).select_from(TransactionTag).where(TransactionTag.tag_id == tag_id)
        )
        or 0
    )


def rename_tag(db: Session, user: User, tag_id: uuid.UUID, name: str) -> tuple[Tag, int]:
    """Rename a tag. If `name` already exists, merge into that tag and return it instead."""
    tag = get_tag(db, user, tag_id)
    target = db.scalar(
        select(Tag).where(Tag.user_id == user.id, Tag.name == name, Tag.id != tag.id)
    )
    if target is None:
        tag.name = name
        db.flush()
        return tag, _usage_count(db, tag.id)

    already_on_target = select(TransactionTag.transaction_id).where(
        TransactionTag.tag_id == target.id
    )
    moving = db.scalars(
        select(TransactionTag.transaction_id).where(
            TransactionTag.tag_id == tag.id,
            TransactionTag.transaction_id.not_in(already_on_target),
        )
    ).all()
    db.add_all(TransactionTag(transaction_id=t, tag_id=target.id) for t in moving)
    db.flush()
    db.delete(tag)  # the remaining links go with it (ON DELETE CASCADE)
    db.flush()
    return target, _usage_count(db, target.id)


def delete_tag(db: Session, user: User, tag_id: uuid.UUID) -> None:
    """Delete a tag and its links; the transactions themselves stay."""
    tag = get_tag(db, user, tag_id)
    db.execute(delete(TransactionTag).where(TransactionTag.tag_id == tag.id))
    db.delete(tag)
    db.flush()
