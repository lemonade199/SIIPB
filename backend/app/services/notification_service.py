"""Notifikasi email: event idempoten, render template, penerima (eskalasi), pengiriman SMTP.

Alur (dokumen Plan §12, §21):
transaksi/scheduler -> ``notification_events`` (UNIQUE borrowing_id+event_code, mencegah kiriman ganda)
-> ``notifications`` (satu baris per penerima, isi email dibekukan) -> Celery/SMTP
-> ``email_deliveries`` + ``notification_logs``.
"""
from __future__ import annotations

import logging
import re
import smtplib
import ssl
from datetime import date, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, make_msgid
from typing import Any, Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Config
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
    RecipientType,
    Role,
    User,
    UserRole,
)

logger = logging.getLogger(__name__)

# Kode event backend <-> kode event antarmuka.
EVENT_TO_UI = {
    NotificationEventCode.LOAN_CONFIRMATION.value: "CHECKOUT",
    NotificationEventCode.H_MINUS_3.value: "H-3",
    NotificationEventCode.H_MINUS_1.value: "H-1",
    NotificationEventCode.H_DAY.value: "H",
    NotificationEventCode.H_PLUS_1.value: "H+1",
    NotificationEventCode.H_PLUS_3.value: "H+3",
    NotificationEventCode.H_PLUS_7.value: "H+7",
    NotificationEventCode.RETURN_CONFIRMATION.value: "PENGEMBALIAN",
}
UI_TO_EVENT = {v: k for k, v in EVENT_TO_UI.items()}

_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September",
          "Oktober", "November", "Desember"]


def fmt_tanggal(d: date | datetime | None, with_day: bool = True) -> str:
    if d is None:
        return "-"
    if isinstance(d, datetime):
        d = d.date()
    s = f"{d.day} {_BULAN[d.month - 1]} {d.year}"
    return f"{_HARI[d.weekday()]}, {s}" if with_day else s


def render(text: str, ctx: dict[str, Any]) -> str:
    """Ganti ``{{kunci}}`` (dan format lama ``{kunci}``) dengan nilai konteks."""
    def rep(m: re.Match) -> str:
        key = m.group(1) or m.group(2)
        return str(ctx[key]) if key in ctx else m.group(0)
    return re.sub(r"\{\{\s*(\w+)\s*\}\}|\{(\w+)\}", rep, text or "")


def _users_with_role(session: Session, role_code: str) -> list[User]:
    q = (
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(Role.code == role_code, Role.is_active.is_(True), User.is_active.is_(True), User.deleted_at.is_(None))
    )
    return list(session.scalars(q).unique().all())


def resolve_recipients(session: Session, borrowing: Borrowing, kinds: Iterable[str], settings: dict) -> list[dict]:
    """Daftar penerima unik untuk event. kinds: peminjam | petugas | pimpinan."""
    out: list[dict] = []
    seen: set[str] = set()

    def add(kind: RecipientType, name: str | None, email: str | None, user_id: int | None = None):
        if not email or email.lower() in seen:
            return
        seen.add(email.lower())
        out.append({"type": kind.value, "name": name or email, "email": email, "user_id": user_id})

    kinds = set(kinds)
    if "peminjam" in kinds:
        b = borrowing.borrower
        add(RecipientType.PEMINJAM, b.name, b.email)
    if "petugas" in kinds:
        officers = [u for u in (borrowing.checkout_user, borrowing.handler) if u is not None and u.is_active]
        officers += _users_with_role(session, "SARPRAS")
        for u in officers:
            add(RecipientType.PETUGAS, u.full_name, u.email, u.id)
        if not officers and settings.get("staff_email"):
            add(RecipientType.PETUGAS, settings.get("unit_sarpras") or "Petugas Sarpras/IT", settings["staff_email"])
    if "pimpinan" in kinds:
        for u in _users_with_role(session, "PIMPINAN"):
            add(RecipientType.PIMPINAN, u.full_name, u.email, u.id)
    return out


def build_context(borrowing: Borrowing, settings: dict, today: date, return_: Any | None = None) -> dict[str, Any]:
    items = [it.asset for it in borrowing.items if it.asset]
    officer = borrowing.checkout_user or borrowing.handler
    ctx: dict[str, Any] = {
        "nama_peminjam": borrowing.borrower.name,
        "kode_transaksi": borrowing.transaction_number,
        "tanggal_pinjam": fmt_tanggal(borrowing.start_date),
        "batas_kembali": fmt_tanggal(borrowing.due_date),
        "tujuan": borrowing.purpose or "-",
        "daftar_barang": "\n".join(f"- {a.name} ({a.inventory_code})" for a in items) or "-",
        "hari_terlambat": max(0, (today - borrowing.due_date).days),
        "nama_petugas": officer.full_name if officer else settings.get("unit_sarpras", "Petugas"),
        "kontak_petugas": " / ".join(x for x in (settings.get("staff_email"), settings.get("staff_phone")) if x) or "-",
        "lokasi_pengembalian": settings.get("return_location") or "-",
        "nama_instansi": settings.get("institution") or "",
        # kompatibilitas template lama
        "borrower_name": borrowing.borrower.name,
        "transaction_number": borrowing.transaction_number,
        "due_date": str(borrowing.due_date),
        "start_date": str(borrowing.start_date),
        "items_list": "\n".join(f"- {a.name} ({a.inventory_code})" for a in items),
    }
    if return_ is not None:
        lines = []
        for ri in return_.items:
            label = {"BAIK": "baik", "RUSAK": "rusak", "HILANG": "hilang"}.get(ri.final_condition, ri.final_condition)
            if ri.asset_status_after and ri.asset_status_after not in ("TERSEDIA", "RUSAK", "HILANG"):
                label = ri.asset_status_after.replace("_", " ").lower()
            lines.append(f"- {ri.asset.name} ({ri.asset.inventory_code}) — kondisi {label}")
        ctx["tanggal_kembali"] = fmt_tanggal(return_.returned_at)
        ctx["daftar_barang_kembali"] = "\n".join(lines) or ctx["daftar_barang"]
        ctx["return_time"] = return_.returned_at.strftime("%Y-%m-%d %H:%M")
        ctx["condition"] = ", ".join(sorted({ri.final_condition for ri in return_.items}))
    return ctx


def create_event_notifications(
    session: Session,
    borrowing: Borrowing,
    event_code: str,
    recipient_kinds: Iterable[str],
    settings: dict,
    today: date | None = None,
    return_: Any | None = None,
) -> tuple[list[Notification], str]:
    """Buat event (idempoten) + notifikasi per penerima.

    Returns (notifications, outcome) — outcome: CREATED | DUPLICATE | NO_RECIPIENT | NO_TEMPLATE.
    Tidak melakukan commit; pemanggil yang commit.
    """
    today = today or date.today()
    existing = session.scalars(
        select(NotificationEvent).where(
            NotificationEvent.borrowing_id == borrowing.id,
            NotificationEvent.event_code == event_code,
        )
    ).first()
    if existing and existing.status in (NotificationEventStatus.PROCESSED.value, NotificationEventStatus.SKIPPED.value):
        return [], "DUPLICATE"
    event = existing or NotificationEvent(
        borrowing_id=borrowing.id,
        event_code=event_code,
        scheduled_at=datetime.now(),
        status=NotificationEventStatus.PENDING.value,
    )
    if existing is None:
        session.add(event)
        session.flush()

    template = session.scalars(
        select(NotificationTemplate).where(
            NotificationTemplate.code == event_code, NotificationTemplate.is_active.is_(True)
        )
    ).first()
    recipients = resolve_recipients(session, borrowing, recipient_kinds, settings)
    if template is None or not recipients:
        event.status = NotificationEventStatus.SKIPPED.value
        event.processed_at = datetime.now()
        return [], "NO_TEMPLATE" if template is None else "NO_RECIPIENT"

    ctx = build_context(borrowing, settings, today, return_)
    subject = render(template.subject, ctx)
    body = render(template.body, ctx)
    created: list[Notification] = []
    for r in recipients:
        n = Notification(
            event_id=event.id,
            borrower_id=borrowing.borrower_id,
            template_id=template.id,
            channel=NotificationChannel.EMAIL.value,
            recipient=r["email"],
            recipient_name=r["name"],
            recipient_type=r["type"],
            recipient_user_id=r["user_id"],
            subject=subject,
            body_snapshot=body,
            status=NotificationStatus.QUEUED.value,
        )
        session.add(n)
        session.flush()
        session.add(NotificationLog(notification_id=n.id, status=NotificationStatus.QUEUED.value,
                                    message=f"Masuk antrean ({r['type'].lower()})"))
        created.append(n)
    event.status = NotificationEventStatus.PROCESSED.value
    event.processed_at = datetime.now()
    return created, "CREATED"


# ---------------------------------------------------------------------------
# Pengiriman
# ---------------------------------------------------------------------------
def record_delivery_attempt(
    session: Session,
    notification_id: int,
    attempt_number: int,
    success: bool,
    error_message: str | None = None,
    provider: str = "smtp",
    message_id: str | None = None,
    final: bool = True,
) -> EmailDelivery:
    """Catat satu percobaan SMTP ke email_deliveries & notification_logs."""
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
        if success:
            notif.status = NotificationStatus.SENT.value
            notif.sent_at = now
        else:
            notif.status = NotificationStatus.FAILED.value if final else NotificationStatus.RETRYING.value
        session.add(NotificationLog(
            notification_id=notification_id,
            status=notif.status,
            message=f"Percobaan ke-{attempt_number}: " + ("250 OK" if success else f"Gagal ({error_message})"),
        ))
    session.commit()
    return delivery


def deliver(session: Session, notification_id: int, attempt_number: int = 1, final: bool = True) -> bool:
    """Kirim satu notifikasi lewat SMTP. Tanpa kredensial SMTP -> simulasi (mode pengembangan)."""
    from app.services.settings_service import get_settings, smtp_config

    notif = session.get(Notification, notification_id)
    if notif is None:
        return False
    if notif.status == NotificationStatus.SENT.value:
        return True
    # nomor percobaan berlanjut (kirim ulang manual / retry Celery)
    attempt_number = max(attempt_number, len(notif.deliveries) + 1)
    if not notif.recipient:
        record_delivery_attempt(session, notification_id, attempt_number, False, "Alamat penerima kosong")
        return False

    cfg = smtp_config(session)
    if cfg["simulate_failure"]:
        record_delivery_attempt(session, notification_id, attempt_number, False,
                                "Simulasi kegagalan SMTP (Pengaturan)", provider="simulation", final=final)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = notif.subject or "[SIIPB]"
    msg["From"] = formataddr((cfg["from_name"], cfg["from_email"]))
    msg["To"] = notif.recipient
    reply_to = get_settings(session).get("staff_email")
    if reply_to:
        msg["Reply-To"] = reply_to
    msg_id = make_msgid(domain=(cfg["from_email"].split("@")[-1] or "siipb.local"))
    msg["Message-ID"] = msg_id
    msg.attach(MIMEText(notif.body_snapshot or "", "plain", "utf-8"))

    if not cfg["username"] or not cfg["password"]:
        logger.info("[SMTP simulasi] %s -> %s", notif.subject, notif.recipient)
        record_delivery_attempt(session, notification_id, attempt_number, True, provider="mock_smtp", message_id=msg_id)
        return True

    try:
        if cfg["encryption"] == "SSL/TLS" or cfg["encryption"] == "SSL":
            server: smtplib.SMTP = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=20, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=20)
        with server:
            if cfg["encryption"] == "STARTTLS":
                server.starttls(context=ssl.create_default_context())
            server.login(cfg["username"], cfg["password"])
            server.send_message(msg)
        record_delivery_attempt(session, notification_id, attempt_number, True, provider="smtp", message_id=msg_id)
        return True
    except Exception as exc:  # noqa: BLE001 — dicatat sebagai kegagalan pengiriman
        logger.warning("SMTP gagal untuk notifikasi #%s: %s", notification_id, exc)
        record_delivery_attempt(session, notification_id, attempt_number, False, str(exc)[:500], final=final)
        return False


def dispatch(notification_ids: Iterable[int], session: Session | None = None) -> None:
    """Serahkan pengiriman ke Celery; bila broker tidak tersedia / mode sync, kirim langsung."""
    ids = list(notification_ids)
    if not ids:
        return
    if Config.NOTIFICATION_DISPATCH == "celery":
        try:
            from app.tasks.email_tasks import send_email_notification_task
            for nid in ids:
                send_email_notification_task.delay(nid)
            return
        except Exception as exc:  # noqa: BLE001
            logger.warning("Broker Celery tidak tersedia (%s); kirim langsung.", exc)
    from app.database import SessionLocal
    if session is not None:
        for nid in ids:
            deliver(session, nid)
        return
    with SessionLocal() as s:
        for nid in ids:
            deliver(s, nid)
