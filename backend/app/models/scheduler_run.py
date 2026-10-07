"""scheduler_runs — log setiap pemeriksaan jatuh tempo (Celery Beat maupun manual)."""
from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import JSON, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntU, CreatedAtMixin, IdMixin, table_args


class SchedulerRun(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "scheduler_runs"
    __table_args__ = table_args()

    run_date: Mapped[date] = mapped_column(Date, index=True)
    trigger: Mapped[str] = mapped_column(String(30))  # BEAT | MANUAL
    triggered_by: Mapped[int | None] = mapped_column(
        BigIntU, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    checked: Mapped[int] = mapped_column(Integer, default=0)
    late_marked: Mapped[int] = mapped_column(Integer, default=0)
    sent: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    details: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)
