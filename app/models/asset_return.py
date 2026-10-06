"""returns (header) and return_items (detail).

Module is named ``asset_return`` because ``return`` is a Python keyword.
"""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigIntU, CreatedAtMixin, DateTime6, IdMixin, table_args
from app.models.enums import ReturnCondition, check_in

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.borrowing import Borrowing, BorrowingItem
    from app.models.damage_report import DamageReport
    from app.models.loss_report import LossReport
    from app.models.user import User


class Return(IdMixin, CreatedAtMixin, Base):
    """Partial returns allowed -> borrowing_id is NOT unique."""

    __tablename__ = "returns"
    __table_args__ = table_args()

    borrowing_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("borrowings.id", ondelete="RESTRICT"), index=True
    )
    received_by: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    returned_at: Mapped[datetime] = mapped_column(DateTime6, index=True)
    notes: Mapped[str | None] = mapped_column(Text)

    borrowing: Mapped[Borrowing] = relationship(back_populates="returns")
    receiver: Mapped[User] = relationship()
    items: Mapped[list[ReturnItem]] = relationship(back_populates="return_")


class ReturnItem(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "return_items"
    __table_args__ = table_args(
        CheckConstraint(check_in("final_condition", ReturnCondition), name="final_condition"),
    )

    return_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("returns.id", ondelete="RESTRICT"), index=True
    )
    borrowing_item_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("borrowing_items.id", ondelete="RESTRICT"), index=True
    )
    asset_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("assets.id", ondelete="RESTRICT"), index=True
    )
    final_condition: Mapped[str] = mapped_column(String(20))
    completeness: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    return_: Mapped[Return] = relationship(back_populates="items")
    borrowing_item: Mapped[BorrowingItem] = relationship(back_populates="return_items")
    asset: Mapped[Asset] = relationship()
    damage_reports: Mapped[list[DamageReport]] = relationship(back_populates="return_item")
    loss_report: Mapped[LossReport | None] = relationship(
        back_populates="return_item", uselist=False
    )
