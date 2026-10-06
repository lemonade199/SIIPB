"""Borrowing and Checkout Service with Database Transaction and Row Locking."""
from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Asset,
    AssetHistory,
    AssetStatus,
    Borrower,
    Borrowing,
    BorrowingItem,
    BorrowingStatus,
    NotificationEvent,
    NotificationEventCode,
    NotificationEventStatus,
)
from app.services.audit_service import record_audit


def generate_transaction_number() -> str:
    """Generate unique borrowing transaction number, e.g. TX-20261006123456-ABCD."""
    import uuid
    now = datetime.now()
    timestamp_str = now.strftime("%Y%m%d%H%M%S")
    suffix = uuid.uuid4().hex[:4].upper()
    return f"TX-{timestamp_str}-{suffix}"


def get_borrowings(
    session: Session,
    status: str | None = None,
    borrower_id: int | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Borrowing], int]:
    query = select(Borrowing)
    if status:
        query = query.where(Borrowing.status == status.upper())
    if borrower_id:
        query = query.where(Borrowing.borrower_id == borrower_id)

    total = len(session.scalars(query).all())
    items = list(
        session.scalars(
            query.order_by(Borrowing.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
    )
    return items, total


def get_borrowing_by_id(session: Session, borrowing_id: int) -> Borrowing | None:
    return session.get(Borrowing, borrowing_id)


def checkout_borrowing(
    session: Session,
    borrower_id: int,
    handled_by: int,
    start_date: Any,
    due_date: Any,
    asset_ids: list[int],
    purpose: str | None = None,
    notes: str | None = None,
) -> Borrowing:
    """Execute checkout in a strict database transaction with row-level locking (SELECT FOR UPDATE).

    Guarantees that two concurrent checkout requests on the same asset will not succeed simultaneously.
    """
    # 1. Validate Borrower exists and is active
    borrower = session.get(Borrower, borrower_id)
    if not borrower or not borrower.is_active or borrower.deleted_at is not None:
        raise ValueError("Peminjam tidak ditemukan atau tidak aktif")

    now = datetime.now()
    tx_number = generate_transaction_number()

    # 2. Create Borrowing Header
    borrowing = Borrowing(
        transaction_number=tx_number,
        borrower_id=borrower_id,
        handled_by=handled_by,
        borrowed_at=now,
        start_date=start_date,
        due_date=due_date,
        purpose=purpose,
        notes=notes,
        status=BorrowingStatus.AKTIF.value,
    )
    session.add(borrowing)
    session.flush()

    checked_out_assets: list[Asset] = []

    # 3. Lock each asset row with FOR UPDATE and validate availability
    for asset_id in asset_ids:
        # Strict Row Locking: SELECT ... FOR UPDATE
        asset = session.get(Asset, asset_id, with_for_update=True)
        if not asset or asset.deleted_at is not None:
            raise ValueError(f"Aset dengan ID {asset_id} tidak ditemukan")

        # Check non-borrowable status (TERSEDIA is the only borrowable status)
        if asset.status != AssetStatus.TERSEDIA.value or not asset.is_active:
            raise ValueError(
                f"Aset '{asset.name}' ({asset.inventory_code}) tidak tersedia untuk dipinjam (Status saat ini: {asset.status})"
            )

        # 4. Create Borrowing Item
        item = BorrowingItem(
            borrowing_id=borrowing.id,
            asset_id=asset.id,
            checked_out_at=now,
        )
        session.add(item)

        # 5. Transition Asset status: TERSEDIA -> DIPINJAM
        old_status = asset.status
        asset.status = AssetStatus.DIPINJAM.value

        # 6. Append to Asset History
        history = AssetHistory(
            asset_id=asset.id,
            changed_by=handled_by,
            event_type="CHECKOUT",
            old_status=old_status,
            new_status=AssetStatus.DIPINJAM.value,
            reason=f"Dipinjam pada transaksi {tx_number} oleh {borrower.name}",
        )
        session.add(history)
        checked_out_assets.append(asset)

    # 7. Create Idempotent Notification Event for loan confirmation
    notif_event = NotificationEvent(
        borrowing_id=borrowing.id,
        event_code=NotificationEventCode.LOAN_CONFIRMATION.value,
        scheduled_at=now,
        status=NotificationEventStatus.PENDING.value,
    )
    session.add(notif_event)

    # 8. Record Audit Log
    record_audit(
        session=session,
        action="CHECKOUT_CREATED",
        module="borrowing",
        entity_type="borrowing",
        entity_id=borrowing.id,
        user_id=handled_by,
        new_data={
            "transaction_number": tx_number,
            "borrower_id": borrower_id,
            "borrower_name": borrower.name,
            "asset_ids": asset_ids,
            "due_date": str(due_date),
        },
    )

    session.commit()
    return borrowing
