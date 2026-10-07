"""notifications — logical notification with frozen subject/body snapshot."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import CURRENT_TS6, Base, BigIntU, CreatedAtMixin, DateTime6, IdMixin, table_args
from app.models.enums import NotificationChannel, NotificationStatus, RecipientType, check_in

if TYPE_CHECKING:
    from app.models.borrower import Borrower
    from app.models.email_delivery import EmailDelivery
    from app.models.notification_event import NotificationEvent
    from app.models.notification_log import NotificationLog
    from app.models.notification_template import NotificationTemplate


class Notification(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = table_args(
        CheckConstraint(check_in("channel", NotificationChannel), name="channel"),
        CheckConstraint(check_in("status", NotificationStatus), name="status"),
        CheckConstraint(check_in("recipient_type", RecipientType), name="recipient_type"),
    )

    event_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("notification_events.id", ondelete="RESTRICT"), index=True
    )
    borrower_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("borrowers.id", ondelete="RESTRICT"), index=True
    )
    template_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("notification_templates.id", ondelete="RESTRICT"), index=True
    )
    channel: Mapped[str] = mapped_column(
        String(20),
        default=NotificationChannel.EMAIL.value,
        server_default=text(f"'{NotificationChannel.EMAIL.value}'"),
    )
    recipient: Mapped[str] = mapped_column(String(255))
    recipient_name: Mapped[str | None] = mapped_column(String(150))
    recipient_type: Mapped[str] = mapped_column(
        String(20),
        default=RecipientType.PEMINJAM.value,
        server_default=text(f"'{RecipientType.PEMINJAM.value}'"),
    )
    recipient_user_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    subject: Mapped[str | None] = mapped_column(String(255))
    body_snapshot: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(30),
        default=NotificationStatus.QUEUED.value,
        server_default=text(f"'{NotificationStatus.QUEUED.value}'"),
        index=True,
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime6)

    event: Mapped[NotificationEvent] = relationship(back_populates="notifications")
    borrower: Mapped[Borrower] = relationship(back_populates="notifications")
    template: Mapped[NotificationTemplate] = relationship(back_populates="notifications")
    logs: Mapped[list[NotificationLog]] = relationship(
        back_populates="notification", order_by="NotificationLog.created_at"
    )
    deliveries: Mapped[list[EmailDelivery]] = relationship(
        back_populates="notification", order_by="EmailDelivery.attempt_number"
    )
    reads: Mapped[list[NotificationRead]] = relationship(
        back_populates="notification", cascade="all, delete-orphan"
    )


class NotificationRead(Base):
    """Penanda notifikasi sudah dibaca per pengguna internal (POST /notifications/{id}/read)."""

    __tablename__ = "notification_reads"
    __table_args__ = table_args()

    notification_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("notifications.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    read_at: Mapped[datetime] = mapped_column(DateTime6, server_default=CURRENT_TS6)

    notification: Mapped[Notification] = relationship(back_populates="reads")
