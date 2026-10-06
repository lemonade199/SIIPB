"""roles and role_permissions (roles <-> permissions)."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    CURRENT_TS6,
    TRUE,
    Base,
    BigIntU,
    DateTime6,
    IdMixin,
    TimestampMixin,
    table_args,
)

if TYPE_CHECKING:
    from app.models.permission import Permission
    from app.models.user import UserRole


class Role(IdMixin, TimestampMixin, Base):
    __tablename__ = "roles"
    __table_args__ = table_args()

    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=TRUE, index=True
    )

    user_links: Mapped[list[UserRole]] = relationship(back_populates="role")
    permission_links: Mapped[list[RolePermission]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )
    permissions: Mapped[list[Permission]] = relationship(
        secondary="role_permissions", viewonly=True
    )

    def __repr__(self) -> str:
        return f"<Role {self.code}>"


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = table_args()

    role_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[int] = mapped_column(
        BigIntU,
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime6, server_default=CURRENT_TS6)

    role: Mapped[Role] = relationship(back_populates="permission_links")
    permission: Mapped[Permission] = relationship(back_populates="role_links")
