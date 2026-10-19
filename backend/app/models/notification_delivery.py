"""notification_deliveries — consolidated delivery attempts per notification."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigIntU, DateTime6, IdMixin, IntU, table_args
from app.models.enums import EmailDeliveryStatus, check_in

if TYPE_CHECKING:
    from app.models.notification import Notification


class NotificationDelivery(IdMixin, Base):
    """One row per delivery attempt (SMTP, Web, etc.)."""

    __tablename__ = "notification_deliveries"
    __table_args__ = table_args(
        UniqueConstraint(
            "notification_id",
            "attempt_number",
            name="uq_notification_deliveries_notification_id_attempt_number",
        ),
        CheckConstraint("attempt_number >= 1", name="ck_notification_deliveries_attempt_number_positive"),
        CheckConstraint(check_in("status", EmailDeliveryStatus), name="ck_notification_deliveries_status"),
    )

    notification_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("notifications.id", ondelete="CASCADE"), index=True
    )
    attempt_number: Mapped[int] = mapped_column(IntU)
    channel: Mapped[str] = mapped_column(String(20), default="EMAIL")
    provider: Mapped[str | None] = mapped_column(String(50))
    message_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), index=True)
    error_message: Mapped[str | None] = mapped_column(Text)
    attempted_at: Mapped[datetime] = mapped_column(DateTime6, index=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime6)

    notification: Mapped[Notification] = relationship(back_populates="deliveries")


# Backward compatibility alias
EmailDelivery = NotificationDelivery
