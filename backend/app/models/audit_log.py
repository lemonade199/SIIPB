"""audit_logs — append-only audit trail (who did what, before/after)."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigIntU, CreatedAtMixin, IdMixin, table_args

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(IdMixin, CreatedAtMixin, Base):
    """entity_id is polymorphic (no FK) so logs survive any entity lifecycle."""

    __tablename__ = "audit_logs"
    __table_args__ = table_args(
        Index("ix_audit_logs_entity_type_entity_id", "entity_type", "entity_id"),
        Index("ix_audit_logs_created_at", "created_at"),
    )

    user_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(50), index=True)
    module: Mapped[str] = mapped_column(String(50), index=True)
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[int | None] = mapped_column(BigIntU)
    old_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    new_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User | None] = relationship()
