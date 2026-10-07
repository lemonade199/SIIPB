"""Domain enums. Stored as VARCHAR and guarded by DB CHECK constraints.

The CHECK constraint SQL is generated from these enums via :func:`check_in`,
and the same literal SQL is frozen in the Alembic migrations.
"""
from enum import StrEnum


class AssetStatus(StrEnum):
    TERSEDIA = "TERSEDIA"
    DIPINJAM = "DIPINJAM"
    RUSAK = "RUSAK"
    RUSAK_BERAT = "RUSAK_BERAT"
    DALAM_PERBAIKAN = "DALAM_PERBAIKAN"
    HILANG = "HILANG"
    NONAKTIF = "NONAKTIF"


# Statuses that may NOT be checked out (business rules 2-6).
NON_BORROWABLE_ASSET_STATUSES = frozenset(AssetStatus) - {AssetStatus.TERSEDIA}


class AssetCondition(StrEnum):
    BAIK = "BAIK"
    RUSAK_RINGAN = "RUSAK_RINGAN"
    RUSAK_BERAT = "RUSAK_BERAT"


class BorrowingStatus(StrEnum):
    DRAF = "DRAF"
    AKTIF = "AKTIF"
    TERLAMBAT = "TERLAMBAT"
    DIKEMBALIKAN = "DIKEMBALIKAN"
    DIBATALKAN = "DIBATALKAN"


class ReturnCondition(StrEnum):
    BAIK = "BAIK"
    RUSAK = "RUSAK"
    HILANG = "HILANG"


class DamageSeverity(StrEnum):
    RINGAN = "RINGAN"
    SEDANG = "SEDANG"
    BERAT = "BERAT"


class RepairStatus(StrEnum):
    DILAPORKAN = "DILAPORKAN"
    DIPERIKSA = "DIPERIKSA"
    DALAM_PERBAIKAN = "DALAM_PERBAIKAN"
    SELESAI = "SELESAI"
    TIDAK_DAPAT_DIPERBAIKI = "TIDAK_DAPAT_DIPERBAIKI"


class NotificationEventCode(StrEnum):
    """Also used as ``notification_templates.code`` (not DB-constrained, extensible)."""

    LOAN_CONFIRMATION = "LOAN_CONFIRMATION"
    H_MINUS_3 = "H_MINUS_3"
    H_MINUS_1 = "H_MINUS_1"
    H_DAY = "H_DAY"
    H_PLUS_1 = "H_PLUS_1"
    H_PLUS_3 = "H_PLUS_3"
    H_PLUS_7 = "H_PLUS_7"
    RETURN_CONFIRMATION = "RETURN_CONFIRMATION"


class NotificationEventStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    SKIPPED = "SKIPPED"
    FAILED = "FAILED"


class NotificationChannel(StrEnum):
    EMAIL = "EMAIL"


class NotificationStatus(StrEnum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    SENT = "SENT"
    FAILED = "FAILED"
    RETRYING = "RETRYING"


class RecipientType(StrEnum):
    PEMINJAM = "PEMINJAM"
    PETUGAS = "PETUGAS"
    PIMPINAN = "PIMPINAN"


class EmailDeliveryStatus(StrEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class SettingValueType(StrEnum):
    STRING = "STRING"
    INTEGER = "INTEGER"
    FLOAT = "FLOAT"
    BOOLEAN = "BOOLEAN"
    JSON = "JSON"


def check_in(column: str, enum: type[StrEnum]) -> str:
    """SQL for ``CHECK (`column` IN ('A','B',...))``."""
    values = ", ".join(f"'{m.value}'" for m in enum)
    return f"`{column}` IN ({values})"
