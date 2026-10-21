"""users (login accounts, single role, and integrated Google OAuth)."""
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
    from app.models.auth import RefreshToken
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
    role_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("roles.id", ondelete="RESTRICT"), index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=TRUE, index=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime6)

    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    google_email: Mapped[str | None] = mapped_column(String(255))
    google_linked_at: Mapped[datetime | None] = mapped_column(DateTime6)

    unit: Mapped[OrganizationalUnit | None] = relationship(back_populates="users")
    role: Mapped[Role] = relationship(back_populates="users", foreign_keys=[role_id])
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def roles(self) -> list[Role]:
        """Backward-compatible property returning list of roles."""
        return [self.role] if self.role else []

    @property
    def external_identities(self) -> list[dict[str, str]]:
        """Backward-compatible property for Google SSO status."""
        if self.google_subject:
            return [{"provider": "google", "provider_subject": self.google_subject, "email": self.google_email or self.email}]
        return []

    @property
    def permission_codes(self) -> set[str]:
        if self.role and self.role.is_active:
            perms = self.role.permissions or []
            return {p if isinstance(p, str) else p.code for p in perms}
        return set()

    def has_permission(self, code: str) -> bool:
        return code in self.permission_codes

    def __repr__(self) -> str:
        return f"<User {self.username}>"
