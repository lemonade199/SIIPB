"""loss_reports — one per lost return item."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigIntU, DateTime6, IdMixin, TimestampMixin, table_args

if TYPE_CHECKING:
    from app.models.asset_return import ReturnItem
    from app.models.user import User


class LossReport(IdMixin, TimestampMixin, Base):
    """Only for return_items.final_condition = 'HILANG' (enforced in service layer)."""

    __tablename__ = "loss_reports"
    __table_args__ = table_args()

    return_item_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("return_items.id", ondelete="RESTRICT"), unique=True
    )
    reported_by: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    description: Mapped[str] = mapped_column(Text)
    evidence_path: Mapped[str | None] = mapped_column(String(500))
    action_taken: Mapped[str | None] = mapped_column(Text)
    reported_at: Mapped[datetime] = mapped_column(DateTime6, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime6)

    return_item: Mapped[ReturnItem] = relationship(back_populates="loss_report")
    reporter: Mapped[User] = relationship()
