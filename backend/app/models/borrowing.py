"""borrowings (header) and borrowing_items (detail)."""
from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
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
from app.models.enums import BorrowingStatus, check_in

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.asset_return import Return, ReturnItem
    from app.models.borrower import Borrower
    from app.models.notification_event import NotificationEvent
    from app.models.user import User


class Borrowing(IdMixin, TimestampMixin, Base):
    __tablename__ = "borrowings"
    __table_args__ = table_args(
        CheckConstraint(check_in("status", BorrowingStatus), name="status"),
        CheckConstraint("due_date >= start_date", name="due_date_after_start"),
        # Celery scanner: WHERE status IN ('AKTIF','TERLAMBAT') AND due_date ...
        # (also covers single-column lookups on status).
        Index("ix_borrowings_status_due_date", "status", "due_date"),
    )

    transaction_number: Mapped[str] = mapped_column(String(50), unique=True)
    borrower_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("borrowers.id", ondelete="RESTRICT"), index=True
    )
    handled_by: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    borrowed_at: Mapped[datetime] = mapped_column(DateTime6, index=True)
    start_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date, index=True)
    purpose: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(30),
        default=BorrowingStatus.AKTIF.value,
        server_default=text(f"'{BorrowingStatus.AKTIF.value}'"),
    )
    # Draf -> checkout (penyerahan barang) dicatat terpisah dari pembuatan transaksi.
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime6)
    checked_out_by: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime6)
    cancel_reason: Mapped[str | None] = mapped_column(Text)

    borrower: Mapped[Borrower] = relationship(back_populates="borrowings")
    handler: Mapped[User] = relationship(foreign_keys=[handled_by])
    checkout_user: Mapped[User | None] = relationship(foreign_keys=[checked_out_by])
    items: Mapped[list[BorrowingItem]] = relationship(back_populates="borrowing")
    returns: Mapped[list[Return]] = relationship(back_populates="borrowing")
    notification_events: Mapped[list[NotificationEvent]] = relationship(
        back_populates="borrowing"
    )

    @property
    def is_open(self) -> bool:
        return self.status in (BorrowingStatus.AKTIF, BorrowingStatus.TERLAMBAT)

    def __repr__(self) -> str:
        return f"<Borrowing {self.transaction_number} {self.status}>"


class BorrowingItem(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "borrowing_items"
    __table_args__ = table_args(
        # Leading column also serves as the index for borrowing_id.
        UniqueConstraint(
            "borrowing_id", "asset_id", name="uq_borrowing_items_borrowing_id_asset_id"
        ),
    )

    borrowing_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("borrowings.id", ondelete="RESTRICT")
    )
    asset_id: Mapped[int] = mapped_column(
        BigIntU, ForeignKey("assets.id", ondelete="RESTRICT"), index=True
    )
    # NULL selama transaksi masih DRAF.
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime6)
    condition_out: Mapped[str | None] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text)

    borrowing: Mapped[Borrowing] = relationship(back_populates="items")
    asset: Mapped[Asset] = relationship(back_populates="borrowing_items")
    return_items: Mapped[list[ReturnItem]] = relationship(back_populates="borrowing_item")
