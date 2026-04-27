"""generalize n8n_executions to process_executions

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-04-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop stale test rows (no result_data, all in 'running' status from over a month ago)
    op.execute("DELETE FROM n8n_executions WHERE result_data IS NULL")

    # Rename table
    op.rename_table("n8n_executions", "process_executions")

    # Rename index that references old name
    op.drop_index("ix_n8n_executions_project_status", table_name="process_executions")
    op.drop_index(
        op.f("ix_n8n_executions_execution_id"), table_name="process_executions"
    )

    # Add new generalized columns
    op.add_column(
        "process_executions",
        sa.Column(
            "process_type",
            sa.String(length=50),
            nullable=False,
            server_default="n8n",
        ),
    )
    op.add_column(
        "process_executions",
        sa.Column(
            "input_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "process_executions",
        sa.Column(
            "input_summary",
            sa.String(length=500),
            nullable=False,
            server_default="",
        ),
    )

    # Make n8n-specific fields nullable
    op.alter_column("process_executions", "workflow_id", nullable=True)
    op.alter_column("process_executions", "workflow_name", nullable=True)

    # Recreate indexes with new naming
    op.create_index(
        op.f("ix_process_executions_execution_id"),
        "process_executions",
        ["execution_id"],
        unique=True,
    )
    op.create_index(
        "ix_process_executions_project_status",
        "process_executions",
        ["project_slug", "status"],
        unique=False,
    )
    op.create_index(
        "ix_process_executions_project_started",
        "process_executions",
        ["project_slug", "started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_process_executions_project_started", table_name="process_executions"
    )
    op.drop_index(
        "ix_process_executions_project_status", table_name="process_executions"
    )
    op.drop_index(
        op.f("ix_process_executions_execution_id"), table_name="process_executions"
    )

    op.alter_column("process_executions", "workflow_name", nullable=False)
    op.alter_column("process_executions", "workflow_id", nullable=False)

    op.drop_column("process_executions", "input_summary")
    op.drop_column("process_executions", "input_metadata")
    op.drop_column("process_executions", "process_type")

    op.rename_table("process_executions", "n8n_executions")

    op.create_index(
        op.f("ix_n8n_executions_execution_id"),
        "n8n_executions",
        ["execution_id"],
        unique=True,
    )
    op.create_index(
        "ix_n8n_executions_project_status",
        "n8n_executions",
        ["project_slug", "status"],
        unique=False,
    )
