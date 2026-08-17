"""add google auth columns to users

Revision ID: b7f2a9c4d1e3
Revises: a1b2c3d4e5f6
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7f2a9c4d1e3"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Google-created accounts have no password at all. A placeholder hash was
    # rejected in design: NULL states the fact and keeps the passwordless
    # branch explicit.
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)
    op.add_column("users", sa.Column("google_sub", sa.String(), nullable=True))
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)


def downgrade() -> None:
    # Rows with a NULL password cannot satisfy the restored NOT NULL: they are
    # Google-only accounts. Rather than silently cascade-deleting them (and
    # their favorites / saved comparisons), refuse loudly and let an operator
    # resolve them manually first.
    bind = op.get_bind()
    google_only_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE hashed_password IS NULL")
    ).scalar()
    if google_only_count > 0:
        raise RuntimeError(
            f"Cannot downgrade: {google_only_count} Google-only account(s) "
            "(hashed_password IS NULL) exist. Downgrading would delete these "
            "users along with their favorites and saved comparisons. Resolve "
            "them manually (e.g. set a password or remove the accounts) "
            "before downgrading."
        )

    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_column("users", "google_sub")
    op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=False)
