"""notification_logs — append-only lifecycle log per notification."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigIntU, CreatedAtMixin, IdMixin, table_args
from app.models.enums import NotificationStatus, check_in

if TYPE_CHECKING:
    from app.models.notification import Notification


class NotificationLog(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "notification_logs"
    __table_args__ = table_args(
        Index(
            "ix_notification_logs_notification_id_created_at",
            "notification_id",
            "created_at",
        ),
        CheckConstraint(check_in("status", NotificationStatus), name="status"),
    )

    notification_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("notifications.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(String(30), index=True)
    message: Mapped[str | None] = mapped_column(Text)

    notification: Mapped[Notification] = relationship(back_populates="logs")
