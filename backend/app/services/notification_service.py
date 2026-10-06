"""Idempotent notification event creation and email delivery management service."""
from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Borrowing,
    EmailDelivery,
    EmailDeliveryStatus,
    Notification,
    NotificationChannel,
    NotificationEvent,
    NotificationEventCode,
    NotificationEventStatus,
    NotificationLog,
    NotificationStatus,
    NotificationTemplate,
)


def create_idempotent_event(
    session: Session,
    borrowing_id: int,
    event_code: str,
    scheduled_at: datetime | None = None,
) -> NotificationEvent | None:
    """Create a notification event only if one does not already exist for this (borrowing_id, event_code)."""
    # 1. Check existing event (Idempotency guarantee)
    existing = session.scalars(
        select(NotificationEvent).where(
            NotificationEvent.borrowing_id == borrowing_id,
            NotificationEvent.event_code == event_code,
        )
    ).first()

    if existing:
        return existing  # Already scheduled or processed, return without duplicate

    event = NotificationEvent(
        borrowing_id=borrowing_id,
        event_code=event_code,
        scheduled_at=scheduled_at or datetime.now(),
        status=NotificationEventStatus.PENDING.value,
    )
    session.add(event)
    session.flush()
    return event


def create_notification_from_event(session: Session, event_id: int) -> Notification | None:
    """Generate logical Notification record from an event and template with frozen body_snapshot."""
    event = session.get(NotificationEvent, event_id)
    if not event or event.status == NotificationEventStatus.PROCESSED.value:
        return None

    borrowing = event.borrowing
    borrower = borrowing.borrower

    if not borrower.email:
        event.status = NotificationEventStatus.SKIPPED.value
        session.commit()
        return None

    # Load matching template
    template = session.scalars(
        select(NotificationTemplate).where(
            NotificationTemplate.code == event.event_code,
            NotificationTemplate.is_active.is_(True),
        )
    ).first()

    items_list = "\n".join([f"- {it.asset.name} ({it.asset.inventory_code})" for it in borrowing.items])
    context = {
        "borrower_name": borrower.name,
        "transaction_number": borrowing.transaction_number,
        "due_date": str(borrowing.due_date),
        "start_date": str(borrowing.start_date),
        "items_list": items_list,
        "return_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "condition": "SELESAI",
    }

    if template:
        subject = template.subject
        body = template.body
        for k, v in context.items():
            subject = subject.replace(f"{{{k}}}", str(v))
            body = body.replace(f"{{{k}}}", str(v))
    else:
        subject = f"[SIIPB] Notifikasi {event.event_code} - {borrowing.transaction_number}"
        body = f"Halo {borrower.name},\n\nPemberitahuan peminjaman #{borrowing.transaction_number}."

    notification = Notification(
        event_id=event.id,
        borrower_id=borrower.id,
        template_id=template.id if template else 1,
        channel=NotificationChannel.EMAIL.value,
        recipient=borrower.email,
        subject=subject,
        body_snapshot=body,  # Frozen snapshot
        status=NotificationStatus.QUEUED.value,
    )
    session.add(notification)
    session.flush()

    # Log initial queue
    log = NotificationLog(
        notification_id=notification.id,
        status=NotificationStatus.QUEUED.value,
        message="Notifikasi masuk antrean pengiriman",
    )
    session.add(log)

    event.status = NotificationEventStatus.PROCESSED.value
    event.processed_at = datetime.now()
    session.commit()

    return notification


def record_delivery_attempt(
    session: Session,
    notification_id: int,
    attempt_number: int,
    success: bool,
    error_message: str | None = None,
    provider: str = "smtp",
    message_id: str | None = None,
) -> EmailDelivery:
    """Record per-attempt SMTP delivery attempt history."""
    now = datetime.now()
    delivery = EmailDelivery(
        notification_id=notification_id,
        attempt_number=attempt_number,
        provider=provider,
        message_id=message_id,
        status=EmailDeliveryStatus.SENT.value if success else EmailDeliveryStatus.FAILED.value,
        error_message=error_message,
        attempted_at=now,
        delivered_at=now if success else None,
    )
    session.add(delivery)

    notif = session.get(Notification, notification_id)
    if notif:
        notif.status = NotificationStatus.SENT.value if success else NotificationStatus.FAILED.value
        if success:
            notif.sent_at = now

        log = NotificationLog(
            notification_id=notification_id,
            status=notif.status,
            message=f"Percobaan ke-{attempt_number}: {'Berhasil' if success else f'Gagal ({error_message})'}",
        )
        session.add(log)

    session.commit()
    return delivery
