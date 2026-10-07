"""users (login accounts) and user_roles (users <-> roles)."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    CURRENT_TS6,
    TRUE,
    Base,
    BigIntU,
    DateTime6,
    IdMixin,
    SoftDeleteMixin,
    TimestampMixin,
    table_args,
)

if TYPE_CHECKING:
    from app.models.auth import ExternalIdentity, RefreshToken
    from app.models.organizational_unit import OrganizationalUnit
    from app.models.role import Role


class User(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Staff/admin/pimpinan account. Borrowers are NOT users."""

    __tablename__ = "users"
    __table_args__ = table_args(Index("ix_users_deleted_at", "deleted_at"))

    username: Mapped[str] = mapped_column(String(100), unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    # NULL for SSO/OIDC-only accounts.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(30))
    unit_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("organizational_units.id", ondelete="RESTRICT"), index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=TRUE, index=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime6)

    unit: Mapped[OrganizationalUnit | None] = relationship(back_populates="users")
    role_links: Mapped[list[UserRole]] = relationship(
        back_populates="user",
        foreign_keys="UserRole.user_id",
        cascade="all, delete-orphan",
    )
    roles: Mapped[list[Role]] = relationship(
        secondary="user_roles",
        primaryjoin="User.id == UserRole.user_id",
        secondaryjoin="Role.id == UserRole.role_id",
        viewonly=True,
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    external_identities: Mapped[list[ExternalIdentity]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def permission_codes(self) -> set[str]:
        return {p.code for r in self.roles if r.is_active for p in r.permissions}

    def has_permission(self, code: str) -> bool:
        return code in self.permission_codes

    def __repr__(self) -> str:
        return f"<User {self.username}>"


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = table_args()

    user_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime6, server_default=CURRENT_TS6
    )
    assigned_by: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    user: Mapped[User] = relationship(back_populates="role_links", foreign_keys=[user_id])
    role: Mapped[Role] = relationship(back_populates="user_links")
    assigner: Mapped[User | None] = relationship(foreign_keys=[assigned_by])
