"""Celery Beat scheduled tasks for due-date checks and automated reminders."""
from datetime import date
from celery.utils.log import get_task_logger
from sqlalchemy import select

from app.database import SessionLocal
from app.extensions import celery
from app.models import (
    Borrowing,
    BorrowingStatus,
    NotificationEventCode,
)
from app.services.notification_service import (
    create_idempotent_event,
    create_notification_from_event,
)
from app.tasks.email_tasks import send_email_notification_task

logger = get_task_logger(__name__)


@celery.task
def check_borrowing_due_dates_task():
    """Daily check for due dates and overdue borrowings.
    Evaluates:
      - H-3 reminder (REMINDER_H_3)
      - H-1 reminder (REMINDER_H_1)
      - H-0 due day (REMINDER_H_0)
      - Overdue H+1 (OVERDUE_H_1)
      - Overdue H+3 (OVERDUE_H_3)
      - Overdue H+7 (OVERDUE_H_7)
    Idempotent: will never duplicate events or spam borrowers.
    """
    logger.info("Executing scheduled borrowing due dates check...")
    today = date.today()

    with SessionLocal() as session:
        # Load all active or overdue borrowings
        query = select(Borrowing).where(
            Borrowing.status.in_([BorrowingStatus.AKTIF.value, BorrowingStatus.TERLAMBAT.value])
        )
        borrowings = session.scalars(query).all()

        events_created = 0

        for b in borrowings:
            # Calculate days until due date:
            # delta > 0: upcoming (H-3, H-1)
            # delta == 0: due today (H-0)
            # delta < 0: overdue (H+1, H+3, H+7)
            delta_days = (b.due_date - today).days

            target_code = None

            if delta_days == 3:
                target_code = NotificationEventCode.REMINDER_H_3.value
            elif delta_days == 1:
                target_code = NotificationEventCode.REMINDER_H_1.value
            elif delta_days == 0:
                target_code = NotificationEventCode.REMINDER_H_0.value
            elif delta_days < 0:
                # Mark status as TERLAMBAT
                if b.status != BorrowingStatus.TERLAMBAT.value:
                    b.status = BorrowingStatus.TERLAMBAT.value

                overdue_days = abs(delta_days)
                if overdue_days == 1:
                    target_code = NotificationEventCode.OVERDUE_H_1.value
                elif overdue_days == 3:
                    target_code = NotificationEventCode.OVERDUE_H_3.value
                elif overdue_days == 7:
                    target_code = NotificationEventCode.OVERDUE_H_7.value

            if target_code:
                event = create_idempotent_event(session, b.id, target_code)
                if event and event.status == "PENDING":
                    # Generate notification snapshot and dispatch
                    notif = create_notification_from_event(session, event.id)
                    if notif:
                        events_created += 1
                        send_email_notification_task.delay(notif.id)

        session.commit()
        logger.info(f"Finished due-dates check. Created and dispatched {events_created} notifications.")
        return f"Processed {len(borrowings)} borrowings, created {events_created} events."
