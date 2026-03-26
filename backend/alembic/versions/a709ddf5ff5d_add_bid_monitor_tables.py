"""add bid_monitor tables

Revision ID: a709ddf5ff5d
Revises: 731086a4cc9f
Create Date: 2026-03-26 07:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a709ddf5ff5d'
down_revision: Union[str, None] = '731086a4cc9f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('bid_keywords',
        sa.Column('keyword', sa.String(length=200), nullable=False),
        sa.Column('bid_types', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('last_checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('bid_check_runs',
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('trigger_type', sa.String(length=20), nullable=False),
        sa.Column('statistics', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('bid_monitor_config',
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key')
    )
    op.create_table('bid_notices',
        sa.Column('bid_ntce_no', sa.String(length=40), nullable=False),
        sa.Column('bid_ntce_ord', sa.String(length=10), nullable=False),
        sa.Column('bid_ntce_nm', sa.String(length=1000), nullable=False),
        sa.Column('ntce_instt_nm', sa.String(length=200), nullable=True),
        sa.Column('dminstt_nm', sa.String(length=200), nullable=True),
        sa.Column('bid_ntce_dt', sa.DateTime(timezone=True), nullable=True),
        sa.Column('bid_clse_dt', sa.DateTime(timezone=True), nullable=True),
        sa.Column('openg_dt', sa.DateTime(timezone=True), nullable=True),
        sa.Column('presmpt_prce', sa.Float(), nullable=True),
        sa.Column('asign_bdgt_amt', sa.Float(), nullable=True),
        sa.Column('cntrct_cncls_mthd_nm', sa.String(length=100), nullable=True),
        sa.Column('bid_type', sa.String(length=20), nullable=False),
        sa.Column('ntce_kind_nm', sa.String(length=50), nullable=True),
        sa.Column('bid_ntce_url', sa.Text(), nullable=True),
        sa.Column('bid_ntce_dtl_url', sa.Text(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_bid_notices_bid_ntce_no'), 'bid_notices', ['bid_ntce_no'], unique=False)
    op.create_table('bid_alerts',
        sa.Column('keyword_id', sa.String(), nullable=False),
        sa.Column('notice_id', sa.String(), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['keyword_id'], ['bid_keywords.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['notice_id'], ['bid_notices.id'], ondelete='CASCADE'),
    )


def downgrade() -> None:
    op.drop_table('bid_alerts')
    op.drop_index(op.f('ix_bid_notices_bid_ntce_no'), table_name='bid_notices')
    op.drop_table('bid_notices')
    op.drop_table('bid_monitor_config')
    op.drop_table('bid_check_runs')
    op.drop_table('bid_keywords')
