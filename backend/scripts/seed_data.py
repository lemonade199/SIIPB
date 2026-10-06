"""Seed database with realistic initial data for development & frontend testing."""
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models import (
    Asset,
    AssetCondition,
    AssetStatus,
    Borrower,
    Category,
    Location,
    NotificationTemplate,
    OrganizationalUnit,
    Permission,
    Role,
    RolePermission,
    SystemSetting,
    User,
    UserRole,
)


def seed():
    session = SessionLocal()
    print(">>> Seeding database with initial data for development...")

    try:
        # 1. Units
        sekolah = OrganizationalUnit(code="SMKN1", name="SMK Negeri 1")
        session.add(sekolah)
        session.flush()

        rpl = OrganizationalUnit(parent_id=sekolah.id, code="RPL", name="Jurusan RPL")
        tkj = OrganizationalUnit(parent_id=sekolah.id, code="TKJ", name="Jurusan TKJ")
        sarpras = OrganizationalUnit(parent_id=sekolah.id, code="SARPRAS", name="Unit Sarana & Prasarana")
        session.add_all([rpl, tkj, sarpras])
        session.flush()

        # 2. Roles & Permissions
        perms_data = [
            ("asset.view", "Melihat Daftar Aset", "asset"),
            ("asset.create", "Menambah Aset Baru", "asset"),
            ("asset.update", "Mengubah Data Aset", "asset"),
            ("asset.delete", "Menonaktifkan Aset", "asset"),
            ("borrowing.create", "Membuat Transaksi Peminjaman", "borrowing"),
            ("borrowing.return", "Memproses Pengembalian", "borrowing"),
            ("report.view", "Melihat Laporan Inventaris", "report"),
            ("user.manage", "Mengelola Pengguna & RBAC", "user"),
            ("settings.manage", "Mengelola Pengaturan Sistem", "settings"),
            ("audit.view", "Melihat Audit Trail", "audit"),
        ]
        perms = [Permission(code=c, name=n, module=m) for c, n, m in perms_data]
        session.add_all(perms)
        session.flush()

        role_admin = Role(code="ADMIN", name="Administrator Sistem")
        role_sarpras = Role(code="SARPRAS", name="Petugas Sarpras")
        role_pimpinan = Role(code="PIMPINAN", name="Pimpinan / Kepala Sekolah")
        session.add_all([role_admin, role_sarpras, role_pimpinan])
        session.flush()

        # Admin gets all perms
        for p in perms:
            session.add(RolePermission(role_id=role_admin.id, permission_id=p.id))

        # Sarpras gets asset & borrowing perms
        for p in perms:
            if p.module in ("asset", "borrowing", "report"):
                session.add(RolePermission(role_id=role_sarpras.id, permission_id=p.id))

        # 3. Staff Users
        admin_user = User(
            username="admin",
            email="admin@siipb.sch.id",
            password_hash="pbkdf2:sha256:admin123",
            full_name="Administrator SIIPB",
            unit_id=sarpras.id,
        )
        petugas_user = User(
            username="petugas",
            email="petugas@siipb.sch.id",
            password_hash="pbkdf2:sha256:petugas123",
            full_name="Budi Sarpras",
            unit_id=sarpras.id,
        )
        session.add_all([admin_user, petugas_user])
        session.flush()

        session.add_all([
            UserRole(user_id=admin_user.id, role_id=role_admin.id),
            UserRole(user_id=petugas_user.id, role_id=role_sarpras.id),
        ])

        # 4. Master: Categories & Locations
        c_laptop = Category(code="CAT-LAPTOP", name="Laptop & Komputer")
        c_proyektor = Category(code="CAT-PROYEKTOR", name="Proyektor & Layar")
        c_kamera = Category(code="CAT-KAMERA", name="Kamera & Multimedia")
        c_toolset = Category(code="CAT-TOOLSET", name="Perkakas & Jaringan")
        session.add_all([c_laptop, c_proyektor, c_kamera, c_toolset])

        loc_gedung = Location(code="LOC-GEDUNG-A", name="Gedung Utama (A)")
        session.add(loc_gedung)
        session.flush()

        loc_lab_rpl = Location(parent_id=loc_gedung.id, code="LOC-LAB-RPL", name="Laboratorium Software RPL")
        loc_lab_tkj = Location(parent_id=loc_gedung.id, code="LOC-LAB-TKJ", name="Laboratorium Jaringan TKJ")
        loc_gudang = Location(parent_id=loc_gedung.id, code="LOC-GUDANG", name="Gudang Inventaris Sarpras")
        session.add_all([loc_lab_rpl, loc_lab_tkj, loc_gudang])
        session.flush()

        # 5. Borrowers (Peminjam TANPA AKUN)
        borrowers = [
            Borrower(
                name="Ahmad Pratama",
                identity_number="NISN-0051234567",
                email="ahmad.pratama@siswa.sch.id",
                phone="081234567801",
                position="Siswa XII RPL 1",
                unit_id=rpl.id,
            ),
            Borrower(
                name="Siti Rahmawati",
                identity_number="NISN-0057654321",
                email="siti.rahma@siswa.sch.id",
                phone="081234567802",
                position="Siswa XII TKJ 2",
                unit_id=tkj.id,
            ),
            Borrower(
                name="Dedi Kurniawan, S.Kom",
                identity_number="NIP-198501012010011005",
                email="dedi.kurniawan@guru.sch.id",
                phone="081234567803",
                position="Guru Produktif RPL",
                unit_id=rpl.id,
            ),
        ]
        session.add_all(borrowers)

        # 6. Assets
        assets = [
            Asset(
                inventory_code="AST-RPL-001",
                category_id=c_laptop.id,
                location_id=loc_lab_rpl.id,
                owner_unit_id=rpl.id,
                name="ThinkPad T480s",
                brand="Lenovo",
                model="T480s",
                serial_number="PF-1A2B3C",
                purchase_date=date(2023, 6, 15),
                acquisition_cost=Decimal("13500000.00"),
                status=AssetStatus.TERSEDIA.value,
                condition=AssetCondition.BAIK.value,
            ),
            Asset(
                inventory_code="AST-RPL-002",
                category_id=c_laptop.id,
                location_id=loc_lab_rpl.id,
                owner_unit_id=rpl.id,
                name="MacBook Pro M1 14-inch",
                brand="Apple",
                model="A2442",
                serial_number="C02GXYZ901",
                purchase_date=date(2023, 8, 20),
                acquisition_cost=Decimal("28000000.00"),
                status=AssetStatus.TERSEDIA.value,
                condition=AssetCondition.BAIK.value,
            ),
            Asset(
                inventory_code="AST-SAR-001",
                category_id=c_proyektor.id,
                location_id=loc_gudang.id,
                owner_unit_id=sarpras.id,
                name="Epson EB-X500 Projector",
                brand="Epson",
                model="EB-X500",
                serial_number="EPS-882190",
                purchase_date=date(2022, 11, 5),
                acquisition_cost=Decimal("6500000.00"),
                status=AssetStatus.TERSEDIA.value,
                condition=AssetCondition.BAIK.value,
            ),
            Asset(
                inventory_code="AST-SAR-002",
                category_id=c_kamera.id,
                location_id=loc_gudang.id,
                owner_unit_id=sarpras.id,
                name="Sony Alpha A6400 Kit",
                brand="Sony",
                model="ILCE-6400L",
                serial_number="SNY-991204",
                purchase_date=date(2024, 1, 10),
                acquisition_cost=Decimal("15000000.00"),
                status=AssetStatus.TERSEDIA.value,
                condition=AssetCondition.BAIK.value,
            ),
            Asset(
                inventory_code="AST-TKJ-001",
                category_id=c_toolset.id,
                location_id=loc_lab_tkj.id,
                owner_unit_id=tkj.id,
                name="Fluke Network Cable Tester Kit",
                brand="Fluke Networks",
                model="MicroScanner2",
                serial_number="FLK-440192",
                purchase_date=date(2023, 3, 12),
                acquisition_cost=Decimal("9200000.00"),
                status=AssetStatus.TERSEDIA.value,
                condition=AssetCondition.BAIK.value,
            ),
        ]
        session.add_all(assets)

        # 7. Notification Templates
        templates = [
            NotificationTemplate(
                code="LOAN_CONFIRMATION",
                name="Konfirmasi Peminjaman",
                subject="[SIIPB] Bukti Peminjaman Barang #{transaction_number}",
                body="Halo {borrower_name},\n\nBarang berikut telah berhasil Anda pinjam:\n{items_list}\nTenggat pengembalian: {due_date}.\n\nTerima kasih,\nUnit Sarpras",
            ),
            NotificationTemplate(
                code="H_MINUS_1",
                name="Pengingat H-1 Tenggat",
                subject="[SIIPB] Pengingat: Tenggat Pengembalian Barang Besok (#{transaction_number})",
                body="Halo {borrower_name},\n\nMengingatkan bahwa masa peminjaman barang #{transaction_number} akan berakhir besok ({due_date}). Mohon kembalikan barang tepat waktu.",
            ),
            NotificationTemplate(
                code="RETURN_CONFIRMATION",
                name="Konfirmasi Pengembalian",
                subject="[SIIPB] Bukti Pengembalian Barang #{transaction_number}",
                body="Halo {borrower_name},\n\nBarang dari peminjaman #{transaction_number} telah diterima oleh petugas pada {return_time}. Status kondisi barang: {condition}.",
            ),
        ]
        session.add_all(templates)

        # 8. System Settings
        settings = [
            SystemSetting(key="system.app_name", value="SIIPB SMK Negeri 1", value_type="STRING", is_secret=False),
            SystemSetting(key="smtp.host", value="smtp.gmail.com", value_type="STRING", is_secret=False),
            SystemSetting(key="smtp.port", value="587", value_type="INTEGER", is_secret=False),
            SystemSetting(key="security.jwt_access_ttl_minutes", value="60", value_type="INTEGER", is_secret=False),
            SystemSetting(key="security.jwt_refresh_ttl_days", value="7", value_type="INTEGER", is_secret=False),
        ]
        session.add_all(settings)

        session.commit()
        print("\n[SUCCESS] Seed data completed!")
        print(f"  - Units       : 4 units")
        print(f"  - Users       : 2 users (admin, petugas)")
        print(f"  - Roles       : 3 roles (ADMIN, SARPRAS, PIMPINAN)")
        print(f"  - Categories  : 4 categories")
        print(f"  - Locations   : 4 locations")
        print(f"  - Assets      : 5 assets (Status: TERSEDIA)")
        print(f"  - Borrowers   : 3 borrowers (Tanpa akun)")
        print(f"  - Templates   : 3 notification templates")
        print(f"  - Settings    : 5 system settings")
        print("Ready for backend API & frontend testing!\n")

    except Exception as e:
        session.rollback()
        print("ERROR during seeding:", e)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed()
