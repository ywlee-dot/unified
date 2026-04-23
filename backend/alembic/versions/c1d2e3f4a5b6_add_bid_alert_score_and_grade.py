"""add_bid_alert_score_and_grade

Revision ID: c1d2e3f4a5b6
Revises: b3f1a2c4d5e6
Create Date: 2026-04-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b3f1a2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bid_alerts', sa.Column('score', sa.Float(), nullable=True))
    op.add_column('bid_alerts', sa.Column('grade', sa.String(length=10), nullable=True))
    op.add_column('bid_alerts', sa.Column('signals', sa.JSON(), nullable=True))
    op.create_index('ix_bid_alerts_grade', 'bid_alerts', ['grade'])
    op.create_index('ix_bid_alerts_score', 'bid_alerts', ['score'])


def downgrade() -> None:
    op.drop_index('ix_bid_alerts_score', table_name='bid_alerts')
    op.drop_index('ix_bid_alerts_grade', table_name='bid_alerts')
    op.drop_column('bid_alerts', 'signals')
    op.drop_column('bid_alerts', 'grade')
    op.drop_column('bid_alerts', 'score')
