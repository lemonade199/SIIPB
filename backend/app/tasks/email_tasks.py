"""Celery worker: pengiriman email SMTP dengan retry (exponential backoff)."""
from celery.utils.log import get_task_logger
from sqlalchemy import select

from app.database import SessionLocal
from app.extensions import celery
from app.models import Notification, NotificationStatus
from app.services.notification_service import deliver

logger = get_task_logger(__name__)
MAX_RETRIES = 5


@celery.task(bind=True, max_retries=MAX_RETRIES)
def send_email_notification_task(self, notification_id: int):
    """Kirim satu notifikasi; gagal -> retry 30s, 60s, 120s, ... lalu FAILED."""
    attempt = self.request.retries + 1
    final = self.request.retries >= MAX_RETRIES
    with SessionLocal() as session:
        ok = deliver(session, notification_id, attempt_number=attempt, final=final)
    if not ok and not final:
        raise self.retry(countdown=30 * (2 ** self.request.retries))
    return ok


@celery.task
def process_queued_notifications_task():
    """Ambil notifikasi QUEUED yang belum terkirim (mis. broker sempat mati) lalu kirim ulang."""
    with SessionLocal() as session:
        ids = list(session.scalars(
            select(Notification.id).where(Notification.status == NotificationStatus.QUEUED.value).limit(100)
        ).all())
    for nid in ids:
        send_email_notification_task.delay(nid)
    return f"Dispatched {len(ids)} notifications"
