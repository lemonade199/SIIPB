"""locations — hierarchical (Gedung > Lantai > Ruang)."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
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
    from app.models.asset import Asset


class Location(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "locations"
    __table_args__ = table_args()

    parent_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("locations.id", ondelete="RESTRICT"), index=True
    )
    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=TRUE, index=True
    )

    parent: Mapped[Location | None] = relationship(
        remote_side="Location.id", back_populates="children"
    )
    children: Mapped[list[Location]] = relationship(back_populates="parent")
    assets: Mapped[list[Asset]] = relationship(back_populates="location")

    def __repr__(self) -> str:
        return f"<Location {self.code}>"
