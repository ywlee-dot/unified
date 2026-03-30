"""add source_keyword to bid_notices

Revision ID: b3f1a2c4d5e6
Revises: 0862d23e5bcb
Create Date: 2026-03-30 02:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3f1a2c4d5e6'
down_revision: Union[str, None] = '0862d23e5bcb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bid_notices', sa.Column('source_keyword', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column('bid_notices', 'source_keyword')
