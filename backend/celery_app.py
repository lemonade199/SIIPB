"""Celery application and beat schedule entrypoint."""
import sys
from pathlib import Path
from celery.schedules import crontab

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.extensions import celery
import app.tasks  # registers all celery tasks

# Celery Beat schedule definition
celery.conf.beat_schedule = {
    # Pemeriksaan jatuh tempo: dicek tiap 15 menit, dijalankan sekali sehari setelah jam di Pengaturan
    # (bawaan 08.00 WIB) sehingga jam & zona waktu dapat diubah tanpa restart.
    "daily-borrowing-due-dates-check": {
        "task": "app.tasks.scheduler_tasks.check_borrowing_due_dates_task",
        "schedule": crontab(minute="*/15"),
    },
    # Backup database harian 01.00 (zona waktu CELERY_TIMEZONE)
    "daily-database-backup": {
        "task": "app.tasks.backup_tasks.scheduled_backup_task",
        "schedule": crontab(hour=1, minute=0),
    },
    # Process queued notifications every 5 minutes
    "process-queued-notifications": {
        "task": "app.tasks.email_tasks.process_queued_notifications_task",
        "schedule": crontab(minute="*/5"),
    },
}

if __name__ == "__main__":
    celery.start()
