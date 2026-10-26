"""restore assets.acquisition_cost (nilai perolehan, angka tanpa satuan mata uang)

Revision ID: c3e7a9d1f052
Revises: b8d2f4a6c913
Create Date: 2026-10-22 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c3e7a9d1f052'
down_revision: Union[str, None] = 'b8d2f4a6c913'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('assets')]
    if 'acquisition_cost' not in cols:
        op.add_column('assets', sa.Column('acquisition_cost', sa.Numeric(precision=15, scale=2), nullable=True))

    constraints = [c['name'] for c in inspector.get_check_constraints('assets')]
    ck_name = op.f('ck_assets_acquisition_cost_non_negative')
    if ck_name not in constraints and 'ck_assets_acquisition_cost_non_negative' not in constraints:
        op.create_check_constraint(ck_name, 'assets', 'acquisition_cost IS NULL OR acquisition_cost >= 0')


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    constraints = [c['name'] for c in inspector.get_check_constraints('assets')]
    ck_name = op.f('ck_assets_acquisition_cost_non_negative')
    if ck_name in constraints or 'ck_assets_acquisition_cost_non_negative' in constraints:
        op.drop_constraint(ck_name, 'assets', type_='check')
    cols = [c['name'] for c in inspector.get_columns('assets')]
    if 'acquisition_cost' in cols:
        op.drop_column('assets', 'acquisition_cost')
