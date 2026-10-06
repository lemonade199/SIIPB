"""permissions — e.g. asset.view, borrowing.create, settings.manage."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, CreatedAtMixin, IdMixin, table_args

if TYPE_CHECKING:
    from app.models.role import RolePermission


class Permission(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "permissions"
    __table_args__ = table_args()

    code: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    module: Mapped[str] = mapped_column(String(50), index=True)
    description: Mapped[str | None] = mapped_column(Text)

    role_links: Mapped[list[RolePermission]] = relationship(back_populates="permission")

    def __repr__(self) -> str:
        return f"<Permission {self.code}>"
