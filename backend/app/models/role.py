"""roles — master roles with JSON-stored permissions."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    TRUE,
    Base,
    IdMixin,
    TimestampMixin,
    table_args,
)

if TYPE_CHECKING:
    from app.models.user import User


class Role(IdMixin, TimestampMixin, Base):
    __tablename__ = "roles"
    __table_args__ = table_args()

    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=TRUE, index=True
    )
    permissions: Mapped[list[str]] = mapped_column(
        JSON, default=list, server_default=text("'[]'")
    )

    users: Mapped[list[User]] = relationship(
        back_populates="role", foreign_keys="User.role_id", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<Role {self.code}>"


# Backward-compatible mock
class RolePermission:
    def __init__(self, role_id: int = 0, permission_id: int = 0):
        self.role_id = role_id
        self.permission_id = permission_id


__all__ = ["Role", "RolePermission"]
