"""Turn due recurring rules into transactions, exactly once (ADR-0006).

Idempotency rests on three things:
- `next_due_on` is the cursor. It moves forward in the same transaction that creates the
  occurrence, so a deleted occurrence is never recreated ("delete = skip this occurrence").
- Each rule is locked `FOR UPDATE SKIP LOCKED` and re-checked inside its own transaction, so two
  overlapping runs never process the same rule at once.
- `UNIQUE (recurring_rule_id, occurred_on)` on `transactions` is the backstop: a conflict inside a
  savepoint means "already done", not an error.
"""

import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import structlog
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from kori.common.enums import CategorySource, TransactionSource
from kori.common.errors import UnprocessableError
from kori.common.money import format_taka
from kori.recurring import schedule
from kori.recurring.models import RecurringRule
from kori.transactions.schemas import TransactionIn
from kori.transactions.service import create_transaction
from kori.users.models import User

log = structlog.get_logger()

MAX_PER_RULE = 12  # occurrences per rule per run; the rest waits for the next run
_UNIQUE_VIOLATION = "23505"


@dataclass
class MaterializeResult:
    scanned: int = 0  # due rules found
    created: int = 0  # transactions created
    skipped: int = 0  # occurrences already done, or rules another run was handling
    failed: int = 0  # rules paused with an error, or that raised

    def add(self, other: "MaterializeResult") -> None:
        self.scanned += other.scanned
        self.created += other.created
        self.skipped += other.skipped
        self.failed += other.failed


@dataclass
class RunSummary(MaterializeResult):
    users: int = 0
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    finished_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    duration_ms: int = 0


def today_for(user: User) -> date:
    """Today as a calendar date in the user's own time zone, never UTC (ADR-0004)."""
    return datetime.now(ZoneInfo(user.timezone)).date()


def _is_unique_violation(exc: IntegrityError) -> bool:
    return getattr(exc.orig, "sqlstate", None) == _UNIQUE_VIOLATION


def _occurrence(rule: RecurringRule, occurred_on: date) -> TransactionIn:
    return TransactionIn(
        type=rule.type,
        amount=format_taka(rule.amount_minor),
        occurred_on=occurred_on,
        category_id=rule.category_id,
        merchant=rule.merchant,
        note=rule.note,
        payment_method_id=rule.payment_method_id,
    )


def _process_rule(db: Session, user: User, rule_id: uuid.UUID, today: date) -> MaterializeResult:
    """One rule, in its own savepoint (and, when the caller commits after, its own transaction)."""
    result = MaterializeResult()
    # Lock and re-check: another run may have handled or locked the rule since we listed it.
    rule = db.scalar(
        select(RecurringRule)
        .where(
            RecurringRule.id == rule_id,
            RecurringRule.user_id == user.id,
            RecurringRule.paused_at.is_(None),
            RecurringRule.next_due_on <= today,
        )
        .with_for_update(skip_locked=True)
    )
    if rule is None or rule.next_due_on is None:  # the query filtered on it; this narrows the type
        result.skipped += 1
        return result
    result.scanned += 1

    due = schedule.occurrences(rule, rule.next_due_on, today)
    if len(due) > MAX_PER_RULE:
        log.warning("recurring_catch_up_capped", rule_id=str(rule.id), pending=len(due))
        due = due[:MAX_PER_RULE]

    for occurred_on in due:
        try:
            with db.begin_nested():
                create_transaction(
                    db,
                    user,
                    _occurrence(rule, occurred_on),
                    source=TransactionSource.RECURRING,
                    category_source=CategorySource.RULE,
                    recurring_rule_id=rule.id,
                )
        except IntegrityError as exc:
            if not _is_unique_violation(exc):
                raise
            result.skipped += 1  # already materialized; the cursor still moves past it
        except UnprocessableError as exc:
            # The category or payment method was archived since the rule was made (or similar):
            # don't retry forever. Pause, say why, and keep the cursor on this occurrence.
            rule.next_due_on = occurred_on
            rule.paused_at = func.now()
            rule.last_error = "; ".join(str(e["msg"]) for e in exc.errors)[:500]
            rule.updated_at = func.now()
            db.flush()
            log.warning("recurring_rule_paused", rule_id=str(rule.id), error=rule.last_error)
            result.failed += 1
            return result
        else:
            result.created += 1
        rule.next_due_on = schedule.next_on_or_after(rule, occurred_on + timedelta(days=1))

    rule.last_error = None
    rule.updated_at = func.now()
    db.flush()
    return result


def materialize_due(
    db: Session, user: User, today: date, *, commit_each: bool = False
) -> MaterializeResult:
    """Create every transaction that is due for `user` up to `today`.

    `commit_each` commits after every rule, for the scheduled run; the request-scoped catch-up
    leaves the commit to the request.
    """
    total = MaterializeResult()
    rule_ids = list(
        db.scalars(
            select(RecurringRule.id)
            .where(
                RecurringRule.user_id == user.id,
                RecurringRule.paused_at.is_(None),
                RecurringRule.next_due_on <= today,
            )
            .order_by(RecurringRule.next_due_on, RecurringRule.id)
        )
    )
    for rule_id in rule_ids:
        try:
            with db.begin_nested():
                total.add(_process_rule(db, user, rule_id, today))
            if commit_each:
                db.commit()
        except Exception:
            log.exception("recurring_rule_failed", rule_id=str(rule_id))
            total.failed += 1
            if commit_each:
                db.rollback()
    return total


def materialize_all(db: Session) -> RunSummary:
    """Run for every user, each with today in their own time zone."""
    started = datetime.now(UTC)
    clock = time.monotonic()
    summary = RunSummary(started_at=started)
    users = list(db.scalars(select(User).order_by(User.created_at, User.id)))
    for user in users:
        summary.add(materialize_due(db, user, today_for(user), commit_each=True))
    summary.users = len(users)
    summary.finished_at = datetime.now(UTC)
    summary.duration_ms = round((time.monotonic() - clock) * 1000)
    log.info(
        "recurring_run",
        users=summary.users,
        rules_scanned=summary.scanned,
        created=summary.created,
        skipped=summary.skipped,
        failed=summary.failed,
        duration_ms=summary.duration_ms,
    )
    return summary
