import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from kori.auth.deps import CurrentUser
from kori.db.session import get_db
from kori.recurring import service
from kori.recurring.schemas import RuleIn, RuleOut, RuleUpdate

router = APIRouter(prefix="/recurring-rules", tags=["recurring"])

Db = Annotated[Session, Depends(get_db)]


@router.get("")
def list_rules(user: CurrentUser, db: Db, include_ended: bool = False) -> list[RuleOut]:
    """Active and paused rules; `include_ended=true` adds the ended ones."""
    return [
        service.to_out(db, user, r)
        for r in service.list_rules(db, user, include_ended=include_ended)
    ]


@router.post("", status_code=201)
def create_rule(body: RuleIn, user: CurrentUser, db: Db) -> RuleOut:
    return service.to_out(db, user, service.create_rule(db, user, body))


@router.get("/{rule_id}")
def get_rule(rule_id: uuid.UUID, user: CurrentUser, db: Db) -> RuleOut:
    return service.to_out(db, user, service.get_rule(db, user, rule_id))


@router.patch("/{rule_id}")
def update_rule(rule_id: uuid.UUID, body: RuleUpdate, user: CurrentUser, db: Db) -> RuleOut:
    return service.to_out(db, user, service.update_rule(db, user, rule_id, body))


@router.post("/{rule_id}/pause")
def pause_rule(rule_id: uuid.UUID, user: CurrentUser, db: Db) -> RuleOut:
    return service.to_out(db, user, service.pause_rule(db, user, rule_id))


@router.post("/{rule_id}/resume")
def resume_rule(rule_id: uuid.UUID, user: CurrentUser, db: Db) -> RuleOut:
    """Missed occurrences are skipped; the next one is the first on or after today."""
    return service.to_out(db, user, service.resume_rule(db, user, rule_id))


@router.delete("/{rule_id}", status_code=204)
def delete_rule(rule_id: uuid.UUID, user: CurrentUser, db: Db) -> Response:
    service.delete_rule(db, user, rule_id)
    return Response(status_code=204)
