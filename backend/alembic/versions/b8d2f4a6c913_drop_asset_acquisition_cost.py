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
    # Catatan: Kolom acquisition_cost sempat di-drop pada revisi ini namun segera dikembalikan
    # pada revisi c3e7a9d1f052. Agar upgrade dari revisi sebelumnya (d4e8b1a5f920 / e5f0a2c4b7d1)
    # tidak menyebabkan kehilangan data nilai perolehan aset, operasi drop ini diabaikan (no-op).
    pass


def downgrade() -> None:
    pass
