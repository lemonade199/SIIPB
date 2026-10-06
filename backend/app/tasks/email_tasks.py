"""Asynchronous SMTP email delivery worker tasks with exponential backoff."""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from celery.utils.log import get_task_logger
from sqlalchemy import select

from app.config import Config
from app.database import SessionLocal
from app.extensions import celery
from app.models import Notification, NotificationStatus
from app.services.notification_service import record_delivery_attempt

logger = get_task_logger(__name__)


@celery.task(bind=True, max_retries=5, default_retry_delay=60)
def send_email_notification_task(self, notification_id: int):
    """Deliver an email notification via SMTP with retry and delivery history logging."""
    attempt_number = self.request.retries + 1
    logger.info(f"Executing delivery for Notification #{notification_id} (Attempt {attempt_number})")

    with SessionLocal() as session:
        notif = session.get(Notification, notification_id)
        if not notif:
            logger.error(f"Notification #{notification_id} not found")
            return False

        if notif.status == NotificationStatus.SENT.value:
            logger.info(f"Notification #{notification_id} already marked SENT. Skipping.")
            return True

        if not notif.recipient:
            logger.warning(f"Notification #{notification_id} has empty recipient. Marking FAILED.")
            record_delivery_attempt(
                session=session,
                notification_id=notification_id,
                attempt_number=attempt_number,
                success=False,
                error_message="Recipient email is empty",
            )
            return False

        # Build MIME Message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = notif.subject
        msg["From"] = f"{Config.SMTP_SENDER_NAME} <{Config.SMTP_SENDER_EMAIL}>"
        msg["To"] = notif.recipient
        msg.attach(MIMEText(notif.body_snapshot or "", "plain", "utf-8"))

        try:
            # Check if SMTP credentials configured
            if not Config.SMTP_USERNAME or not Config.SMTP_PASSWORD:
                # Mock delivery in development or test environment
                logger.info(
                    f"[DEV MOCK] SMTP delivery simulated for {notif.recipient}: '{notif.subject}'"
                )
                record_delivery_attempt(
                    session=session,
                    notification_id=notification_id,
                    attempt_number=attempt_number,
                    success=True,
                    provider="mock_smtp",
                    message_id=f"mock-{notification_id}-{attempt_number}",
                )
                return True

            # Send via real SMTP server
            with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=15) as server:
                if Config.SMTP_USE_TLS:
                    server.starttls()
                server.login(Config.SMTP_USERNAME, Config.SMTP_PASSWORD)
                server.send_message(msg)

            record_delivery_attempt(
                session=session,
                notification_id=notification_id,
                attempt_number=attempt_number,
                success=True,
                provider="smtp",
                message_id=f"smtp-{notification_id}",
            )
            logger.info(f"Successfully sent notification #{notification_id} to {notif.recipient}")
            return True

        except Exception as exc:
            logger.warning(f"SMTP delivery error for notification #{notification_id}: {exc}")
            record_delivery_attempt(
                session=session,
                notification_id=notification_id,
                attempt_number=attempt_number,
                success=False,
                error_message=str(exc),
                provider="smtp",
            )

            # Exponential backoff retry: 30s, 60s, 120s, 240s...
            retry_countdown = 30 * (2 ** self.request.retries)
            try:
                raise self.retry(exc=exc, countdown=retry_countdown)
            except self.MaxRetriesExceededError:
                logger.error(f"Max retries exceeded for notification #{notification_id}")
                return False


@celery.task
def process_queued_notifications_task():
    """Periodic worker to pick up QUEUED notifications and dispatch them."""
    with SessionLocal() as session:
        queued_notifications = session.scalars(
            select(Notification).where(Notification.status == NotificationStatus.QUEUED.value).limit(50)
        ).all()

        for notif in queued_notifications:
            send_email_notification_task.delay(notif.id)

    return f"Dispatched {len(queued_notifications)} notifications"
