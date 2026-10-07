"""Dashboard statistics and summary service querying directly from existing tables."""
from datetime import date, datetime
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
        select(func.count(Asset.id)).where(Asset.deleted_at.is_(None), Asset.is_active.is_(True))
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
            Asset.status.in_([AssetStatus.RUSAK.value, AssetStatus.RUSAK_BERAT.value, AssetStatus.DALAM_PERBAIKAN.value]),
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
        select(func.count(Borrowing.id)).where(
            Borrowing.status.in_([BorrowingStatus.AKTIF.value, BorrowingStatus.TERLAMBAT.value])
        )
    ) or 0
    borrowing_draf = session.scalar(
        select(func.count(Borrowing.id)).where(Borrowing.status == BorrowingStatus.DRAF.value)
    ) or 0
    due_today = session.scalar(
        select(func.count(Borrowing.id)).where(
            Borrowing.status.in_([BorrowingStatus.AKTIF.value, BorrowingStatus.TERLAMBAT.value]),
            Borrowing.due_date == today,
        )
    ) or 0
    due_soon = session.scalar(
        select(func.count(Borrowing.id)).where(
            Borrowing.status == BorrowingStatus.AKTIF.value,
            Borrowing.due_date > today,
            Borrowing.due_date <= date.fromordinal(today.toordinal() + 3),
        )
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
            "draf": borrowing_draf,
            "jatuh_tempo_hari_ini": due_today,
            "jatuh_tempo_3_hari": due_soon,
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
                "returned_at": r.returned_at.isoformat() if r.returned_at else None,
                "items_count": len(r.items),
            }
            for r in recent_returns
        ],
    }


def get_overdue(session: Session, today: date | None = None) -> list[dict]:
    """Transaksi yang melewati batas pengembalian (AKTIF lewat tempo atau TERLAMBAT)."""
    today = today or date.today()
    rows = session.scalars(
        select(Borrowing)
        .where(Borrowing.status.in_([BorrowingStatus.AKTIF.value, BorrowingStatus.TERLAMBAT.value]))
        .where(Borrowing.due_date < today)
        .order_by(Borrowing.due_date.asc())
    ).all()
    return [
        {
            "id": b.id,
            "transaction_number": b.transaction_number,
            "borrower_id": b.borrower_id,
            "borrower_name": b.borrower.name,
            "borrower_email": b.borrower.email,
            "borrower_phone": b.borrower.phone,
            "unit_name": b.borrower.unit.name if b.borrower.unit else None,
            "start_date": b.start_date.isoformat(),
            "due_date": b.due_date.isoformat(),
            "late_days": (today - b.due_date).days,
            "status": b.status,
            "items": [{"asset_id": it.asset_id, "name": it.asset.name, "inventory_code": it.asset.inventory_code} for it in b.items],
            "escalation": "H+7" if (today - b.due_date).days >= 7 else "H+3" if (today - b.due_date).days >= 3 else "H+1",
        }
        for b in rows
    ]


def get_statistics(session: Session, months: int = 12, today: date | None = None) -> dict:
    """Statistik untuk pimpinan: tren bulanan, barang terpopuler, distribusi status, ketepatan waktu."""
    from app.models import BorrowingItem, Category, ReturnItem

    today = today or date.today()
    months = max(1, min(months, 36))
    # awal periode = hari pertama bulan (months-1) bulan lalu
    y, m = today.year, today.month - (months - 1)
    while m <= 0:
        m += 12
        y -= 1
    start = date(y, m, 1)

    def ym(d) -> str:
        return f"{d.year:04d}-{d.month:02d}"

    keys = []
    cy, cm = start.year, start.month
    for _ in range(months):
        keys.append(f"{cy:04d}-{cm:02d}")
        cm += 1
        if cm > 12:
            cm, cy = 1, cy + 1
    borrow_counts = {k: 0 for k in keys}
    return_counts = {k: 0 for k in keys}
    for b in session.scalars(select(Borrowing).where(Borrowing.start_date >= start, Borrowing.status != BorrowingStatus.DRAF.value, Borrowing.status != BorrowingStatus.DIBATALKAN.value)).all():
        borrow_counts[ym(b.start_date)] = borrow_counts.get(ym(b.start_date), 0) + 1
    returns = session.scalars(select(Return).where(Return.returned_at >= datetime.combine(start, datetime.min.time()))).all()
    on_time = late = 0
    for r in returns:
        return_counts[ym(r.returned_at)] = return_counts.get(ym(r.returned_at), 0) + 1
        if r.returned_at.date() <= r.borrowing.due_date:
            on_time += 1
        else:
            late += 1

    top = session.execute(
        select(Asset.id, Asset.inventory_code, Asset.name, func.count(BorrowingItem.id).label("n"))
        .join(BorrowingItem, BorrowingItem.asset_id == Asset.id)
        .join(Borrowing, Borrowing.id == BorrowingItem.borrowing_id)
        .where(Borrowing.status.notin_([BorrowingStatus.DRAF.value, BorrowingStatus.DIBATALKAN.value]))
        .group_by(Asset.id, Asset.inventory_code, Asset.name)
        .order_by(func.count(BorrowingItem.id).desc())
        .limit(10)
    ).all()
    by_category = session.execute(
        select(Category.name, func.count(Asset.id))
        .join(Asset, Asset.category_id == Category.id)
        .where(Asset.deleted_at.is_(None))
        .group_by(Category.name)
        .order_by(Category.name)
    ).all()
    by_status = session.execute(
        select(Asset.status, func.count(Asset.id)).where(Asset.deleted_at.is_(None), Asset.is_active.is_(True)).group_by(Asset.status)
    ).all()
    return_conditions = session.execute(
        select(ReturnItem.final_condition, func.count(ReturnItem.id)).group_by(ReturnItem.final_condition)
    ).all()
    total_returns = on_time + late
    return {
        "period": {"from": start.isoformat(), "to": today.isoformat(), "months": months},
        "monthly": [{"month": k, "borrowings": borrow_counts.get(k, 0), "returns": return_counts.get(k, 0)} for k in keys],
        "top_items": [{"asset_id": r[0], "inventory_code": r[1], "name": r[2], "count": r[3]} for r in top],
        "assets_by_category": [{"category": r[0], "count": r[1]} for r in by_category],
        "assets_by_status": {r[0]: r[1] for r in by_status},
        "return_conditions": {r[0]: r[1] for r in return_conditions},
        "on_time_returns": on_time,
        "late_returns": late,
        "on_time_rate": round(on_time / total_returns * 100, 1) if total_returns else None,
    }
