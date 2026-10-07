"""Celery Beat: backup database terjadwal (bawaan 01.00 WIB)."""
from app.database import SessionLocal
from app.extensions import celery
from app.services.backup_service import run_backup


@celery.task
def scheduled_backup_task():
    with SessionLocal() as session:
        return run_backup(session, by="system", kind="Terjadwal")
