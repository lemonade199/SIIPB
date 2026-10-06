"""notification_templates — email templates (subject/body)."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TRUE, Base, IdMixin, TimestampMixin, table_args

if TYPE_CHECKING:
    from app.models.notification import Notification


class NotificationTemplate(IdMixin, TimestampMixin, Base):
    __tablename__ = "notification_templates"
    __table_args__ = table_args()

    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    subject: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=TRUE, index=True
    )

    notifications: Mapped[list[Notification]] = relationship(back_populates="template")

    def __repr__(self) -> str:
        return f"<NotificationTemplate {self.code}>"
