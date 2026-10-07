"""Peminjaman oleh petugas: draf -> checkout (penyerahan) dengan row locking, ubah & batalkan draf."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Asset,
    AssetHistory,
    AssetStatus,
    Borrower,
    Borrowing,
    BorrowingItem,
    BorrowingStatus,
    NotificationEventCode,
)
from app.services.audit_service import record_audit


class BorrowingError(ValueError):
    def __init__(self, message: str, errors: dict[str, str] | None = None):
        super().__init__(message)
        self.errors = errors or {}


def next_transaction_number(session: Session, ref: date) -> str:
    prefix = f"PJM-{ref.year}-"
    last = session.scalar(
        select(func.max(Borrowing.transaction_number)).where(Borrowing.transaction_number.like(f"{prefix}%"))
    )
    n = int(last[len(prefix):]) + 1 if last and last[len(prefix):].isdigit() else 1
    return f"{prefix}{n:04d}"


def get_borrowings(
    session: Session,
    status: str | None = None,
    borrower_id: int | None = None,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Borrowing], int]:
    query = select(Borrowing)
    if status:
        query = query.where(Borrowing.status == status.upper())
    if borrower_id:
        query = query.where(Borrowing.borrower_id == borrower_id)
    if search:
        query = query.join(Borrower).where(
            Borrowing.transaction_number.ilike(f"%{search}%") | Borrower.name.ilike(f"%{search}%")
        )
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = list(session.scalars(
        query.order_by(Borrowing.id.desc()).offset((page - 1) * per_page).limit(per_page)
    ).all())
    return items, total


def get_borrowing_by_id(session: Session, borrowing_id: int) -> Borrowing | None:
    return session.get(Borrowing, borrowing_id)


def _validate_header(session: Session, data: dict[str, Any]) -> Borrower:
    borrower = session.get(Borrower, data["borrower_id"])
    if not borrower or not borrower.is_active or borrower.deleted_at is not None:
        raise BorrowingError("Peminjam tidak ditemukan atau tidak aktif", {"borrower_id": "Pilih peminjam dari master data."})
    if not borrower.email:
        raise BorrowingError("Peminjam belum memiliki email untuk notifikasi",
                             {"borrower_id": "Peminjam belum memiliki email untuk notifikasi."})
    return borrower


def _lock_available_assets(session: Session, asset_ids: list[int]) -> list[Asset]:
    """SELECT ... FOR UPDATE tiap aset (urut id untuk mencegah deadlock) dan validasi ketersediaan."""
    assets: list[Asset] = []
    bad: list[str] = []
    for asset_id in sorted(set(asset_ids)):
        asset = session.get(Asset, asset_id, with_for_update=True, populate_existing=True)
        if not asset or asset.deleted_at is not None:
            raise BorrowingError(f"Aset dengan ID {asset_id} tidak ditemukan", {"asset_ids": f"Aset {asset_id} tidak ditemukan."})
        if asset.status != AssetStatus.TERSEDIA.value or not asset.is_active:
            bad.append(f"{asset.inventory_code} ({asset.status})")
        assets.append(asset)
    if bad:
        msg = "Barang tidak tersedia: " + ", ".join(bad)
        raise BorrowingError(msg, {"asset_ids": msg})
    return assets


def _set_items(session: Session, borrowing: Borrowing, asset_ids: list[int]) -> None:
    for it in list(borrowing.items):
        session.delete(it)
    session.flush()
    for asset_id in dict.fromkeys(asset_ids):
        asset = session.get(Asset, asset_id)
        if not asset or asset.deleted_at is not None:
            raise BorrowingError(f"Aset dengan ID {asset_id} tidak ditemukan", {"asset_ids": f"Aset {asset_id} tidak ditemukan."})
        session.add(BorrowingItem(borrowing_id=borrowing.id, asset_id=asset_id, condition_out=asset.condition))
    session.flush()
    session.refresh(borrowing)


def _checkout(session: Session, borrowing: Borrowing, user_id: int, today: date | None = None) -> list[int]:
    """Serahkan barang: kunci aset, TERSEDIA -> DIPINJAM, riwayat, audit, notifikasi konfirmasi.

    Mengembalikan id notifikasi yang perlu dikirim (setelah commit).
    """
    from app.services.notification_service import create_event_notifications
    from app.services.settings_service import get_settings

    today = today or date.today()
    assets = _lock_available_assets(session, [it.asset_id for it in borrowing.items])
    now = datetime.now()
    for asset in assets:
        old = asset.status
        asset.status = AssetStatus.DIPINJAM.value
        session.add(AssetHistory(
            asset_id=asset.id, changed_by=user_id, event_type="CHECKOUT",
            old_status=old, new_status=AssetStatus.DIPINJAM.value,
            reason=f"Checkout {borrowing.transaction_number} — {borrowing.borrower.name}",
        ))
    by_asset = {a.id: a for a in assets}
    for it in borrowing.items:
        it.checked_out_at = now
        it.condition_out = by_asset[it.asset_id].condition
    borrowing.status = BorrowingStatus.TERLAMBAT.value if borrowing.due_date < today else BorrowingStatus.AKTIF.value
    borrowing.checked_out_at = now
    borrowing.checked_out_by = user_id
    borrowing.borrowed_at = now
    session.flush()
    session.refresh(borrowing)

    record_audit(session, "CHECKOUT", "borrowing", "borrowing", borrowing.id, user_id,
                 old_data={"status": BorrowingStatus.DRAF.value},
                 new_data={"status": borrowing.status, "transaction_number": borrowing.transaction_number,
                           "asset_ids": [a.id for a in assets]})

    settings = get_settings(session)
    if not settings.get("checkout_notify", True):
        return []
    notifs, _ = create_event_notifications(
        session, borrowing, NotificationEventCode.LOAN_CONFIRMATION.value, ["peminjam"], settings, today=today
    )
    return [n.id for n in notifs]


def create_borrowing(
    session: Session,
    data: dict[str, Any],
    user_id: int,
    checkout: bool = True,
) -> tuple[Borrowing, list[int]]:
    """Buat transaksi (DRAF), lalu checkout langsung bila ``checkout=True``.

    Seluruhnya dalam satu transaksi DB: bila ada barang yang tidak tersedia, tidak ada yang tersimpan.
    """
    for attempt in range(5):
        try:
            borrower = _validate_header(session, data)
            asset_ids = list(data["asset_ids"])
            if not checkout:
                # draf: validasi ketersediaan tanpa mengunci
                bad = [a for a in (session.get(Asset, i) for i in asset_ids)
                       if not a or a.deleted_at is not None or a.status != AssetStatus.TERSEDIA.value or not a.is_active]
                if bad:
                    msg = "Barang tidak tersedia: " + ", ".join(f"{a.inventory_code} ({a.status})" if a else "?" for a in bad)
                    raise BorrowingError(msg, {"asset_ids": msg})
            now = datetime.now()
            b = Borrowing(
                transaction_number=next_transaction_number(session, data["start_date"]),
                borrower_id=borrower.id,
                handled_by=user_id,
                borrowed_at=now,
                start_date=data["start_date"],
                due_date=data["due_date"],
                purpose=(data.get("purpose") or "").strip() or None,
                notes=(data.get("notes") or "").strip() or None,
                status=BorrowingStatus.DRAF.value,
            )
            session.add(b)
            session.flush()
            _set_items(session, b, asset_ids)
            record_audit(session, "CREATE", "borrowing", "borrowing", b.id, user_id, new_data={
                "transaction_number": b.transaction_number, "borrower_id": borrower.id,
                "borrower_name": borrower.name, "asset_ids": asset_ids, "due_date": str(b.due_date),
                "status": BorrowingStatus.DRAF.value,
            })
            notif_ids = _checkout(session, b, user_id) if checkout else []
            session.commit()
            return b, notif_ids
        except IntegrityError as exc:
            session.rollback()
            if "transaction_number" not in str(exc.orig) or attempt == 4:
                raise BorrowingError("Gagal menyimpan transaksi (konflik data). Coba lagi.") from exc
        except Exception:
            session.rollback()
            raise
    raise BorrowingError("Gagal membuat nomor transaksi unik")


def checkout_borrowing(session: Session, borrowing_id: int, user_id: int) -> tuple[Borrowing, list[int]]:
    b = session.get(Borrowing, borrowing_id, with_for_update=True)
    if not b:
        raise BorrowingError("Transaksi peminjaman tidak ditemukan")
    if b.status != BorrowingStatus.DRAF.value:
        raise BorrowingError("Hanya transaksi berstatus DRAF yang dapat di-checkout.")
    try:
        ids = _checkout(session, b, user_id)
        session.commit()
        return b, ids
    except Exception:
        session.rollback()
        raise


def update_draft(session: Session, borrowing_id: int, data: dict[str, Any], user_id: int) -> Borrowing:
    b = session.get(Borrowing, borrowing_id)
    if not b:
        raise BorrowingError("Transaksi peminjaman tidak ditemukan")
    if b.status != BorrowingStatus.DRAF.value:
        raise BorrowingError("Hanya draf yang dapat diubah.")
    try:
        borrower = _validate_header(session, data)
        old = {"borrower_id": b.borrower_id, "due_date": str(b.due_date), "purpose": b.purpose,
               "asset_ids": [it.asset_id for it in b.items]}
        b.borrower_id = borrower.id
        b.start_date = data["start_date"]
        b.due_date = data["due_date"]
        b.purpose = (data.get("purpose") or "").strip() or None
        b.notes = (data.get("notes") or "").strip() or None
        _set_items(session, b, list(data["asset_ids"]))
        record_audit(session, "UPDATE", "borrowing", "borrowing", b.id, user_id, old_data=old, new_data={
            "borrower_id": borrower.id, "due_date": str(b.due_date), "purpose": b.purpose,
            "asset_ids": list(data["asset_ids"]),
        })
        session.commit()
        return b
    except Exception:
        session.rollback()
        raise


def cancel_borrowing(session: Session, borrowing_id: int, reason: str, user_id: int) -> Borrowing:
    b = session.get(Borrowing, borrowing_id)
    if not b:
        raise BorrowingError("Transaksi peminjaman tidak ditemukan")
    if b.status != BorrowingStatus.DRAF.value:
        raise BorrowingError("Hanya draf yang dapat dibatalkan.")
    b.status = BorrowingStatus.DIBATALKAN.value
    b.cancelled_at = datetime.now()
    b.cancel_reason = reason or None
    record_audit(session, "CANCEL", "borrowing", "borrowing", b.id, user_id,
                 old_data={"status": BorrowingStatus.DRAF.value},
                 new_data={"status": BorrowingStatus.DIBATALKAN.value, "reason": reason})
    session.commit()
    return b
