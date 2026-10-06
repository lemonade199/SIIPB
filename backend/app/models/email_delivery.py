"""email_deliveries — one row per SMTP attempt (retries add rows, never events)."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigIntU, DateTime6, IdMixin, IntU, table_args
from app.models.enums import EmailDeliveryStatus, check_in

if TYPE_CHECKING:
    from app.models.notification import Notification


class EmailDelivery(IdMixin, Base):
    __tablename__ = "email_deliveries"
    __table_args__ = table_args(
        UniqueConstraint(
            "notification_id",
            "attempt_number",
            name="uq_email_deliveries_notification_id_attempt_number",
        ),
        CheckConstraint("attempt_number >= 1", name="attempt_number_positive"),
        CheckConstraint(check_in("status", EmailDeliveryStatus), name="status"),
    )

    notification_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("notifications.id", ondelete="RESTRICT")
    )
    attempt_number: Mapped[int] = mapped_column(IntU)
    provider: Mapped[str | None] = mapped_column(String(50))
    message_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), index=True)
    error_message: Mapped[str | None] = mapped_column(Text)
    attempted_at: Mapped[datetime] = mapped_column(DateTime6, index=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime6)

    notification: Mapped[Notification] = relationship(back_populates="deliveries")
