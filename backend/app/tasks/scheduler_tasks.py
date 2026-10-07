"""Celery Beat: pemeriksaan jatuh tempo harian sesuai jam di Pengaturan (bawaan 08.00 WIB)."""
from datetime import datetime
from zoneinfo import ZoneInfo

from celery.utils.log import get_task_logger

from app.database import SessionLocal
from app.extensions import celery
from app.services.scheduler_service import run_due_check
from app.services.settings_service import get_settings

logger = get_task_logger(__name__)


@celery.task
def check_borrowing_due_dates_task(force: bool = False):
    """Dipicu Beat tiap 15 menit; berjalan sekali sehari setelah jam yang dikonfigurasi."""
    with SessionLocal() as session:
        settings = get_settings(session)
        sched = settings["scheduler"]
        if not force and not sched.get("enabled", True):
            return "Scheduler dinonaktifkan di Pengaturan"
        try:
            now = datetime.now(ZoneInfo(sched.get("timezone") or "Asia/Jakarta"))
        except Exception:  # noqa: BLE001
            now = datetime.now()
        today = now.date()
        if not force:
            if sched.get("last_run_date") == today.isoformat():
                return "Sudah dijalankan hari ini"
            if now.strftime("%H:%M") < (sched.get("time") or "08:00"):
                return f"Menunggu jam {sched.get('time')}"
        run = run_due_check(session, run_date=today, trigger="BEAT")
        logger.info("Pemeriksaan %s: %s transaksi, %s terlambat, %s email", today, run.checked, run.late_marked, run.sent)
        return {"checked": run.checked, "late_marked": run.late_marked, "sent": run.sent, "skipped": run.skipped}
