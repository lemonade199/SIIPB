"""Notifikasi: riwayat & log pengiriman, tandai terbaca, kirim ulang, template email."""
from datetime import datetime

from flask import Blueprint, g, request
from marshmallow import Schema, ValidationError, fields, validate
from sqlalchemy import func, select

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required, permission_required
from app.models import (
    Notification,
    NotificationEvent,
    NotificationLog,
    NotificationRead,
    NotificationStatus,
    NotificationTemplate,
)
from app.services.audit_service import record_audit
from app.services.notification_service import EVENT_TO_UI, UI_TO_EVENT, dispatch
from app.utils.response import error_response, success_response

notification_bp = Blueprint("notifications", __name__, url_prefix="/api/v1/notifications")


def serialize_notification(n: Notification) -> dict:
    ev = n.event
    return {
        "id": n.id,
        "event_id": n.event_id,
        "event_code": ev.event_code if ev else None,
        "event": EVENT_TO_UI.get(ev.event_code, ev.event_code) if ev else None,
        "borrowing_id": ev.borrowing_id if ev else None,
        "transaction_number": ev.borrowing.transaction_number if ev and ev.borrowing else None,
        "trigger": "scheduler" if ev and ev.event_code not in ("LOAN_CONFIRMATION", "RETURN_CONFIRMATION") else "transaksi",
        "borrower_id": n.borrower_id,
        "template_code": n.template.code if n.template else None,
        "channel": n.channel,
        "recipient": n.recipient,
        "recipient_name": n.recipient_name,
        "recipient_type": n.recipient_type,
        "recipient_user_id": n.recipient_user_id,
        "subject": n.subject,
        "body": n.body_snapshot,
        "status": n.status,
        "sent_at": n.sent_at.isoformat() if n.sent_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "read_by": [r.user_id for r in n.reads],
        "deliveries": [
            {
                "attempt": d.attempt_number,
                "status": d.status,
                "provider": d.provider,
                "error": d.error_message,
                "attempted_at": d.attempted_at.isoformat() if d.attempted_at else None,
            }
            for d in n.deliveries
        ],
        "logs": [
            {"status": lg.status, "message": lg.message, "created_at": lg.created_at.isoformat() if lg.created_at else None}
            for lg in n.logs
        ],
    }


def _inbox_filter(query, user):
    """Notifikasi untuk pengguna: ditujukan kepadanya; admin juga melihat eskalasi & kegagalan."""
    mine = Notification.recipient_user_id == user["id"]
    if "ADMIN" in user["roles"]:
        mine = mine | Notification.status.in_([NotificationStatus.FAILED.value]) | NotificationEvent.event_code.in_(["H_PLUS_3", "H_PLUS_7"])
    return query.where(mine)


@notification_bp.get("")
@permission_required("notification.view")
def list_notifications():
    """Riwayat notifikasi & log pengiriman.
    ---
    tags: [Notifications]
    security: [{Bearer: []}]
    parameters:
      - {in: query, name: status, type: string, enum: [QUEUED, PROCESSING, SENT, FAILED, RETRYING]}
      - {in: query, name: event, type: string, description: "CHECKOUT, H-3, H-1, H, H+1, H+3, H+7, PENGEMBALIAN"}
      - {in: query, name: borrowing_id, type: integer}
      - {in: query, name: inbox, type: boolean, description: hanya notifikasi untuk pengguna ini}
      - {in: query, name: page, type: integer, default: 1}
      - {in: query, name: per_page, type: integer, default: 20}
    responses:
      200: {description: Riwayat notifikasi}
    """
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))
    with SessionLocal() as session:
        query = select(Notification).join(NotificationEvent, NotificationEvent.id == Notification.event_id)
        if request.args.get("status"):
            query = query.where(Notification.status == request.args["status"].upper())
        if request.args.get("event"):
            ev = request.args["event"]
            query = query.where(NotificationEvent.event_code == UI_TO_EVENT.get(ev, ev))
        if request.args.get("borrowing_id", type=int):
            query = query.where(NotificationEvent.borrowing_id == request.args.get("borrowing_id", type=int))
        if request.args.get("inbox") in ("1", "true"):
            query = _inbox_filter(query, g.current_user)
        total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = session.scalars(query.order_by(Notification.id.desc()).offset((page - 1) * per_page).limit(per_page)).all()
        return success_response(
            data=[serialize_notification(n) for n in items],
            meta={"page": page, "per_page": per_page, "total": total},
            message="Riwayat notifikasi berhasil diambil",
        )


@notification_bp.get("/unread-count")
@jwt_required
def unread_count():
    """Jumlah notifikasi belum dibaca untuk pengguna ini (ikon lonceng).
    ---
    tags: [Notifications]
    security: [{Bearer: []}]
    responses:
      200: {description: Jumlah belum dibaca}
    """
    with SessionLocal() as session:
        read_ids = select(NotificationRead.notification_id).where(NotificationRead.user_id == g.current_user["id"])
        q = select(func.count(Notification.id)).join(NotificationEvent, NotificationEvent.id == Notification.event_id)
        q = _inbox_filter(q, g.current_user).where(Notification.id.not_in(read_ids))
        return success_response(data={"unread": session.scalar(q) or 0})


@notification_bp.post("/<int:notification_id>/read")
@jwt_required
def mark_read(notification_id: int):
    """Tandai notifikasi terbaca oleh pengguna ini.
    ---
    tags: [Notifications]
    security: [{Bearer: []}]
    responses:
      200: {description: Ditandai terbaca}
      404: {description: Tidak ditemukan}
    """
    with SessionLocal() as session:
        n = session.get(Notification, notification_id)
        if not n:
            return error_response("Notifikasi tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        if not session.get(NotificationRead, (notification_id, g.current_user["id"])):
            session.add(NotificationRead(notification_id=notification_id, user_id=g.current_user["id"], read_at=datetime.now()))
            session.commit()
        return success_response(data={"id": notification_id, "read": True}, message="Notifikasi ditandai terbaca")


@notification_bp.post("/read-all")
@jwt_required
def mark_all_read():
    """Tandai semua notifikasi di kotak masuk pengguna sebagai terbaca.
    ---
    tags: [Notifications]
    security: [{Bearer: []}]
    responses:
      200: {description: Semua ditandai terbaca}
    """
    with SessionLocal() as session:
        read_ids = select(NotificationRead.notification_id).where(NotificationRead.user_id == g.current_user["id"])
        q = select(Notification.id).join(NotificationEvent, NotificationEvent.id == Notification.event_id)
        ids = session.scalars(_inbox_filter(q, g.current_user).where(Notification.id.not_in(read_ids))).all()
        now = datetime.now()
        for nid in ids:
            session.add(NotificationRead(notification_id=nid, user_id=g.current_user["id"], read_at=now))
        session.commit()
        return success_response(data={"marked": len(ids)}, message="Semua notifikasi ditandai terbaca")


@notification_bp.post("/<int:notification_id>/resend")
@permission_required("notification.manage")
def resend_notification(notification_id: int):
    """Kirim ulang notifikasi (mis. setelah SMTP gagal).
    ---
    tags: [Notifications]
    security: [{Bearer: []}]
    responses:
      200: {description: Notifikasi dikirim ulang}
      404: {description: Tidak ditemukan}
    """
    with SessionLocal() as session:
        notif = session.get(Notification, notification_id)
        if not notif:
            return error_response("Notifikasi tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        if notif.status == NotificationStatus.SENT.value:
            return error_response("Notifikasi sudah terkirim", error_code="ALREADY_SENT")
        notif.status = NotificationStatus.QUEUED.value
        session.add(NotificationLog(notification_id=notif.id, status=NotificationStatus.QUEUED.value,
                                    message="Dikirim ulang oleh petugas"))
        record_audit(session, "RESEND", "notification", "notification", notif.id, g.current_user["id"])
        session.commit()
        dispatch([notif.id], session=session)
        session.refresh(notif)
        return success_response(data=serialize_notification(notif), message="Notifikasi dikirim ulang")


# ---------------------------------------------------------------- templates
class TemplateSchema(Schema):
    name = fields.String(validate=validate.Length(min=2, max=100))
    subject = fields.String(validate=validate.Length(min=3, max=255))
    body = fields.String(validate=validate.Length(min=3, max=20000))
    is_active = fields.Boolean()


def serialize_template(t: NotificationTemplate) -> dict:
    return {
        "id": t.id,
        "code": t.code,
        "event": EVENT_TO_UI.get(t.code),
        "name": t.name,
        "subject": t.subject,
        "body": t.body,
        "is_active": t.is_active,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@notification_bp.get("/templates")
@permission_required("notification.view")
def list_templates():
    """Template email notifikasi (placeholder `{{nama_peminjam}}`, `{{kode_transaksi}}`, ...).
    ---
    tags: [Notifications]
    security: [{Bearer: []}]
    responses:
      200: {description: Daftar template}
    """
    with SessionLocal() as session:
        templates = session.scalars(select(NotificationTemplate).order_by(NotificationTemplate.id.asc())).all()
        return success_response(data=[serialize_template(t) for t in templates],
                                message="Daftar template notifikasi berhasil diambil")


@notification_bp.put("/templates/<int:template_id>")
@permission_required("settings.manage")
def update_template(template_id: int):
    """Ubah template email.
    ---
    tags: [Notifications]
    security: [{Bearer: []}]
    responses:
      200: {description: Template disimpan}
    """
    try:
        data = TemplateSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi template gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        t = session.get(NotificationTemplate, template_id)
        if not t:
            return error_response("Template tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        old = serialize_template(t)
        for k, v in data.items():
            setattr(t, k, v)
        record_audit(session, "UPDATE", "notification", "notification_template", t.id, g.current_user["id"],
                     old_data={k: old[k] for k in data}, new_data=data)
        session.commit()
        session.refresh(t)
        return success_response(data=serialize_template(t), message="Template disimpan")
