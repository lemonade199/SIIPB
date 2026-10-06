"""Declarative base, shared column types, and mixins for all SIIPB models."""
from datetime import datetime

from sqlalchemy import MetaData, text
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Deterministic constraint/index names so Alembic migrations are stable.
NAMING_CONVENTION = {
    "pk": "pk_%(table_name)s",
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
}

# ---- Shared column types -------------------------------------------------
BigIntU = mysql.BIGINT(unsigned=True)
IntU = mysql.INTEGER(unsigned=True)
DateTime6 = mysql.DATETIME(fsp=6)

CURRENT_TS6 = text("CURRENT_TIMESTAMP(6)")
CURRENT_TS6_ON_UPDATE = text("CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)")
TRUE = text("1")
FALSE = text("0")

TABLE_OPTIONS = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_unicode_ci",
}


def table_args(*items):
    """Build ``__table_args__`` = constraints/indexes + InnoDB/utf8mb4 options."""
    return (*items, dict(TABLE_OPTIONS))


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


# ---- Mixins --------------------------------------------------------------
class IdMixin:
    id: Mapped[int] = mapped_column(
        BigIntU, primary_key=True, autoincrement=True, sort_order=-1000
    )


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime6, nullable=False, server_default=CURRENT_TS6, sort_order=1000
    )


class TimestampMixin(CreatedAtMixin):
    updated_at: Mapped[datetime] = mapped_column(
        DateTime6,
        nullable=False,
        server_default=CURRENT_TS6_ON_UPDATE,
        sort_order=1001,
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime6, nullable=True, sort_order=1002
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None
