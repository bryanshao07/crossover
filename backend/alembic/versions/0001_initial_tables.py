"""initial_tables

Revision ID: 0001
Revises:
Create Date: 2026-07-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "saved_comparisons",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("player_a", sa.String(), nullable=False),
        sa.Column("player_b", sa.String(), nullable=False),
        sa.Column("similarity_score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_saved_comparisons_user_id"), "saved_comparisons", ["user_id"], unique=False
    )

    op.create_table(
        "favorites",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("player_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "player_name", name="uq_favorites_user_player"),
    )
    op.create_index(
        op.f("ix_favorites_user_id"), "favorites", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_favorites_user_id"), table_name="favorites")
    op.drop_table("favorites")
    op.drop_index(op.f("ix_saved_comparisons_user_id"), table_name="saved_comparisons")
    op.drop_table("saved_comparisons")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
