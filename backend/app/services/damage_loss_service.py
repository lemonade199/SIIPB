"""Damage and Loss Incident Reports Service."""
from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Asset, AssetHistory, AssetStatus, DamageReport, LossReport, RepairStatus
from app.services.audit_service import record_audit


def get_damage_reports(
    session: Session,
    repair_status: str | None = None,
    severity: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[DamageReport], int]:
    query = select(DamageReport)
    if repair_status:
        query = query.where(DamageReport.repair_status == repair_status.upper())
    if severity:
        query = query.where(DamageReport.severity == severity.upper())

    total = len(session.scalars(query).all())
    items = list(
        session.scalars(
            query.order_by(DamageReport.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
    )
    return items, total


def update_damage_repair_status(
    session: Session,
    report_id: int,
    repair_status: str,
    action_taken: str | None = None,
    repair_cost: Any = None,
    user_id: int | None = None,
) -> DamageReport:
    """Progress damage report through its repair lifecycle."""
    report = session.get(DamageReport, report_id)
    if not report:
        raise ValueError("Laporan kerusakan tidak ditemukan")

    old_status = report.repair_status
    report.repair_status = repair_status.upper()
    if action_taken:
        report.action_taken = action_taken
    if repair_cost is not None:
        report.repair_cost = repair_cost

    now = datetime.now()

    # If repaired (SELESAI), restore asset to TERSEDIA and condition BAIK
    asset = report.return_item.asset
    damaged = {AssetStatus.RUSAK.value, AssetStatus.RUSAK_BERAT.value, AssetStatus.DALAM_PERBAIKAN.value}
    old_asset_status = asset.status
    target = {
        RepairStatus.SELESAI.value: AssetStatus.TERSEDIA.value,
        RepairStatus.DALAM_PERBAIKAN.value: AssetStatus.DALAM_PERBAIKAN.value,
        RepairStatus.TIDAK_DAPAT_DIPERBAIKI.value: AssetStatus.RUSAK_BERAT.value,
    }.get(report.repair_status)
    if report.repair_status in (RepairStatus.SELESAI.value, RepairStatus.TIDAK_DAPAT_DIPERBAIKI.value):
        report.resolved_at = now
    # status aset hanya diubah bila aset masih dalam status kerusakan (tidak sedang dipinjam ulang)
    if target and old_asset_status in damaged and target != old_asset_status:
        asset.status = target
        if target == AssetStatus.TERSEDIA.value:
            asset.condition = "BAIK"
        elif target == AssetStatus.RUSAK_BERAT.value:
            asset.condition = "RUSAK_BERAT"
        session.add(AssetHistory(
            asset_id=asset.id,
            changed_by=user_id,
            event_type="REPAIR_COMPLETED" if target == AssetStatus.TERSEDIA.value else "STATUS_CHANGED",
            old_status=old_asset_status,
            new_status=target,
            reason=f"Laporan kerusakan #{report.id}: {report.repair_status}",
        ))

    record_audit(
        session=session,
        action="DAMAGE_STATUS_UPDATED",
        module="damage",
        entity_type="damage_report",
        entity_id=report.id,
        user_id=user_id,
        old_data={"repair_status": old_status},
        new_data={"repair_status": report.repair_status, "repair_cost": str(report.repair_cost)},
    )

    session.commit()
    return report


def get_loss_reports(session: Session, page: int = 1, per_page: int = 20) -> tuple[list[LossReport], int]:
    query = select(LossReport)
    total = len(session.scalars(query).all())
    items = list(
        session.scalars(
            query.order_by(LossReport.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
    )
    return items, total
