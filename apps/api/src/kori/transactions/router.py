import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from kori.auth.deps import CurrentUser
from kori.common.dates import resolve_date_range
from kori.common.enums import TransactionType
from kori.common.money import format_taka
from kori.db.session import get_db
from kori.tags.schemas import normalize_tag_name
from kori.transactions import service
from kori.transactions.models import Transaction
from kori.transactions.schemas import (
    LineOut,
    PaymentMethodRef,
    TransactionIn,
    TransactionOut,
    TransactionPage,
    category_ref,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])

Db = Annotated[Session, Depends(get_db)]


def to_out(tx: Transaction) -> TransactionOut:
    method = tx.payment_method
    return TransactionOut(
        id=tx.id,
        type=tx.type,
        amount=format_taka(tx.amount_minor),
        occurred_on=tx.occurred_on,
        merchant=tx.merchant,
        note=tx.note,
        payment_method=PaymentMethodRef(id=method.id, name=method.name) if method else None,
        lines=[
            LineOut(
                category=category_ref(line.category),
                amount=format_taka(line.amount_minor),
                category_source=line.category_source,
            )
            for line in tx.lines
        ],
        tags=[tag.name for tag in tx.tags],
        is_split=len(tx.lines) > 1,
        source=tx.source,
        created_at=tx.created_at,
        updated_at=tx.updated_at,
    )


@router.get("")
def list_transactions(
    user: CurrentUser,
    db: Db,
    month: Annotated[
        str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2026-09"])
    ] = None,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    type: TransactionType | None = None,
    category_id: Annotated[list[uuid.UUID] | None, Query()] = None,
    payment_method_id: uuid.UUID | None = None,
    tag: Annotated[str | None, Query(max_length=200)] = None,
    q: Annotated[str | None, Query(min_length=2, max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: str | None = None,
) -> TransactionPage:
    date_from, date_to = resolve_date_range(month, date_from, date_to)
    filters = service.TransactionFilters(
        date_from=date_from,
        date_to=date_to,
        type=type,
        category_ids=category_id or [],
        payment_method_id=payment_method_id,
        tag=normalize_tag_name(tag) if tag else None,
        q=q,
    )
    result = service.list_transactions(db, user, filters, cursor, limit)
    return TransactionPage(
        items=[to_out(tx) for tx in result.items],
        next_cursor=result.next_cursor,
        totals=result.totals,
    )


@router.post("", status_code=201)
def create_transaction(
    body: TransactionIn, user: CurrentUser, db: Db, response: Response
) -> TransactionOut:
    tx = service.create_transaction(db, user, body)
    response.headers["Location"] = f"/api/v1/transactions/{tx.id}"
    return to_out(tx)


@router.get("/{transaction_id}")
def get_transaction(transaction_id: uuid.UUID, user: CurrentUser, db: Db) -> TransactionOut:
    return to_out(service.get_transaction(db, user, transaction_id))


@router.put("/{transaction_id}")
def update_transaction(
    transaction_id: uuid.UUID, body: TransactionIn, user: CurrentUser, db: Db
) -> TransactionOut:
    return to_out(service.update_transaction(db, user, transaction_id, body))


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: uuid.UUID, user: CurrentUser, db: Db) -> Response:
    service.delete_transaction(db, user, transaction_id)
    return Response(status_code=204)
