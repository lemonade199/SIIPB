"""system_settings — key/value configuration (SMTP, notification, security)."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import FALSE, Base, BigIntU, IdMixin, TimestampMixin, table_args
from app.models.enums import SettingValueType, check_in

if TYPE_CHECKING:
    from app.models.user import User


class SystemSetting(IdMixin, TimestampMixin, Base):
    """Secrets (is_secret=1) must be stored encrypted by the application."""

    __tablename__ = "system_settings"
    __table_args__ = table_args(
        CheckConstraint(check_in("value_type", SettingValueType), name="value_type"),
    )

    key: Mapped[str] = mapped_column(String(150), unique=True)
    value: Mapped[str | None] = mapped_column(Text)
    value_type: Mapped[str] = mapped_column(
        String(20),
        default=SettingValueType.STRING.value,
        server_default=text(f"'{SettingValueType.STRING.value}'"),
    )
    is_secret: Mapped[bool] = mapped_column(Boolean, default=False, server_default=FALSE)
    description: Mapped[str | None] = mapped_column(Text)
    updated_by: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    updater: Mapped[User | None] = relationship()

    def __repr__(self) -> str:
        return f"<SystemSetting {self.key}>"
