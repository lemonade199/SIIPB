"""damage_reports — damage detail and repair lifecycle."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigIntU, DateTime6, IdMixin, TimestampMixin, table_args
from app.models.enums import DamageSeverity, RepairStatus, check_in

if TYPE_CHECKING:
    from app.models.asset_return import ReturnItem
    from app.models.user import User


class DamageReport(IdMixin, TimestampMixin, Base):
    """Only for return_items.final_condition = 'RUSAK' (enforced in service layer)."""

    __tablename__ = "damage_reports"
    __table_args__ = table_args(
        CheckConstraint(check_in("severity", DamageSeverity), name="severity"),
        CheckConstraint(check_in("repair_status", RepairStatus), name="repair_status"),
        CheckConstraint(
            "repair_cost IS NULL OR repair_cost >= 0", name="repair_cost_non_negative"
        ),
    )

    return_item_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("return_items.id", ondelete="RESTRICT"), index=True
    )
    reported_by: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    severity: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(Text)
    evidence_path: Mapped[str | None] = mapped_column(String(500))
    action_taken: Mapped[str | None] = mapped_column(Text)
    repair_status: Mapped[str] = mapped_column(
        String(30),
        default=RepairStatus.DILAPORKAN.value,
        server_default=text(f"'{RepairStatus.DILAPORKAN.value}'"),
        index=True,
    )
    repair_cost: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    reported_at: Mapped[datetime] = mapped_column(DateTime6, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime6)

    return_item: Mapped[ReturnItem] = relationship(back_populates="damage_reports")
    reporter: Mapped[User] = relationship()
