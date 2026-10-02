"""core data model

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-01 05:22:52.728094
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column(
            "attempted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("succeeded", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_login_attempts")),
    )
    op.create_index(
        "ix_login_attempts_email_attempted_at",
        "login_attempts",
        ["email", sa.literal_column("attempted_at DESC")],
        unique=False,
    )
    op.create_table(
        "users",
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("timezone", sa.Text(), server_default="Asia/Dhaka", nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="BDT", nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
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
        sa.CheckConstraint("email = lower(email)", name=op.f("ck_users_email_lowercase")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_table(
        "categories",
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("kind", sa.Enum("expense", "income", name="category_kind"), nullable=False),
        sa.Column("icon", sa.Text(), nullable=True),
        sa.Column("color", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
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
            "char_length(name) BETWEEN 1 AND 50", name=op.f("ck_categories_name_length")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_categories_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
    )
    op.create_index(
        "uq_categories_user_id_kind_name",
        "categories",
        ["user_id", "kind", sa.literal_column("lower(name)")],
        unique=True,
        postgresql_where=sa.text("archived_at IS NULL"),
    )
    op.create_table(
        "payment_methods",
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum("cash", "mobile_wallet", "card", "bank", "other", name="payment_method_kind"),
            nullable=False,
        ),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
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
            "char_length(name) BETWEEN 1 AND 40", name=op.f("ck_payment_methods_name_length")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_payment_methods_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment_methods")),
    )
    op.create_index(
        "uq_payment_methods_user_id_name",
        "payment_methods",
        ["user_id", sa.literal_column("lower(name)")],
        unique=True,
        postgresql_where=sa.text("archived_at IS NULL"),
    )
    op.create_table(
        "sessions",
        sa.Column("token_hash", postgresql.BYTEA(), nullable=False),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_sessions_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_sessions_token_hash")),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"], unique=False)
    op.create_table(
        "tags",
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("char_length(name) BETWEEN 1 AND 30", name=op.f("ck_tags_name_length")),
        sa.CheckConstraint("name = lower(name)", name=op.f("ck_tags_name_lowercase")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_tags_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tags")),
        sa.UniqueConstraint("user_id", "name", name="uq_tags_user_id_name"),
    )
    op.create_table(
        "transactions",
        sa.Column("type", sa.Enum("expense", "income", name="transaction_type"), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="BDT", nullable=False),
        sa.Column("merchant", sa.String(length=120), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("payment_method_id", sa.UUID(), nullable=True),
        sa.Column(
            "source",
            sa.Enum("manual", "ai", "recurring", "import", "seed", name="transaction_source"),
            server_default="manual",
            nullable=False,
        ),
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
        sa.CheckConstraint("amount_minor > 0", name=op.f("ck_transactions_amount_positive")),
        sa.ForeignKeyConstraint(
            ["payment_method_id"],
            ["payment_methods.id"],
            name=op.f("fk_transactions_payment_method_id_payment_methods"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_transactions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transactions")),
    )
    op.create_index(
        "ix_transactions_merchant_trgm",
        "transactions",
        ["merchant"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"merchant": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_transactions_note_trgm",
        "transactions",
        ["note"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"note": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_transactions_user_id_occurred_on_created_at_id",
        "transactions",
        [
            "user_id",
            sa.literal_column("occurred_on DESC"),
            sa.literal_column("created_at DESC"),
            sa.literal_column("id DESC"),
        ],
        unique=False,
    )
    op.create_table(
        "transaction_lines",
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("position", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column(
            "category_source",
            sa.Enum("user", "default", "ai", "rule", "seed", name="category_source"),
            server_default="user",
            nullable=False,
        ),
        sa.Column("category_confidence", sa.REAL(), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.CheckConstraint("amount_minor > 0", name=op.f("ck_transaction_lines_amount_positive")),
        sa.CheckConstraint(
            "category_confidence BETWEEN 0 AND 1",
            name=op.f("ck_transaction_lines_category_confidence_range"),
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_transaction_lines_category_id_categories"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transactions.id"],
            name=op.f("fk_transaction_lines_transaction_id_transactions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transaction_lines")),
        sa.UniqueConstraint("transaction_id", "position", name="uq_transaction_lines_position"),
    )
    op.create_index(
        "ix_transaction_lines_category_id", "transaction_lines", ["category_id"], unique=False
    )
    op.create_table(
        "transaction_tags",
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column("tag_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["tags.id"],
            name=op.f("fk_transaction_tags_tag_id_tags"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transactions.id"],
            name=op.f("fk_transaction_tags_transaction_id_transactions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("transaction_id", "tag_id", name=op.f("pk_transaction_tags")),
    )
    op.create_index("ix_transaction_tags_tag_id", "transaction_tags", ["tag_id"], unique=False)

    # Hand-written: autogenerate can't express a deferred constraint trigger. Every transaction
    # needs at least one line, and its lines must sum to the transaction amount (splits).
    op.execute(
        """
        CREATE FUNCTION check_transaction_lines_sum() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE
            tx_id uuid;
            tx_amount bigint;
            line_count bigint;
            line_sum numeric;
        BEGIN
            IF TG_TABLE_NAME = 'transactions' THEN
                tx_id := NEW.id;
            ELSIF TG_OP = 'DELETE' THEN
                tx_id := OLD.transaction_id;
            ELSE
                tx_id := NEW.transaction_id;
            END IF;

            SELECT amount_minor INTO tx_amount FROM transactions WHERE id = tx_id;
            IF NOT FOUND THEN
                RETURN NULL;  -- the transaction was deleted; its lines cascaded away
            END IF;

            SELECT count(*), coalesce(sum(amount_minor), 0) INTO line_count, line_sum
            FROM transaction_lines WHERE transaction_id = tx_id;

            IF line_count = 0 THEN
                RAISE EXCEPTION 'transaction % has no lines', tx_id
                    USING ERRCODE = 'check_violation';
            END IF;
            IF line_sum <> tx_amount THEN
                RAISE EXCEPTION 'transaction % amount % does not equal the sum of its lines %',
                    tx_id, tx_amount, line_sum USING ERRCODE = 'check_violation';
            END IF;
            RETURN NULL;
        END
        $$
        """
    )
    op.execute(
        """
        CREATE CONSTRAINT TRIGGER transaction_lines_sum_check
        AFTER INSERT OR UPDATE OR DELETE ON transaction_lines
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION check_transaction_lines_sum()
        """
    )
    op.execute(
        """
        CREATE CONSTRAINT TRIGGER transactions_lines_sum_check
        AFTER INSERT OR UPDATE OF amount_minor ON transactions
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION check_transaction_lines_sum()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER transactions_lines_sum_check ON transactions")
    op.execute("DROP TRIGGER transaction_lines_sum_check ON transaction_lines")
    op.execute("DROP FUNCTION check_transaction_lines_sum()")
    op.drop_index("ix_transaction_tags_tag_id", table_name="transaction_tags")
    op.drop_table("transaction_tags")
    op.drop_index("ix_transaction_lines_category_id", table_name="transaction_lines")
    op.drop_table("transaction_lines")
    op.drop_index("ix_transactions_user_id_occurred_on_created_at_id", table_name="transactions")
    op.drop_index(
        "ix_transactions_note_trgm",
        table_name="transactions",
        postgresql_using="gin",
        postgresql_ops={"note": "gin_trgm_ops"},
    )
    op.drop_index(
        "ix_transactions_merchant_trgm",
        table_name="transactions",
        postgresql_using="gin",
        postgresql_ops={"merchant": "gin_trgm_ops"},
    )
    op.drop_table("transactions")
    op.drop_table("tags")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index(
        "uq_payment_methods_user_id_name",
        table_name="payment_methods",
        postgresql_where=sa.text("archived_at IS NULL"),
    )
    op.drop_table("payment_methods")
    op.drop_index(
        "uq_categories_user_id_kind_name",
        table_name="categories",
        postgresql_where=sa.text("archived_at IS NULL"),
    )
    op.drop_table("categories")
    op.drop_table("users")
    op.drop_index("ix_login_attempts_email_attempted_at", table_name="login_attempts")
    op.drop_table("login_attempts")
    # Native enum types are not dropped with their tables.
    for enum_name in (
        "category_source",
        "transaction_source",
        "transaction_type",
        "payment_method_kind",
        "category_kind",
    ):
        op.execute(f"DROP TYPE {enum_name}")
