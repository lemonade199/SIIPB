"""Return Processing Service with Condition Evaluation and Incident Reporting."""
from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Asset,
    AssetHistory,
    AssetStatus,
    Borrowing,
    BorrowingItem,
    BorrowingStatus,
    DamageReport,
    LossReport,
    NotificationEvent,
    NotificationEventCode,
    NotificationEventStatus,
    RepairStatus,
    Return,
    ReturnCondition,
    ReturnItem,
)
from app.services.audit_service import record_audit


def get_returns(session: Session, borrowing_id: int | None = None, page: int = 1, per_page: int = 20) -> tuple[list[Return], int]:
    query = select(Return)
    if borrowing_id:
        query = query.where(Return.borrowing_id == borrowing_id)

    total = len(session.scalars(query).all())
    items = list(
        session.scalars(
            query.order_by(Return.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
    )
    return items, total


def get_return_by_id(session: Session, return_id: int) -> Return | None:
    return session.get(Return, return_id)


def process_return(
    session: Session,
    borrowing_id: int,
    received_by: int,
    items_data: list[dict[str, Any]],
    notes: str | None = None,
) -> Return:
    """Process return of borrowed items (supports partial or complete returns)."""
    # 1. Validate Borrowing exists and is open
    borrowing = session.get(Borrowing, borrowing_id)
    if not borrowing:
        raise ValueError("Transaksi peminjaman tidak ditemukan")

    if borrowing.status not in (BorrowingStatus.AKTIF.value, BorrowingStatus.TERLAMBAT.value):
        raise ValueError(f"Transaksi ini tidak dalam status aktif/terlambat (Status: {borrowing.status})")

    now = datetime.now()

    # 2. Create Return Header
    return_header = Return(
        borrowing_id=borrowing.id,
        received_by=received_by,
        returned_at=now,
        notes=notes,
    )
    session.add(return_header)
    session.flush()

    processed_item_ids: set[int] = set()

    # 3. Process each returned item
    for item_input in items_data:
        borrowing_item_id = item_input["borrowing_item_id"]
        asset_id = item_input["asset_id"]
        final_condition = item_input["final_condition"].upper()
        completeness = item_input.get("completeness")
        item_notes = item_input.get("notes")

        # Validate borrowing item belongs to this borrowing
        b_item = session.get(BorrowingItem, borrowing_item_id)
        if not b_item or b_item.borrowing_id != borrowing.id or b_item.asset_id != asset_id:
            raise ValueError(f"Borrowing item ID {borrowing_item_id} tidak valid untuk transaksi ini")

        # Check if already returned
        existing_return_item = session.scalars(
            select(ReturnItem).where(ReturnItem.borrowing_item_id == borrowing_item_id)
        ).first()
        if existing_return_item:
            raise ValueError(f"Barang {b_item.asset.name} sudah pernah dikembalikan sebelumnya")

        # Lock and load asset
        asset = session.get(Asset, asset_id, with_for_update=True)
        if not asset:
            raise ValueError(f"Aset ID {asset_id} tidak ditemukan")

        # Create ReturnItem record
        ret_item = ReturnItem(
            return_id=return_header.id,
            borrowing_item_id=borrowing_item_id,
            asset_id=asset.id,
            final_condition=final_condition,
            completeness=completeness,
            notes=item_notes,
        )
        session.add(ret_item)
        session.flush()

        old_status = asset.status

        # 4. Handle Status Transitions based on final_condition
        if final_condition == ReturnCondition.BAIK.value:
            asset.status = AssetStatus.TERSEDIA.value
            new_status = AssetStatus.TERSEDIA.value
            event_type = "RETURNED_GOOD"
            reason = f"Dikembalikan dalam kondisi baik (TX: {borrowing.transaction_number})"

        elif final_condition == ReturnCondition.RUSAK.value:
            asset.status = AssetStatus.RUSAK.value
            new_status = AssetStatus.RUSAK.value
            event_type = "RETURNED_DAMAGED"
            reason = f"Dikembalikan dalam kondisi rusak (TX: {borrowing.transaction_number})"

            # Create Damage Report
            dmg_data = item_input.get("damage") or {}
            damage_report = DamageReport(
                return_item_id=ret_item.id,
                reported_by=received_by,
                severity=dmg_data.get("severity", "SEDANG").upper(),
                description=dmg_data.get("description", "Kerusakan saat peminjaman"),
                evidence_path=dmg_data.get("evidence_path"),
                action_taken=dmg_data.get("action_taken"),
                repair_status=RepairStatus.DILAPORKAN.value,
                repair_cost=dmg_data.get("repair_cost"),
                reported_at=now,
            )
            session.add(damage_report)

        elif final_condition == ReturnCondition.HILANG.value:
            asset.status = AssetStatus.HILANG.value
            new_status = AssetStatus.HILANG.value
            event_type = "RETURNED_LOST"
            reason = f"Dilaporkan hilang saat peminjaman (TX: {borrowing.transaction_number})"

            # Create Loss Report
            loss_data = item_input.get("loss") or {}
            loss_report = LossReport(
                return_item_id=ret_item.id,
                reported_by=received_by,
                description=loss_data.get("description", "Barang hilang saat peminjaman"),
                evidence_path=loss_data.get("evidence_path"),
                action_taken=loss_data.get("action_taken"),
                reported_at=now,
            )
            session.add(loss_report)

        else:
            raise ValueError(f"Kondisi pengembalian '{final_condition}' tidak valid")

        # 5. Append to Asset History
        history = AssetHistory(
            asset_id=asset.id,
            changed_by=received_by,
            event_type=event_type,
            old_status=old_status,
            new_status=new_status,
            reason=reason,
        )
        session.add(history)
        processed_item_ids.add(borrowing_item_id)

    # 6. Check if ALL items in this borrowing are returned
    total_borrowing_items = len(borrowing.items)
    all_returned_query = select(ReturnItem.borrowing_item_id).where(
        ReturnItem.borrowing_item_id.in_([it.id for it in borrowing.items])
    )
    returned_count = len(session.scalars(all_returned_query).all())

    if returned_count >= total_borrowing_items:
        borrowing.status = BorrowingStatus.DIKEMBALIKAN.value

    # 7. Create Idempotent Notification Event for Return Confirmation
    notif_event = NotificationEvent(
        borrowing_id=borrowing.id,
        event_code=NotificationEventCode.RETURN_CONFIRMATION.value,
        scheduled_at=now,
        status=NotificationEventStatus.PENDING.value,
    )
    session.add(notif_event)

    # 8. Record Audit Log
    record_audit(
        session=session,
        action="RETURN_PROCESSED",
        module="return",
        entity_type="return",
        entity_id=return_header.id,
        user_id=received_by,
        new_data={
            "borrowing_id": borrowing.id,
            "transaction_number": borrowing.transaction_number,
            "items_returned_count": len(items_data),
            "borrowing_completed": borrowing.status == BorrowingStatus.DIKEMBALIKAN.value,
        },
    )

    session.commit()
    return return_header
