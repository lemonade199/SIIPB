"""organizational_units — hierarchical organisation tree (Sekolah > RPL/TKJ/...)."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TRUE, Base, BigIntU, IdMixin, TimestampMixin, table_args

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.borrower import Borrower
    from app.models.user import User


class OrganizationalUnit(IdMixin, TimestampMixin, Base):
    __tablename__ = "organizational_units"
    __table_args__ = table_args()

    parent_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("organizational_units.id", ondelete="RESTRICT"), index=True
    )
    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=TRUE, index=True
    )

    parent: Mapped[OrganizationalUnit | None] = relationship(
        remote_side="OrganizationalUnit.id", back_populates="children"
    )
    children: Mapped[list[OrganizationalUnit]] = relationship(back_populates="parent")
    users: Mapped[list[User]] = relationship(back_populates="unit")
    borrowers: Mapped[list[Borrower]] = relationship(back_populates="unit")
    assets: Mapped[list[Asset]] = relationship(back_populates="owner_unit")

    def __repr__(self) -> str:
        return f"<OrganizationalUnit {self.code}>"
