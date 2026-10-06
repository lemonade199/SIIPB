"""Dashboard statistics and summary service querying directly from existing tables."""
from datetime import date
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Asset,
    AssetStatus,
    Borrowing,
    BorrowingStatus,
    DamageReport,
    LossReport,
    RepairStatus,
    Return,
)


def get_dashboard_summary(session: Session) -> dict:
    """Compute real-time dashboard analytics directly from existing MariaDB tables."""
    today = date.today()

    # 1. Asset statistics
    total_assets = session.scalar(
        select(func.count(Asset.id)).where(Asset.deleted_at.is_(None))
    ) or 0

    assets_tersedia = session.scalar(
        select(func.count(Asset.id)).where(
            Asset.status == AssetStatus.TERSEDIA.value,
            Asset.deleted_at.is_(None),
        )
    ) or 0

    assets_dipinjam = session.scalar(
        select(func.count(Asset.id)).where(
            Asset.status == AssetStatus.DIPINJAM.value,
            Asset.deleted_at.is_(None),
        )
    ) or 0

    assets_rusak = session.scalar(
        select(func.count(Asset.id)).where(
            Asset.status.in_([AssetStatus.RUSAK.value, AssetStatus.RUSAK_BERAT.value]),
            Asset.deleted_at.is_(None),
        )
    ) or 0

    assets_hilang = session.scalar(
        select(func.count(Asset.id)).where(
            Asset.status == AssetStatus.HILANG.value,
            Asset.deleted_at.is_(None),
        )
    ) or 0

    # 2. Borrowing statistics
    borrowing_aktif = session.scalar(
        select(func.count(Borrowing.id)).where(Borrowing.status == BorrowingStatus.AKTIF.value)
    ) or 0

    borrowing_terlambat = session.scalar(
        select(func.count(Borrowing.id)).where(
            (Borrowing.status == BorrowingStatus.TERLAMBAT.value)
            | ((Borrowing.status == BorrowingStatus.AKTIF.value) & (Borrowing.due_date < today))
        )
    ) or 0

    # 3. Incident reports
    total_damage_reports = session.scalar(select(func.count(DamageReport.id))) or 0
    pending_repairs = session.scalar(
        select(func.count(DamageReport.id)).where(
            DamageReport.repair_status.in_([RepairStatus.DILAPORKAN.value, RepairStatus.DALAM_PERBAIKAN.value])
        )
    ) or 0

    total_loss_reports = session.scalar(select(func.count(LossReport.id))) or 0

    # 4. Recent returns
    recent_returns_query = (
        select(Return)
        .order_by(Return.returned_at.desc())
        .limit(5)
    )
    recent_returns = session.scalars(recent_returns_query).all()

    return {
        "assets": {
            "total": total_assets,
            "tersedia": assets_tersedia,
            "dipinjam": assets_dipinjam,
            "rusak": assets_rusak,
            "hilang": assets_hilang,
        },
        "borrowings": {
            "aktif": borrowing_aktif,
            "terlambat": borrowing_terlambat,
        },
        "incidents": {
            "total_damage": total_damage_reports,
            "pending_repairs": pending_repairs,
            "total_loss": total_loss_reports,
        },
        "recent_returns": [
            {
                "id": r.id,
                "borrowing_id": r.borrowing_id,
                "transaction_number": r.borrowing.transaction_number,
                "returned_at": r.returned_at.isoformat(),
                "items_count": len(r.items),
            }
            for r in recent_returns
        ],
    }
