"""Audit log trail endpoints."""
from flask import Blueprint, request
from sqlalchemy import select

from app.database import SessionLocal
from app.middleware.auth_middleware import permission_required
from app.models import AuditLog
from app.utils.response import success_response

audit_bp = Blueprint("audit_logs", __name__, url_prefix="/api/v1/audit-logs")


@audit_bp.get("")
@permission_required("audit.read")
def list_audit_logs():
    """List system audit log trail.
    ---
    tags:
      - Audit Logs
    security:
      - Bearer: []
    parameters:
      - in: query
        name: module
        type: string
      - in: query
        name: action
        type: string
      - in: query
        name: user_id
        type: integer
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
        description: Riwayat audit trail berhasil diambil
    """
    module = request.args.get("module")
    action = request.args.get("action")
    user_id = request.args.get("user_id", type=int)
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    with SessionLocal() as session:
        query = select(AuditLog)
        if module:
            query = query.where(AuditLog.module == module)
        if action:
            query = query.where(AuditLog.action == action)
        if user_id:
            query = query.where(AuditLog.user_id == user_id)

        total = len(session.scalars(query).all())
        items = list(
            session.scalars(
                query.order_by(AuditLog.id.desc())
                .offset((page - 1) * per_page)
                .limit(per_page)
            ).all()
        )

        return success_response(
            data=[
                {
                    "id": a.id,
                    "user_id": a.user_id,
                    "user_name": a.user.full_name if a.user else None,
                    "action": a.action,
                    "module": a.module,
                    "entity_type": a.entity_type,
                    "entity_id": a.entity_id,
                    "old_data": a.old_data,
                    "new_data": a.new_data,
                    "ip_address": a.ip_address,
                    "user_agent": a.user_agent,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in items
            ],
            meta={"page": page, "per_page": per_page, "total": total},
            message="Riwayat audit trail berhasil diambil",
        )
