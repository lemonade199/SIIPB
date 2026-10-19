"""permissions — Static catalog of 16 system permissions in SIIPB."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PermissionItem:
    id: int
    code: str
    name: str
    module: str
    description: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "module": self.module,
            "description": self.description,
        }


SYSTEM_PERMISSIONS: list[PermissionItem] = [
    PermissionItem(1, "audit.view", "Melihat audit log", "audit"),
    PermissionItem(2, "borrowing.manage", "Mencatat peminjaman & checkout", "borrowing"),
    PermissionItem(3, "borrowing.view", "Melihat transaksi peminjaman & pengembalian", "borrowing"),
    PermissionItem(4, "dashboard.view", "Melihat dashboard & statistik", "dashboard"),
    PermissionItem(5, "inventory.manage", "Tambah, ubah, nonaktifkan barang", "inventory"),
    PermissionItem(6, "inventory.view", "Melihat data inventaris", "inventory"),
    PermissionItem(7, "masterdata.manage", "Kelola kategori, lokasi, peminjam, unit kerja", "masterdata"),
    PermissionItem(8, "monitoring.view", "Monitoring jatuh tempo & keterlambatan", "monitoring"),
    PermissionItem(9, "notification.manage", "Menjalankan pemeriksaan & kirim ulang", "notification"),
    PermissionItem(10, "notification.view", "Melihat riwayat & log notifikasi", "notification"),
    PermissionItem(11, "qr.manage", "Membuat & mencetak label QR", "qr"),
    PermissionItem(12, "report.export", "Unduh laporan PDF/Excel & cetak", "report"),
    PermissionItem(13, "report.view", "Melihat laporan", "report"),
    PermissionItem(14, "return.manage", "Mencatat pengembalian", "return"),
    PermissionItem(15, "settings.manage", "SMTP, template, aturan notifikasi, backup", "settings"),
    PermissionItem(16, "users.manage", "Kelola pengguna, role & permission", "users"),
]

PERMISSIONS_BY_CODE: dict[str, PermissionItem] = {p.code: p for p in SYSTEM_PERMISSIONS}
ALL_PERMISSION_CODES: set[str] = set(PERMISSIONS_BY_CODE.keys())


def get_all_permissions() -> list[dict[str, Any]]:
    """Return all permissions sorted by module and code."""
    return [p.to_dict() for p in sorted(SYSTEM_PERMISSIONS, key=lambda x: (x.module, x.code))]


# Backward-compatible alias
Permission = PermissionItem

__all__ = [
    "ALL_PERMISSION_CODES",
    "PERMISSIONS_BY_CODE",
    "Permission",
    "PermissionItem",
    "SYSTEM_PERMISSIONS",
    "get_all_permissions",
]
