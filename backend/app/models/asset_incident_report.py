"""asset_incident_reports — combined damage & loss lifecycle for returned items."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigIntU, DateTime6, IdMixin, TimestampMixin, table_args
from app.models.enums import DamageSeverity, RepairStatus, check_in

if TYPE_CHECKING:
    from app.models.asset_return import ReturnItem
    from app.models.user import User


class AssetIncidentReport(IdMixin, TimestampMixin, Base):
    """Consolidated incident report for returned assets (KERUSAKAN or KEHILANGAN)."""

    __tablename__ = "asset_incident_reports"
    __table_args__ = table_args(
        UniqueConstraint(
            "return_item_id", "incident_type",
            name="uq_asset_incident_reports_return_item_id_incident_type",
        ),
        CheckConstraint(
            "incident_type IN ('KERUSAKAN', 'KEHILANGAN')",
            name="ck_asset_incident_reports_incident_type",
        ),
        CheckConstraint(
            "severity IS NULL OR severity IN ('RINGAN', 'SEDANG', 'BERAT')",
            name="ck_asset_incident_reports_severity",
        ),
        CheckConstraint(
            check_in("repair_status", RepairStatus),
            name="ck_asset_incident_reports_repair_status",
        ),
        CheckConstraint(
            "repair_cost IS NULL OR repair_cost >= 0",
            name="ck_asset_incident_reports_repair_cost_non_negative",
        ),
    )

    return_item_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("return_items.id", ondelete="RESTRICT"), index=True
    )
    reported_by: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    incident_type: Mapped[str] = mapped_column(String(30), index=True)
    severity: Mapped[str | None] = mapped_column(String(30))
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

    return_item: Mapped[ReturnItem] = relationship(back_populates="incident_reports")
    reporter: Mapped[User] = relationship()


# Backward compatibility aliases
DamageReport = AssetIncidentReport
LossReport = AssetIncidentReport
