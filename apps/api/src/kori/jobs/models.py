import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from kori.db.base import Base
from kori.db.mixins import UUID_PK_DEFAULT


class JobRun(Base):
    """One row per run of the scheduled tick (ADR-0006): the last-run timestamp and its counts.

    Not user-owned: a run covers every user.
    """

    __tablename__ = "job_runs"
    __table_args__ = (
        CheckConstraint(
            "rules_scanned >= 0 AND created >= 0 AND skipped >= 0 AND failed >= 0"
            " AND duration_ms >= 0",
            name="counts_non_negative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=UUID_PK_DEFAULT
    )
    job: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    rules_scanned: Mapped[int] = mapped_column(Integer, nullable=False)
    created: Mapped[int] = mapped_column(Integer, nullable=False)
    skipped: Mapped[int] = mapped_column(Integer, nullable=False)
    failed: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
