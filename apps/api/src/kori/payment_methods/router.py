import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from kori.auth.deps import CurrentUser
from kori.db.session import get_db
from kori.payment_methods import service
from kori.payment_methods.schemas import PaymentMethodCreate, PaymentMethodOut, PaymentMethodUpdate

router = APIRouter(prefix="/payment-methods", tags=["payment-methods"])

Db = Annotated[Session, Depends(get_db)]


@router.get("")
def list_payment_methods(
    user: CurrentUser, db: Db, include_archived: Annotated[bool, Query()] = False
) -> list[PaymentMethodOut]:
    rows = service.list_payment_methods(db, user, include_archived=include_archived)
    return [PaymentMethodOut.model_validate(r) for r in rows]


@router.post("", status_code=201)
def create_payment_method(body: PaymentMethodCreate, user: CurrentUser, db: Db) -> PaymentMethodOut:
    return PaymentMethodOut.model_validate(service.create_payment_method(db, user, body))


@router.patch("/{payment_method_id}")
def update_payment_method(
    payment_method_id: uuid.UUID, body: PaymentMethodUpdate, user: CurrentUser, db: Db
) -> PaymentMethodOut:
    row = service.update_payment_method(db, user, payment_method_id, body)
    return PaymentMethodOut.model_validate(row)


@router.post("/{payment_method_id}/archive")
def archive_payment_method(
    payment_method_id: uuid.UUID, user: CurrentUser, db: Db
) -> PaymentMethodOut:
    return PaymentMethodOut.model_validate(
        service.archive_payment_method(db, user, payment_method_id)
    )


@router.post("/{payment_method_id}/unarchive")
def unarchive_payment_method(
    payment_method_id: uuid.UUID, user: CurrentUser, db: Db
) -> PaymentMethodOut:
    row = service.unarchive_payment_method(db, user, payment_method_id)
    return PaymentMethodOut.model_validate(row)
