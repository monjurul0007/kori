"""recurring rules

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-20 00:41:04.226031
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recurring_rules",
        sa.Column("name", sa.Text(), nullable=False),
        # transaction_type already exists (created with `transactions`): reuse it.
        sa.Column(
            "type",
            postgresql.ENUM("expense", "income", name="transaction_type", create_type=False),
            nullable=False,
        ),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="BDT", nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("payment_method_id", sa.UUID(), nullable=True),
        sa.Column("merchant", sa.String(length=120), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column(
            "frequency",
            sa.Enum("weekly", "monthly", "yearly", name="recurrence_frequency"),
            nullable=False,
        ),
        sa.Column("interval", sa.SmallInteger(), server_default="1", nullable=False),
        sa.Column("start_on", sa.Date(), nullable=False),
        sa.Column("end_on", sa.Date(), nullable=True),
        sa.Column("next_due_on", sa.Date(), nullable=True),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
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
            '"interval" BETWEEN 1 AND 12', name=op.f("ck_recurring_rules_interval_range")
        ),
        sa.CheckConstraint("amount_minor > 0", name=op.f("ck_recurring_rules_amount_positive")),
        sa.CheckConstraint(
            "char_length(name) BETWEEN 1 AND 60", name=op.f("ck_recurring_rules_name_length")
        ),
        sa.CheckConstraint(
            "end_on IS NULL OR end_on >= start_on",
            name=op.f("ck_recurring_rules_end_on_after_start_on"),
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_recurring_rules_category_id_categories"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["payment_method_id"],
            ["payment_methods.id"],
            name=op.f("fk_recurring_rules_payment_method_id_payment_methods"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_recurring_rules_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_recurring_rules")),
    )
    op.create_index("ix_recurring_rules_user_id", "recurring_rules", ["user_id"], unique=False)
    op.create_index(
        "ix_recurring_rules_next_due_on",
        "recurring_rules",
        ["next_due_on"],
        unique=False,
        postgresql_where=sa.text("paused_at IS NULL AND next_due_on IS NOT NULL"),
    )
    op.add_column("transactions", sa.Column("recurring_rule_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        op.f("fk_transactions_recurring_rule_id_recurring_rules"),
        "transactions",
        "recurring_rules",
        ["recurring_rule_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_transactions_recurring_rule_id_occurred_on",
        "transactions",
        ["recurring_rule_id", "occurred_on"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_transactions_recurring_rule_id_occurred_on", "transactions", type_="unique"
    )
    op.drop_constraint(
        op.f("fk_transactions_recurring_rule_id_recurring_rules"),
        "transactions",
        type_="foreignkey",
    )
    op.drop_column("transactions", "recurring_rule_id")
    op.drop_index("ix_recurring_rules_next_due_on", table_name="recurring_rules")
    op.drop_index("ix_recurring_rules_user_id", table_name="recurring_rules")
    op.drop_table("recurring_rules")
    op.execute("DROP TYPE recurrence_frequency")
