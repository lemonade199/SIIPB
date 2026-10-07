"""Pemeriksaan jatuh tempo & keterlambatan (dokumen Plan §7.3, §12, §21).

- Transaksi AKTIF yang melewati batas -> TERLAMBAT (transaksi DIKEMBALIKAN tidak disentuh).
- Untuk tiap transaksi dipilih aturan aktif terakhir yang sudah tercapai (H-3, H-1, H, H+1, H+3, H+7)
  dan dibuat notifikasi ke penerima sesuai konfigurasi (peminjam / petugas / pimpinan).
- Idempoten: UNIQUE(borrowing_id, event_code) pada notification_events mencegah kiriman ganda.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Borrowing, BorrowingStatus, Notification, NotificationStatus, SchedulerRun
from app.services.audit_service import record_audit
from app.services.notification_service import create_event_notifications, dispatch
from app.services.settings_service import RULE_EVENTS, get_settings, set_last_run_date


def local_today(settings: dict | None = None) -> date:
    tz = (settings or {}).get("scheduler", {}).get("timezone") or "Asia/Jakarta"
    try:
        return datetime.now(ZoneInfo(tz)).date()
    except Exception:  # noqa: BLE001
        return date.today()


def run_due_check(
    session: Session,
    run_date: date | None = None,
    trigger: str = "MANUAL",
    user_id: int | None = None,
) -> SchedulerRun:
    settings = get_settings(session)
    run_date = run_date or local_today(settings)
    rules = [r for r in settings["rules"] if r.get("active")]

    borrowings = list(session.scalars(
        select(Borrowing).where(Borrowing.status.in_([BorrowingStatus.AKTIF.value, BorrowingStatus.TERLAMBAT.value]))
    ).all())

    late_marked = 0
    skipped = 0
    details: list[dict[str, Any]] = []
    created_ids: list[int] = []

    for b in borrowings:
        delta = (run_date - b.due_date).days  # >0 = terlambat
        if delta > 0 and b.status == BorrowingStatus.AKTIF.value:
            b.status = BorrowingStatus.TERLAMBAT.value
            late_marked += 1
            details.append({"code": b.transaction_number, "action": f"Status -> TERLAMBAT ({delta} hari)"})
        # Aturan dengan hari terbesar yang sudah tercapai. Bila Beat sempat mati, pengingat
        # yang terlewat tetap dikirim sekali (event yang sama tidak pernah dikirim dua kali).
        rule = next((r for r in sorted(rules, key=lambda r: int(r["days"]), reverse=True) if int(r["days"]) <= delta), None)
        if rule is None:
            continue
        event_code = RULE_EVENTS[rule["event"]]
        notifs, outcome = create_event_notifications(
            session, b, event_code, rule.get("to") or ["peminjam"], settings, today=run_date
        )
        if outcome == "CREATED":
            created_ids += [n.id for n in notifs]
            who = ", ".join(sorted({n.recipient_type.lower() for n in notifs}))
            details.append({"code": b.transaction_number, "action": f"{rule['event']}: {len(notifs)} email ({who})"})
        else:
            skipped += 1
            reason = {
                "DUPLICATE": "sudah pernah dikirim",
                "NO_RECIPIENT": "tidak ada email penerima",
                "NO_TEMPLATE": "template tidak aktif",
            }.get(outcome, outcome)
            details.append({"code": b.transaction_number, "action": f"{rule['event']}: dilewati ({reason})"})

    set_last_run_date(session, run_date.isoformat())
    run = SchedulerRun(
        run_date=run_date,
        trigger=trigger,
        triggered_by=user_id,
        checked=len(borrowings),
        late_marked=late_marked,
        sent=0,
        skipped=skipped,
        failed=0,
        details=details,
    )
    session.add(run)
    record_audit(session, "RUN", "scheduler", "scheduler_run", None, user_id,
                 new_data={"run_date": run_date.isoformat(), "trigger": trigger, "checked": len(borrowings)})
    session.commit()

    dispatch(created_ids, session=session)

    if created_ids:
        statuses = session.scalars(select(Notification.status).where(Notification.id.in_(created_ids))).all()
        run.failed = sum(1 for s in statuses if s == NotificationStatus.FAILED.value)
        run.sent = len(statuses) - run.failed
    session.commit()
    return run


def serialize_run(r: SchedulerRun) -> dict[str, Any]:
    return {
        "id": r.id,
        "at": r.created_at.isoformat() if r.created_at else None,
        "today": r.run_date.isoformat(),
        "trigger": r.trigger,
        "triggered_by": r.triggered_by,
        "checked": r.checked,
        "late_marked": r.late_marked,
        "sent": r.sent,
        "skipped": r.skipped,
        "failed": r.failed,
        "details": r.details or [],
    }
