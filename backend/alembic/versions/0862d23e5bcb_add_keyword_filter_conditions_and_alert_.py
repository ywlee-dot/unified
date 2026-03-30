"""add_keyword_filter_conditions_and_alert_match_reasons

Revision ID: 0862d23e5bcb
Revises: a709ddf5ff5d
Create Date: 2026-03-30 01:18:35.929882

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0862d23e5bcb'
down_revision: Union[str, None] = 'a709ddf5ff5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bid_keywords', sa.Column('filter_conditions', sa.JSON(), nullable=True))
    op.add_column('bid_alerts', sa.Column('match_reasons', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('bid_alerts', 'match_reasons')
    op.drop_column('bid_keywords', 'filter_conditions')
