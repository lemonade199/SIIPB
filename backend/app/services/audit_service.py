"""Audit trail logging service."""
from typing import Any
from sqlalchemy.orm import Session
from flask import request, has_request_context

from app.models import AuditLog


def record_audit(
    session: Session,
    action: str,
    module: str,
    entity_type: str,
    entity_id: int | None = None,
    user_id: int | None = None,
    old_data: dict[str, Any] | None = None,
    new_data: dict[str, Any] | None = None,
) -> AuditLog:
    """Record an immutable, append-only audit log entry."""
    ip_address = None
    user_agent = None

    if has_request_context():
        ip_address = request.remote_addr
        if request.headers.get("X-Forwarded-For"):
            ip_address = request.headers.get("X-Forwarded-For").split(",")[0].strip()
        user_agent = request.user_agent.string if request.user_agent else None

    log = AuditLog(
        user_id=user_id,
        action=action,
        module=module,
        entity_type=entity_type,
        entity_id=entity_id,
        old_data=old_data,
        new_data=new_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    session.add(log)
    return log
