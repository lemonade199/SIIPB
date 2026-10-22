"""normalize phone numbers (users, borrowers) and borrower NIP to a uniform digits-only format

Revision ID: e5f0a2c4b7d1
Revises: d4e8b1a5f920
Create Date: 2026-10-21 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.utils.validators import nip_error, normalize_nip, normalize_phone, phone_error

revision: str = 'e5f0a2c4b7d1'
down_revision: Union[str, None] = 'd4e8b1a5f920'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Hanya nilai yang valid setelah dinormalisasi yang diubah; nilai lain dibiarkan untuk diperbaiki lewat aplikasi.
    for table in ('users', 'borrowers'):
        rows = conn.execute(sa.text(f"SELECT id, phone FROM {table} WHERE phone IS NOT NULL AND phone <> ''")).fetchall()
        for row_id, phone in rows:
            clean = normalize_phone(phone)
            if clean != phone and not phone_error(clean):
                conn.execute(sa.text(f"UPDATE {table} SET phone = :p WHERE id = :i"), {"p": clean, "i": row_id})

    rows = conn.execute(sa.text("SELECT id, identity_number FROM borrowers WHERE identity_number IS NOT NULL")).fetchall()
    for row_id, nip in rows:
        clean = normalize_nip(nip)
        if clean != nip and not nip_error(clean):
            conn.execute(sa.text("UPDATE borrowers SET identity_number = :n WHERE id = :i"), {"n": clean, "i": row_id})


def downgrade() -> None:
    # Normalisasi format tidak dapat dikembalikan (format asli tidak disimpan).
    pass
