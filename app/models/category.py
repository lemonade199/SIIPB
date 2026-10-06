"""categories — asset categories."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TRUE, Base, IdMixin, SoftDeleteMixin, TimestampMixin, table_args

if TYPE_CHECKING:
    from app.models.asset import Asset


class Category(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "categories"
    __table_args__ = table_args()

    code: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=TRUE, index=True
    )

    assets: Mapped[list[Asset]] = relationship(back_populates="category")

    def __repr__(self) -> str:
        return f"<Category {self.code}>"
