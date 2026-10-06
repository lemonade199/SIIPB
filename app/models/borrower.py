"""borrowers — master data only. Borrowers have NO login/account."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    TRUE,
    Base,
    BigIntU,
    IdMixin,
    SoftDeleteMixin,
    TimestampMixin,
    table_args,
)

if TYPE_CHECKING:
    from app.models.borrowing import Borrowing
    from app.models.notification import Notification
    from app.models.organizational_unit import OrganizationalUnit


class Borrower(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "borrowers"
    __table_args__ = table_args()

    unit_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("organizational_units.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(150), index=True)
    identity_number: Mapped[str | None] = mapped_column(String(100), index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(30))
    position: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=TRUE, index=True
    )

    unit: Mapped[OrganizationalUnit | None] = relationship(back_populates="borrowers")
    borrowings: Mapped[list[Borrowing]] = relationship(back_populates="borrower")
    notifications: Mapped[list[Notification]] = relationship(back_populates="borrower")

    def __repr__(self) -> str:
        return f"<Borrower {self.name}>"
