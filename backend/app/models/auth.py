"""Authentication: refresh_tokens (hashed) and external_identities (OAuth/OIDC/SSO)."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CHAR, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    Base,
    BigIntU,
    CreatedAtMixin,
    DateTime6,
    IdMixin,
    TimestampMixin,
    table_args,
)

if TYPE_CHECKING:
    from app.models.user import User


class RefreshToken(IdMixin, CreatedAtMixin, Base):
    """Only the SHA-256 hex digest of the refresh token is stored."""

    __tablename__ = "refresh_tokens"
    __table_args__ = table_args()

    user_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(CHAR(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime6, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime6)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime6)

    user: Mapped[User] = relationship(back_populates="refresh_tokens")

    def is_valid(self, now: datetime) -> bool:
        return self.revoked_at is None and self.expires_at > now


class ExternalIdentity(IdMixin, TimestampMixin, Base):
    """Identity is (provider, provider_subject) — never email alone."""

    __tablename__ = "external_identities"
    __table_args__ = table_args(
        UniqueConstraint(
            "provider",
            "provider_subject",
            name="uq_external_identities_provider_provider_subject",
        ),
    )

    user_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(50))
    provider_subject: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), index=True)

    user: Mapped[User] = relationship(back_populates="external_identities")
