"""Seed data awal (idempoten — aman dijalankan berulang).

Jalankan SETELAH `alembic upgrade head`:
    python scripts/seed_data.py              # data awal + contoh
    python scripts/seed_data.py --minimal    # hanya role, permission, akun admin

Kata sandi akun awal dapat diatur lewat environment:
    SEED_ADMIN_PASSWORD, SEED_PETUGAS_PASSWORD, SEED_PIMPINAN_PASSWORD
Di production WAJIB diganti setelah login pertama.
"""
import os
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    Asset,
    AssetCondition,
    AssetStatus,
    Borrower,
    Category,
    Location,
    OrganizationalUnit,
    Permission,
    Role,
    RolePermission,
    User,
    UserRole,
)
from app.models import NotificationTemplate  # noqa: E402
from app.services.default_templates import TEMPLATES  # noqa: E402
from app.utils.security import hash_password  # noqa: E402

PERMISSIONS = [
    ("dashboard.view", "Melihat dashboard & statistik", "dashboard"),
    ("inventory.view", "Melihat data inventaris", "inventory"),
    ("inventory.manage", "Tambah, ubah, nonaktifkan barang", "inventory"),
    ("masterdata.manage", "Kelola kategori, lokasi, peminjam, unit kerja", "masterdata"),
    ("borrowing.view", "Melihat transaksi peminjaman & pengembalian", "borrowing"),
    ("borrowing.manage", "Mencatat peminjaman & checkout", "borrowing"),
    ("return.manage", "Mencatat pengembalian", "return"),
    ("monitoring.view", "Monitoring jatuh tempo & keterlambatan", "monitoring"),
    ("notification.view", "Melihat riwayat & log notifikasi", "notification"),
    ("notification.manage", "Menjalankan pemeriksaan & kirim ulang", "notification"),
    ("qr.manage", "Membuat & mencetak label QR", "qr"),
    ("report.view", "Melihat laporan", "report"),
    ("report.export", "Unduh laporan PDF/Excel & cetak", "report"),
    ("audit.view", "Melihat audit log", "audit"),
    ("users.manage", "Kelola pengguna, role & permission", "users"),
    ("settings.manage", "SMTP, template, aturan notifikasi, backup", "settings"),
]
ROLES = {
    "ADMIN": ("Administrator", "Pengaturan sistem, pengguna, role, permission, seluruh data.", [p[0] for p in PERMISSIONS]),
    "SARPRAS": ("Petugas Sarpras/IT", "Mengelola inventaris, mencatat peminjaman/pengembalian, monitoring, laporan.",
                ["dashboard.view", "inventory.view", "inventory.manage", "masterdata.manage", "borrowing.view",
                 "borrowing.manage", "return.manage", "monitoring.view", "notification.view", "notification.manage",
                 "qr.manage", "report.view", "report.export"]),
    "PIMPINAN": ("Pimpinan", "Melihat dashboard, laporan, monitoring dan eskalasi.",
                 ["dashboard.view", "inventory.view", "borrowing.view", "monitoring.view", "notification.view",
                  "report.view", "report.export"]),
}


def get_or_create(session, _model, _where: dict, **defaults):
    row = session.scalars(select(_model).filter_by(**_where)).first()
    if row:
        return row, False
    row = _model(**_where, **defaults)
    session.add(row)
    session.flush()
    return row, True


def seed_rbac(session):
    perms = {}
    for code, name, module in PERMISSIONS:
        perms[code], _ = get_or_create(session, Permission, {"code": code}, name=name, module=module)
    roles = {}
    for code, (name, desc, codes) in ROLES.items():
        role, created = get_or_create(session, Role, {"code": code}, name=name, description=desc)
        roles[code] = role
        if created or not role.permission_links:
            for c in codes:
                get_or_create(session, RolePermission, {"role_id": role.id, "permission_id": perms[c].id})
    return roles


def seed_user(session, username, email, full_name, password, role, unit_id=None, phone=None):
    user = session.scalars(select(User).where(User.username == username)).first()
    if user:
        return user, False
    user = User(username=username, email=email, full_name=full_name, phone=phone, unit_id=unit_id,
                password_hash=hash_password(password))
    session.add(user)
    session.flush()
    session.add(UserRole(user_id=user.id, role_id=role.id))
    return user, True


def seed(minimal: bool = False):
    with SessionLocal() as session:
        roles = seed_rbac(session)
        for code, name, subject, body in TEMPLATES:
            get_or_create(session, NotificationTemplate, {"code": code}, name=name, subject=subject, body=body)
        root, _ = get_or_create(session, OrganizationalUnit, {"code": "INSTANSI"}, name="Instansi")
        sarpras, _ = get_or_create(session, OrganizationalUnit, {"code": "SARPRAS"}, name="Bagian Sarana & Prasarana / IT", parent_id=root.id)

        created = []
        _, c = seed_user(session, "admin", "admin@siipb.local", "Administrator SIIPB",
                         os.getenv("SEED_ADMIN_PASSWORD", "admin123"), roles["ADMIN"], sarpras.id)
        c and created.append("admin")
        if not minimal:
            _, c = seed_user(session, "petugas", "petugas@siipb.local", "Budi Santoso",
                             os.getenv("SEED_PETUGAS_PASSWORD", "petugas123"), roles["SARPRAS"], sarpras.id, "0812-1000-2000")
            c and created.append("petugas")
            _, c = seed_user(session, "pimpinan", "pimpinan@siipb.local", "Dr. Siti Rahayu",
                             os.getenv("SEED_PIMPINAN_PASSWORD", "pimpinan123"), roles["PIMPINAN"], root.id)
            c and created.append("pimpinan")

            units = {}
            for code, name in [("TU", "Tata Usaha"), ("KEU", "Keuangan"), ("AKD", "Akademik"), ("HUMAS", "Humas")]:
                units[code], _ = get_or_create(session, OrganizationalUnit, {"code": code}, name=name, parent_id=root.id)

            cats = {}
            for code, name in [("LPT", "Laptop & Komputer"), ("PRY", "Proyektor & Layar"), ("KAM", "Kamera & Multimedia"),
                               ("JAR", "Perangkat Jaringan"), ("AUD", "Audio")]:
                cats[code], _ = get_or_create(session, Category, {"code": code}, name=name)

            gedung, _ = get_or_create(session, Location, {"code": "GDA"}, name="Gedung A", description="Gedung A")
            locs = {}
            for code, name in [("GDA-SARPRAS", "Ruang Sarpras"), ("GDA-GUDANG", "Gudang Inventaris"), ("GDA-RAPAT", "Ruang Rapat Lt. 2")]:
                locs[code], _ = get_or_create(session, Location, {"code": code}, name=name, parent_id=gedung.id, description="Gedung A")

            for nip, name, unit, email, phone, pos in [
                ("198501012010011001", "Andi Wijaya", "TU", "andi.wijaya@contoh.id", "0813-1111-2222", "Staf TU"),
                ("199002022015022002", "Rina Kartika", "KEU", "rina.kartika@contoh.id", "0813-3333-4444", "Bendahara"),
                ("198803032012031003", "Dedi Kurniawan", "AKD", "dedi.k@contoh.id", "0813-5555-6666", "Guru"),
                ("199204042018042004", "Maya Lestari", "HUMAS", "maya.lestari@contoh.id", "0813-7777-8888", "Staf Humas"),
            ]:
                get_or_create(session, Borrower, {"identity_number": nip}, name=name, unit_id=units[unit].id,
                              email=email, phone=phone, position=pos)

            for code, name, cat, loc, brand, model, sn, year, cost in [
                ("INV-LPT-0001", "Laptop ThinkPad T14", "LPT", "GDA-SARPRAS", "Lenovo", "T14 Gen 3", "PF-3A21", 2023, 14500000),
                ("INV-LPT-0002", "Laptop ThinkPad T14", "LPT", "GDA-SARPRAS", "Lenovo", "T14 Gen 3", "PF-3A22", 2023, 14500000),
                ("INV-PRY-0001", "Proyektor Epson EB-X51", "PRY", "GDA-GUDANG", "Epson", "EB-X51", "EPX-5521", 2022, 6500000),
                ("INV-KAM-0001", "Kamera Sony A6400", "KAM", "GDA-GUDANG", "Sony", "ILCE-6400", "SNY-9912", 2024, 15000000),
                ("INV-JAR-0001", "Access Point UniFi U6", "JAR", "GDA-GUDANG", "Ubiquiti", "U6-Lite", "UBQ-7710", 2024, 2400000),
                ("INV-AUD-0001", "Speaker Portable JBL", "AUD", "GDA-RAPAT", "JBL", "EON 710", "JBL-4410", 2021, 9800000),
            ]:
                get_or_create(session, Asset, {"inventory_code": code}, name=name, category_id=cats[cat].id,
                              location_id=locs[loc].id, brand=brand, model=model, serial_number=sn,
                              purchase_date=date(year, 1, 1), acquisition_cost=Decimal(cost), acquisition_source="APBN",
                              status=AssetStatus.TERSEDIA.value, condition=AssetCondition.BAIK.value)
        session.commit()
        print("[SEED] selesai." + (f" Akun baru: {', '.join(created)}" if created else " (data sudah ada)"))


if __name__ == "__main__":
    seed(minimal="--minimal" in sys.argv)
