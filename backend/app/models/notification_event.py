"""notification_events — the idempotency key: UNIQUE(borrowing_id, event_code)."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigIntU, CreatedAtMixin, DateTime6, IdMixin, table_args
from app.models.enums import NotificationEventStatus, check_in

if TYPE_CHECKING:
    from app.models.borrowing import Borrowing
    from app.models.notification import Notification


class NotificationEvent(IdMixin, CreatedAtMixin, Base):
    """Insert with INSERT IGNORE / ON DUPLICATE KEY so the scheduler is re-runnable."""

    __tablename__ = "notification_events"
    __table_args__ = table_args(
        UniqueConstraint(
            "borrowing_id", "event_code", name="uq_notification_events_borrowing_id_event_code"
        ),
        Index("ix_notification_events_status_scheduled_at", "status", "scheduled_at"),
        CheckConstraint(check_in("status", NotificationEventStatus), name="status"),
    )

    borrowing_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("borrowings.id", ondelete="RESTRICT")
    )
    event_code: Mapped[str] = mapped_column(String(50))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime6)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime6)
    status: Mapped[str] = mapped_column(
        String(30),
        default=NotificationEventStatus.PENDING.value,
        server_default=text(f"'{NotificationEventStatus.PENDING.value}'"),
    )

    borrowing: Mapped[Borrowing] = relationship(back_populates="notification_events")
    notifications: Mapped[list[Notification]] = relationship(back_populates="event")
