"""budgets

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-01 12:55:09.959915
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "budgets",
        sa.Column("category_id", sa.UUID(), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "amount_minor IS NULL OR amount_minor > 0", name=op.f("ck_budgets_amount_positive")
        ),
        sa.CheckConstraint(
            "extract(day FROM effective_from) = 1",
            name=op.f("ck_budgets_effective_from_first_of_month"),
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_budgets_category_id_categories"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_budgets_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_budgets")),
        sa.UniqueConstraint(
            "user_id",
            "category_id",
            "effective_from",
            name="uq_budgets_user_category_effective_from",
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_index(
        "ix_budgets_user_id_effective_from", "budgets", ["user_id", "effective_from"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_budgets_user_id_effective_from", table_name="budgets")
    op.drop_table("budgets")
