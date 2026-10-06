"""Notification management routes and templates."""
from flask import Blueprint, request
from sqlalchemy import select

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required, permission_required
from app.models import Notification, NotificationStatus, NotificationTemplate
from app.utils.response import error_response, success_response

notification_bp = Blueprint("notifications", __name__, url_prefix="/api/v1/notifications")


@notification_bp.get("")
@jwt_required
def list_notifications():
    """List notification history and status.
    ---
    tags:
      - Notifications
    security:
      - Bearer: []
    parameters:
      - in: query
        name: status
        type: string
        enum: [QUEUED, SENT, FAILED]
      - in: query
        name: page
        type: integer
        default: 1
      - in: query
        name: per_page
        type: integer
        default: 20
    responses:
      200:
        description: Riwayat notifikasi berhasil diambil
    """
    status = request.args.get("status")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    with SessionLocal() as session:
        query = select(Notification)
        if status:
            query = query.where(Notification.status == status.upper())

        total = len(session.scalars(query).all())
        items = list(
            session.scalars(
                query.order_by(Notification.id.desc())
                .offset((page - 1) * per_page)
                .limit(per_page)
            ).all()
        )

        return success_response(
            data=[
                {
                    "id": n.id,
                    "event_id": n.event_id,
                    "borrower_id": n.borrower_id,
                    "channel": n.channel,
                    "recipient": n.recipient,
                    "subject": n.subject,
                    "status": n.status,
                    "sent_at": n.sent_at.isoformat() if n.sent_at else None,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                    "deliveries": [
                        {
                            "attempt": d.attempt_number,
                            "status": d.status,
                            "error": d.error_message,
                            "attempted_at": d.attempted_at.isoformat() if d.attempted_at else None,
                        }
                        for d in n.email_deliveries
                    ],
                }
                for n in items
            ],
            meta={"page": page, "per_page": per_page, "total": total},
            message="Riwayat notifikasi berhasil diambil",
        )


@notification_bp.get("/templates")
@jwt_required
def list_templates():
    """List notification templates.
    ---
    tags:
      - Notifications
    security:
      - Bearer: []
    responses:
      200:
        description: Daftar template notifikasi
    """
    with SessionLocal() as session:
        templates = session.scalars(select(NotificationTemplate).order_by(NotificationTemplate.id.asc())).all()
        return success_response(
            data=[
                {
                    "id": t.id,
                    "code": t.code,
                    "name": t.name,
                    "channel": t.channel,
                    "subject": t.subject,
                    "body": t.body,
                    "is_active": t.is_active,
                }
                for t in templates
            ],
            message="Daftar template notifikasi berhasil diambil",
        )


@notification_bp.post("/<int:notification_id>/resend")
@permission_required("settings.manage")
def resend_notification(notification_id: int):
    """Re-queue notification for delivery.
    ---
    tags:
      - Notifications
    security:
      - Bearer: []
    responses:
      200:
        description: Notifikasi dimasukkan kembali ke antrean
      404:
        description: Notifikasi tidak ditemukan
    """
    with SessionLocal() as session:
        notif = session.get(Notification, notification_id)
        if not notif:
            return error_response("Notifikasi tidak ditemukan", status_code=404)

        notif.status = NotificationStatus.QUEUED.value
        session.commit()

        # Trigger background Celery task
        try:
            from app.tasks.email_tasks import send_email_notification_task
            send_email_notification_task.delay(notif.id)
        except Exception:
            pass  # If celery is running without worker or redis is offline in dev, don't crash HTTP response

        return success_response(message="Notifikasi berhasil dimasukkan kembali ke antrean pengiriman")
