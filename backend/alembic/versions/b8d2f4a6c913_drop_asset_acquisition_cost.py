"""drop assets.acquisition_cost (nilai perolehan tidak dipakai)

Revision ID: b8d2f4a6c913
Revises: e5f0a2c4b7d1
Create Date: 2026-10-22 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b8d2f4a6c913'
down_revision: Union[str, None] = 'e5f0a2c4b7d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(op.f('ck_assets_acquisition_cost_non_negative'), 'assets', type_='check')
    op.drop_column('assets', 'acquisition_cost')


def downgrade() -> None:
    op.add_column('assets', sa.Column('acquisition_cost', sa.Numeric(precision=15, scale=2), nullable=True))
    op.create_check_constraint(op.f('ck_assets_acquisition_cost_non_negative'), 'assets', 'acquisition_cost IS NULL OR acquisition_cost >= 0')
