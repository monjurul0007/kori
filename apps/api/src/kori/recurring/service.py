import calendar
import uuid
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kori.categories.models import Category
from kori.common.enums import RecurrenceFrequency
from kori.common.errors import NotFoundError, UnprocessableError, field_error
from kori.common.money import format_taka, parse_taka
from kori.payment_methods.models import PaymentMethod
from kori.recurring import schedule
from kori.recurring.models import RecurringRule
from kori.recurring.schemas import NULLABLE_ON_UPDATE, RuleIn, RuleOut, RuleStatus, RuleUpdate
from kori.transactions.schemas import CategoryRef, PaymentMethodRef
from kori.users.models import User

MIN_START = date(2000, 1, 1)
UPCOMING = 3


def _today(user: User) -> date:
    return datetime.now(ZoneInfo(user.timezone)).date()


def _check_start(user: User, start_on: date, errors: list[dict[str, Any]]) -> None:
    today = _today(user)
    year = today.year + 1
    latest = date(year, today.month, min(today.day, calendar.monthrange(year, today.month)[1]))
    if not MIN_START <= start_on <= latest:
        errors.append(
            field_error(
                ["body", "start_on"],
                f"Start date must be between {MIN_START} and {latest} (a year from today)",
                "value_error",
            )
        )


def _check_references(
    db: Session,
    user: User,
    errors: list[dict[str, Any]],
    *,
    type_: str,
    category_id: uuid.UUID | None,
    payment_method_id: uuid.UUID | None,
) -> None:
    """The same rules as a transaction (M1-08): owned by the user, not archived, matching kind."""
    if category_id is not None:
        category = db.scalar(
            select(Category).where(Category.id == category_id, Category.user_id == user.id)
        )
        loc: list[str | int] = ["body", "category_id"]
        if category is None:
            errors.append(field_error(loc, "Category not found", "not_found"))
        elif category.archived_at is not None:
            errors.append(field_error(loc, "Category is archived", "archived"))
        elif category.kind.value != type_:
            errors.append(field_error(loc, f"A {type_} needs a {type_} category", "kind"))
    if payment_method_id is not None:
        method = db.scalar(
            select(PaymentMethod).where(
                PaymentMethod.id == payment_method_id, PaymentMethod.user_id == user.id
            )
        )
        loc = ["body", "payment_method_id"]
        if method is None:
            errors.append(field_error(loc, "Payment method not found", "not_found"))
        elif method.archived_at is not None:
            errors.append(field_error(loc, "Payment method is archived", "archived"))


def create_rule(db: Session, user: User, data: RuleIn) -> RecurringRule:
    errors: list[dict[str, Any]] = []
    _check_start(user, data.start_on, errors)
    _check_references(
        db,
        user,
        errors,
        type_=data.type.value,
        category_id=data.category_id,
        payment_method_id=data.payment_method_id,
    )
    if errors:
        raise UnprocessableError(errors)

    rule = RecurringRule(
        user_id=user.id,
        name=data.name,
        type=data.type,
        amount_minor=parse_taka(data.amount),
        category_id=data.category_id,
        payment_method_id=data.payment_method_id,
        merchant=data.merchant,
        note=data.note,
        frequency=data.frequency,
        interval=data.interval,
        start_on=data.start_on,
        end_on=data.end_on,
    )
    # Never backfill: the first occurrence is today or later, so dates already logged by hand
    # are not created a second time.
    rule.next_due_on = schedule.next_on_or_after(rule, _today(user))
    db.add(rule)
    db.flush()
    db.refresh(rule)
    return rule


def get_rule(db: Session, user: User, id: uuid.UUID) -> RecurringRule:
    rule = db.scalar(
        select(RecurringRule).where(RecurringRule.id == id, RecurringRule.user_id == user.id)
    )
    if rule is None:
        raise NotFoundError("Recurring rule not found")
    return rule


def list_rules(db: Session, user: User, *, include_ended: bool = False) -> list[RecurringRule]:
    """Active and paused rules, soonest first; `include_ended` adds the ended ones."""
    stmt = select(RecurringRule).where(RecurringRule.user_id == user.id)
    if not include_ended:
        stmt = stmt.where(RecurringRule.next_due_on.is_not(None))
    return list(
        db.scalars(
            stmt.order_by(
                RecurringRule.next_due_on.asc().nulls_last(), RecurringRule.name, RecurringRule.id
            )
        )
    )


def update_rule(db: Session, user: User, id: uuid.UUID, data: RuleUpdate) -> RecurringRule:
    rule = get_rule(db, user, id)
    changes = {k: getattr(data, k) for k in data.model_fields_set}
    errors: list[dict[str, Any]] = []

    if "start_on" in changes:
        _check_start(user, changes["start_on"], errors)
    start_on = changes.get("start_on", rule.start_on)
    end_on = changes.get("end_on", rule.end_on)
    if end_on is not None and end_on < start_on:
        errors.append(
            field_error(["body", "end_on"], "end_on must not be before start_on", "value_error")
        )
    _check_references(
        db,
        user,
        errors,
        type_=rule.type.value,
        category_id=changes.get("category_id"),
        payment_method_id=changes.get("payment_method_id"),
    )
    if errors:
        raise UnprocessableError(errors)

    schedule_changed = any(
        k in changes and changes[k] != getattr(rule, k)
        for k in ("frequency", "interval", "start_on")
    )
    end_changed = "end_on" in changes and changes["end_on"] != rule.end_on
    for key, value in changes.items():
        if key == "amount":
            rule.amount_minor = parse_taka(value)
        elif value is not None or key in NULLABLE_ON_UPDATE:
            setattr(rule, key, value)

    if schedule_changed:
        rule.next_due_on = schedule.next_on_or_after(rule, _today(user))
    elif end_changed:
        due = rule.next_due_on
        if due is None:  # it had ended; a later end date may bring it back
            rule.next_due_on = schedule.next_on_or_after(rule, _today(user))
        elif end_on is not None and due > end_on:
            rule.next_due_on = None
    rule.updated_at = func.now()
    db.flush()
    db.refresh(rule)
    return rule


def pause_rule(db: Session, user: User, id: uuid.UUID) -> RecurringRule:
    rule = get_rule(db, user, id)
    if rule.paused_at is None:
        rule.paused_at = func.now()
        rule.updated_at = func.now()
        db.flush()
        db.refresh(rule)
    return rule


def resume_rule(db: Session, user: User, id: uuid.UUID) -> RecurringRule:
    """Occurrences missed while paused are skipped, not caught up: restart from today."""
    rule = get_rule(db, user, id)
    if rule.paused_at is not None:
        rule.paused_at = None
        rule.last_error = None
        rule.next_due_on = schedule.next_on_or_after(rule, _today(user))
        rule.updated_at = func.now()
        db.flush()
        db.refresh(rule)
    return rule


def delete_rule(db: Session, user: User, id: uuid.UUID) -> None:
    """Past transactions keep their data; their `recurring_rule_id` becomes NULL (ON DELETE)."""
    rule = get_rule(db, user, id)
    db.delete(rule)
    db.flush()


def to_out(db: Session, user: User, rule: RecurringRule) -> RuleOut:
    today = _today(user)
    category = db.get_one(Category, rule.category_id)
    method = db.get(PaymentMethod, rule.payment_method_id) if rule.payment_method_id else None
    if rule.next_due_on is None:
        status, upcoming = RuleStatus.ENDED, []
    else:
        status = RuleStatus.PAUSED if rule.paused_at is not None else RuleStatus.ACTIVE
        upcoming = schedule.upcoming(rule, max(rule.next_due_on, today), UPCOMING)
    return RuleOut(
        id=rule.id,
        name=rule.name,
        type=rule.type,
        amount=format_taka(rule.amount_minor),
        category=CategoryRef(id=category.id, name=category.name, kind=category.kind),
        payment_method=PaymentMethodRef(id=method.id, name=method.name) if method else None,
        merchant=rule.merchant,
        note=rule.note,
        frequency=RecurrenceFrequency(rule.frequency),
        interval=rule.interval,
        start_on=rule.start_on,
        end_on=rule.end_on,
        next_due_on=rule.next_due_on,
        status=status,
        upcoming=upcoming,
        last_error=rule.last_error,
        paused_at=rule.paused_at,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )
