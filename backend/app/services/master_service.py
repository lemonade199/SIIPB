"""Master data: unit kerja, kategori, lokasi, peminjam (pegawai/siswa — tanpa akun)."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Asset, Borrower, Borrowing, BorrowingStatus, Category, Location, OrganizationalUnit, User
from app.services.audit_service import record_audit


class MasterError(ValueError):
    def __init__(self, message: str, errors: dict[str, str] | None = None, status: int = 400):
        super().__init__(message)
        self.errors = errors or {}
        self.status = status


MODELS = {
    "unit": (OrganizationalUnit, "organizational_unit"),
    "category": (Category, "category"),
    "location": (Location, "location"),
    "borrower": (Borrower, "borrower"),
}


def _soft(model) -> bool:
    return hasattr(model, "deleted_at")


def list_rows(session: Session, kind: str, include_inactive: bool = False) -> list:
    model, _ = MODELS[kind]
    q = select(model)
    if _soft(model):
        q = q.where(model.deleted_at.is_(None))
    if not include_inactive:
        q = q.where(model.is_active.is_(True))
    return list(session.scalars(q.order_by(model.name)).all())


def _get(session: Session, kind: str, row_id: int):
    model, _ = MODELS[kind]
    row = session.get(model, row_id)
    if not row or (_soft(model) and row.deleted_at is not None):
        raise MasterError("Data tidak ditemukan", status=404)
    return row


def _unique_code(session: Session, kind: str, code: str | None, row_id: int | None = None) -> None:
    model, _ = MODELS[kind]
    if not code or not hasattr(model, "code"):
        return
    q = select(model).where(model.code == code)
    if row_id:
        q = q.where(model.id != row_id)
    if session.scalars(q).first():
        raise MasterError(f"Kode '{code}' sudah digunakan", {"code": "Kode sudah digunakan."})


def _unique_identity(session: Session, data: dict[str, Any], row_id: int | None = None) -> None:
    nip = (data.get("identity_number") or "").strip()
    if not nip:
        return
    q = select(Borrower).where(Borrower.identity_number == nip, Borrower.deleted_at.is_(None))
    if row_id:
        q = q.where(Borrower.id != row_id)
    if session.scalars(q).first():
        raise MasterError("NIP / nomor induk sudah terdaftar", {"identity_number": "NIP / nomor induk sudah terdaftar."})


def create_row(session: Session, kind: str, data: dict[str, Any], user_id: int):
    model, entity = MODELS[kind]
    _unique_code(session, kind, data.get("code"))
    if kind == "borrower":
        _unique_identity(session, data)
    row = model(**data)
    session.add(row)
    session.flush()
    record_audit(session, "CREATE", "masterdata", entity, row.id, user_id, new_data=data)
    session.commit()
    return row


def update_row(session: Session, kind: str, row_id: int, data: dict[str, Any], user_id: int):
    model, entity = MODELS[kind]
    row = _get(session, kind, row_id)
    _unique_code(session, kind, data.get("code"), row_id)
    if kind == "borrower":
        _unique_identity(session, data, row_id)
    if data.get("is_active") is False:
        _check_can_deactivate(session, kind, row)
    if data.get("parent_id") and data["parent_id"] == row_id:
        raise MasterError("Induk tidak boleh dirinya sendiri", {"parent_id": "Induk tidak valid."})
    old = {k: getattr(row, k) for k in data if hasattr(row, k)}
    for k, v in data.items():
        setattr(row, k, v)
    record_audit(session, "UPDATE", "masterdata", entity, row.id, user_id, old_data=old, new_data=data)
    session.commit()
    return row


def _check_can_deactivate(session: Session, kind: str, row) -> None:
    if kind == "borrower":
        active = session.scalar(select(func.count(Borrowing.id)).where(
            Borrowing.borrower_id == row.id,
            Borrowing.status.in_([BorrowingStatus.AKTIF.value, BorrowingStatus.TERLAMBAT.value, BorrowingStatus.DRAF.value]),
        ))
        if active:
            raise MasterError("Peminjam masih memiliki pinjaman aktif.")


def _is_used(session: Session, kind: str, row) -> bool:
    if kind == "category":
        return bool(session.scalar(select(func.count(Asset.id)).where(Asset.category_id == row.id)))
    if kind == "location":
        return bool(session.scalar(select(func.count(Asset.id)).where(Asset.location_id == row.id))
                    or session.scalar(select(func.count(Location.id)).where(Location.parent_id == row.id)))
    if kind == "unit":
        return bool(session.scalar(select(func.count(Borrower.id)).where(Borrower.unit_id == row.id))
                    or session.scalar(select(func.count(User.id)).where(User.unit_id == row.id))
                    or session.scalar(select(func.count(Asset.id)).where(Asset.owner_unit_id == row.id))
                    or session.scalar(select(func.count(OrganizationalUnit.id)).where(OrganizationalUnit.parent_id == row.id)))
    if kind == "borrower":
        return bool(session.scalar(select(func.count(Borrowing.id)).where(Borrowing.borrower_id == row.id)))
    return False


def delete_row(session: Session, kind: str, row_id: int, user_id: int) -> None:
    """Hapus hanya bila belum dipakai; data yang sudah dipakai cukup dinonaktifkan."""
    model, entity = MODELS[kind]
    row = _get(session, kind, row_id)
    if _is_used(session, kind, row):
        raise MasterError("Data sudah dipakai sehingga tidak dapat dihapus. Gunakan nonaktifkan.")
    record_audit(session, "DELETE", "masterdata", entity, row.id, user_id, old_data={"name": row.name})
    if _soft(model):
        row.deleted_at = datetime.now()
        row.is_active = False
        if hasattr(row, "code"):
            row.code = f"{row.code}~{row.id}"[:50]  # bebaskan kode unik
    else:
        session.delete(row)
    session.commit()


# ---- kompatibilitas fungsi lama ----
def get_borrowers(session: Session, search: str | None = None, unit_id: int | None = None, active_only: bool = True,
                  page: int = 1, per_page: int = 20) -> tuple[list[Borrower], int]:
    query = select(Borrower).where(Borrower.deleted_at.is_(None))
    if active_only:
        query = query.where(Borrower.is_active.is_(True))
    if unit_id:
        query = query.where(Borrower.unit_id == unit_id)
    if search:
        query = query.where(Borrower.name.ilike(f"%{search}%") | Borrower.identity_number.ilike(f"%{search}%")
                            | Borrower.email.ilike(f"%{search}%"))
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = list(session.scalars(query.order_by(Borrower.name.asc()).offset((page - 1) * per_page).limit(per_page)).all())
    return items, total
