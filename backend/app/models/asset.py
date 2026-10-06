"""assets (inventory) and asset_history (append-only change log)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    TRUE,
    Base,
    BigIntU,
    CreatedAtMixin,
    IdMixin,
    SoftDeleteMixin,
    TimestampMixin,
    table_args,
)
from app.models.enums import AssetCondition, AssetStatus, check_in

if TYPE_CHECKING:
    from app.models.borrowing import BorrowingItem
    from app.models.category import Category
    from app.models.location import Location
    from app.models.organizational_unit import OrganizationalUnit
    from app.models.user import User


class Asset(IdMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "assets"
    __table_args__ = table_args(
        CheckConstraint(check_in("status", AssetStatus), name="status"),
        CheckConstraint(check_in("condition", AssetCondition), name="condition"),
        CheckConstraint(
            "acquisition_cost IS NULL OR acquisition_cost >= 0",
            name="acquisition_cost_non_negative",
        ),
    )

    inventory_code: Mapped[str] = mapped_column(String(50), unique=True)
    category_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("categories.id", ondelete="RESTRICT"), index=True
    )
    location_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("locations.id", ondelete="RESTRICT"), index=True
    )
    owner_unit_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("organizational_units.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(200), index=True)
    brand: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    # Intentionally NOT unique (legacy data / items without serial numbers).
    serial_number: Mapped[str | None] = mapped_column(String(150), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    photo_path: Mapped[str | None] = mapped_column(String(500))
    purchase_date: Mapped[date | None] = mapped_column(Date)
    acquisition_cost: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    status: Mapped[str] = mapped_column(
        String(30),
        default=AssetStatus.TERSEDIA.value,
        server_default=text(f"'{AssetStatus.TERSEDIA.value}'"),
        index=True,
    )
    condition: Mapped[str] = mapped_column(
        String(30),
        default=AssetCondition.BAIK.value,
        server_default=text(f"'{AssetCondition.BAIK.value}'"),
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=TRUE, index=True
    )

    category: Mapped[Category] = relationship(back_populates="assets")
    location: Mapped[Location | None] = relationship(back_populates="assets")
    owner_unit: Mapped[OrganizationalUnit | None] = relationship(back_populates="assets")
    history: Mapped[list[AssetHistory]] = relationship(
        back_populates="asset", order_by="AssetHistory.created_at"
    )
    borrowing_items: Mapped[list[BorrowingItem]] = relationship(back_populates="asset")

    @property
    def is_borrowable(self) -> bool:
        return (
            self.is_active
            and self.deleted_at is None
            and self.status == AssetStatus.TERSEDIA
        )

    def __repr__(self) -> str:
        return f"<Asset {self.inventory_code} {self.status}>"


class AssetHistory(IdMixin, CreatedAtMixin, Base):
    """Append-only. The application must never UPDATE/DELETE rows here."""

    __tablename__ = "asset_history"
    __table_args__ = table_args(
        Index("ix_asset_history_asset_id_created_at", "asset_id", "created_at"),
        Index("ix_asset_history_created_at", "created_at"),
    )

    asset_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("assets.id", ondelete="RESTRICT")
    )
    changed_by: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    old_status: Mapped[str | None] = mapped_column(String(30))
    new_status: Mapped[str | None] = mapped_column(String(30))
    old_location_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("locations.id", ondelete="RESTRICT"), index=True
    )
    new_location_id: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("locations.id", ondelete="RESTRICT"), index=True
    )
    old_condition: Mapped[str | None] = mapped_column(String(30))
    new_condition: Mapped[str | None] = mapped_column(String(30))
    reason: Mapped[str | None] = mapped_column(Text)
    old_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    new_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    asset: Mapped[Asset] = relationship(back_populates="history")
    changer: Mapped[User | None] = relationship()
    old_location: Mapped[Location | None] = relationship(foreign_keys=[old_location_id])
    new_location: Mapped[Location | None] = relationship(foreign_keys=[new_location_id])
