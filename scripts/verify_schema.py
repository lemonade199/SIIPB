"""Comprehensive schema & business rule validation script for SIIPB."""
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError, OperationalError

from app.database import SessionLocal, engine
from app.models import (
    Asset,
    AssetCondition,
    AssetHistory,
    AssetStatus,
    AuditLog,
    Base,
    Borrower,
    Borrowing,
    BorrowingItem,
    BorrowingStatus,
    Category,
    DamageReport,
    DamageSeverity,
    EmailDelivery,
    EmailDeliveryStatus,
    ExternalIdentity,
    Location,
    LossReport,
    Notification,
    NotificationChannel,
    NotificationEvent,
    NotificationEventCode,
    NotificationEventStatus,
    NotificationLog,
    NotificationStatus,
    NotificationTemplate,
    OrganizationalUnit,
    Permission,
    RefreshToken,
    RepairStatus,
    Return,
    ReturnCondition,
    ReturnItem,
    Role,
    RolePermission,
    SystemSetting,
    User,
    UserRole,
)


def reset_database():
    """Truncate all tables cleanly before verification."""
    with engine.connect() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(text(f"TRUNCATE TABLE `{table.name}`;"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        conn.commit()


def run_checks():
    reset_database()
    print(">>> Starting Schema & Business Rule Verification...\n")

    # 1. Master Data & RBAC
    with SessionLocal() as session:
        sekolah = OrganizationalUnit(code="SEKOLAH", name="SMK Negeri 1")
        session.add(sekolah)
        session.flush()

        rpl = OrganizationalUnit(
            parent_id=sekolah.id, code="RPL", name="Rekayasa Perangkat Lunak"
        )
        session.add(rpl)

        p_view = Permission(code="asset.view", name="Lihat Aset", module="asset")
        p_checkout = Permission(
            code="borrowing.create", name="Peminjaman Aset", module="borrowing"
        )
        session.add_all([p_view, p_checkout])
        session.flush()

        admin_role = Role(code="ADMIN", name="Administrator")
        session.add(admin_role)
        session.flush()

        session.add_all(
            [
                RolePermission(role_id=admin_role.id, permission_id=p_view.id),
                RolePermission(role_id=admin_role.id, permission_id=p_checkout.id),
            ]
        )

        petugas = User(
            username="petugas1",
            email="petugas1@siipb.sch.id",
            password_hash="pbkdf2:sha256:dummyhash",
            full_name="Petugas Sarpras",
            unit_id=rpl.id,
            is_active=True,
        )
        session.add(petugas)
        session.flush()

        session.add(
            UserRole(user_id=petugas.id, role_id=admin_role.id, assigned_by=petugas.id)
        )

        cat_laptop = Category(code="CAT-LAPTOP", name="Laptop & Notebook")
        session.add(cat_laptop)

        loc_lab = Location(code="LOC-LAB-RPL", name="Lab Komputer RPL")
        session.add(loc_lab)

        borrower_mhs = Borrower(
            name="Ahmad Siswa",
            identity_number="NISN-12345678",
            email="ahmad@siswa.sch.id",
            phone="081234567890",
            position="Siswa Kelas XII RPL",
            unit_id=rpl.id,
        )
        session.add(borrower_mhs)
        session.flush()

        laptop1 = Asset(
            inventory_code="AST-RPL-001",
            category_id=cat_laptop.id,
            location_id=loc_lab.id,
            owner_unit_id=rpl.id,
            name="ThinkPad T480s",
            brand="Lenovo",
            model="T480s",
            serial_number="PF-XYZ123",
            acquisition_cost=Decimal("12500000.00"),
            status=AssetStatus.TERSEDIA.value,
            condition=AssetCondition.BAIK.value,
        )
        session.add(laptop1)

        template = NotificationTemplate(
            code="LOAN_CONFIRMATION",
            name="Konfirmasi Peminjaman",
            subject="Peminjaman Barang {transaction_number} Berhasil",
            body="Halo {borrower_name}, barang telah berhasil dipinjam.",
        )
        session.add(template)

        session.commit()
        print("[1] Master Data, RBAC & Asset created successfully.")
        print(f"    - User permissions: {petugas.permission_codes}")
        print(f"    - Borrower: {borrower_mhs.name} (NO LOGIN ACCOUNT)")
        print(f"    - Asset: {laptop1.inventory_code} ({laptop1.status})")

    # 2. Test CHECK constraint: due_date < start_date
    with SessionLocal() as session:
        try:
            b = Borrowing(
                transaction_number="TX-INVALID-DATE",
                borrower_id=1,
                handled_by=1,
                borrowed_at=datetime.now(),
                start_date=date.today(),
                due_date=date.today() - timedelta(days=2),  # VIOLATION
                status=BorrowingStatus.AKTIF.value,
            )
            session.add(b)
            session.commit()
            raise RuntimeError("CHECK constraint due_date >= start_date failed!")
        except (IntegrityError, OperationalError, DBAPIError):
            print("[2] MariaDB CHECK constraint confirmed: due_date < start_date rejected.")

    # 3. Test CHECK constraint: invalid asset status
    with SessionLocal() as session:
        try:
            a = Asset(
                inventory_code="AST-INVALID-001",
                category_id=1,
                name="Invalid Status Asset",
                status="STATUS_PALSU",  # VIOLATION
                condition="BAIK",
            )
            session.add(a)
            session.commit()
            raise RuntimeError("CHECK constraint asset status failed!")
        except (IntegrityError, OperationalError, DBAPIError):
            print("[3] MariaDB CHECK constraint confirmed: invalid asset status rejected.")

    # 4. Transaction: Borrowing & Checkout
    now = datetime.now()
    with SessionLocal() as session:
        tx = Borrowing(
            transaction_number="TX-2026-0001",
            borrower_id=1,
            handled_by=1,
            borrowed_at=now,
            start_date=date.today(),
            due_date=date.today() + timedelta(days=3),
            purpose="Pengerjaan Tugas Akhir RPL",
            status=BorrowingStatus.AKTIF.value,
        )
        session.add(tx)
        session.flush()

        item = BorrowingItem(
            borrowing_id=tx.id,
            asset_id=1,
            checked_out_at=now,
            notes="Dipinjam lengkap adaptor",
        )
        session.add(item)

        # Update Asset TERSEDIA -> DIPINJAM
        asset = session.get(Asset, 1)
        old_status = asset.status
        asset.status = AssetStatus.DIPINJAM.value

        session.add(
            AssetHistory(
                asset_id=asset.id,
                changed_by=1,
                event_type="CHECKOUT",
                old_status=old_status,
                new_status=asset.status,
                reason=f"Peminjaman {tx.transaction_number}",
            )
        )

        session.add(
            AuditLog(
                user_id=1,
                action="BORROWING_CREATED",
                module="borrowing",
                entity_type="borrowing",
                entity_id=tx.id,
                new_data={"transaction_number": tx.transaction_number, "asset_id": 1},
                ip_address="127.0.0.1",
            )
        )

        session.commit()
        print("[4] Borrowing & Checkout transaction committed.")
        print(f"    - Transaction: {tx.transaction_number}")
        print(f"    - Asset status updated to: {asset.status}")

    # 5. Notification Idempotency: UNIQUE(borrowing_id, event_code)
    with SessionLocal() as session:
        evt = NotificationEvent(
            borrowing_id=1,
            event_code=NotificationEventCode.LOAN_CONFIRMATION.value,
            scheduled_at=now,
            status=NotificationEventStatus.PENDING.value,
        )
        session.add(evt)
        session.commit()
        print("[5] Notification event created.")

    # 6. Test Idempotency duplicate event rejection
    with SessionLocal() as session:
        try:
            evt_dup = NotificationEvent(
                borrowing_id=1,
                event_code=NotificationEventCode.LOAN_CONFIRMATION.value,  # DUPLICATE
                scheduled_at=now,
                status=NotificationEventStatus.PENDING.value,
            )
            session.add(evt_dup)
            session.commit()
            raise RuntimeError("UNIQUE constraint on notification_events failed!")
        except (IntegrityError, OperationalError, DBAPIError):
            print("[6] Idempotency confirmed: duplicate (borrowing_id, event_code) rejected.")

    # 7. Notification creation & Email delivery attempt
    with SessionLocal() as session:
        notif = Notification(
            event_id=1,
            borrower_id=1,
            template_id=1,
            channel=NotificationChannel.EMAIL.value,
            recipient="ahmad@siswa.sch.id",
            subject="Peminjaman TX-2026-0001 Berhasil",
            body_snapshot="Halo Ahmad Siswa, barang telah berhasil dipinjam.",
            status=NotificationStatus.QUEUED.value,
        )
        session.add(notif)
        session.flush()

        delivery1 = EmailDelivery(
            notification_id=notif.id,
            attempt_number=1,
            provider="smtp",
            status=EmailDeliveryStatus.SENT.value,
            attempted_at=now,
            delivered_at=now + timedelta(seconds=2),
        )
        session.add(delivery1)

        log = NotificationLog(
            notification_id=notif.id,
            status=NotificationStatus.SENT.value,
            message="Email sent successfully via SMTP",
        )
        session.add(log)
        session.commit()
        print("[7] Notification & EmailDelivery attempt recorded.")

    # 8. Return & Damage Report
    with SessionLocal() as session:
        ret = Return(
            borrowing_id=1,
            received_by=1,
            returned_at=now + timedelta(days=2),
            notes="Pengembalian dengan kondisi layar retak",
        )
        session.add(ret)
        session.flush()

        ret_item = ReturnItem(
            return_id=ret.id,
            borrowing_item_id=1,
            asset_id=1,
            final_condition=ReturnCondition.RUSAK.value,
            completeness="Adaptor ada",
            notes="Layar retak akibat terbentur",
        )
        session.add(ret_item)
        session.flush()

        # Update Asset DIPINJAM -> RUSAK
        asset = session.get(Asset, 1)
        old_status = asset.status
        asset.status = AssetStatus.RUSAK.value

        session.add(
            AssetHistory(
                asset_id=asset.id,
                changed_by=1,
                event_type="RETURN_DAMAGED",
                old_status=old_status,
                new_status=asset.status,
                reason="Layar retak saat peminjaman TX-2026-0001",
            )
        )

        damage = DamageReport(
            return_item_id=ret_item.id,
            reported_by=1,
            severity=DamageSeverity.SEDANG.value,
            description="LCD retak bagian pojok",
            repair_status=RepairStatus.DILAPORKAN.value,
            repair_cost=Decimal("750000.00"),
            reported_at=now + timedelta(days=2),
        )
        session.add(damage)

        # Mark borrowing returned if all items returned
        tx = session.get(Borrowing, 1)
        tx.status = BorrowingStatus.DIKEMBALIKAN.value

        session.commit()
        print("[8] Return and DamageReport committed.")
        print(f"    - Return Item final condition: {ret_item.final_condition}")
        print(f"    - Asset status: {asset.status}")
        print(f"    - Repair cost: Rp {damage.repair_cost:,.2f}")

    # 9. Test ON DELETE RESTRICT on Borrower with transaction history
    with SessionLocal() as session:
        try:
            b = session.get(Borrower, 1)
            session.delete(b)
            session.commit()
            raise RuntimeError("ON DELETE RESTRICT on borrower failed!")
        except (IntegrityError, OperationalError, DBAPIError):
            print("[9] ON DELETE RESTRICT confirmed: Borrower cannot be deleted while transaction exists.")

    # 10. Test ON DELETE RESTRICT on Asset with transaction history
    with SessionLocal() as session:
        try:
            a = session.get(Asset, 1)
            session.delete(a)
            session.commit()
            raise RuntimeError("ON DELETE RESTRICT on asset failed!")
        except (IntegrityError, OperationalError, DBAPIError):
            print("[10] ON DELETE RESTRICT confirmed: Asset cannot be deleted while transaction history exists.")

    # 11. System Settings & Auth Tokens
    with SessionLocal() as session:
        setting = SystemSetting(
            key="smtp.host",
            value="smtp.gmail.com",
            value_type="STRING",
            is_secret=False,
            description="SMTP Server Host",
            updated_by=1,
        )
        session.add(setting)

        token = RefreshToken(
            user_id=1,
            token_hash="b" * 64,
            expires_at=now + timedelta(days=7),
        )
        session.add(token)

        ext_id = ExternalIdentity(
            user_id=1,
            provider="google",
            provider_subject="google-sub-98765",
            email="petugas1@siipb.sch.id",
        )
        session.add(ext_id)
        session.commit()
        print("[11] SystemSetting, RefreshToken, and ExternalIdentity verified.")

    # 12. Final verification of all 26 tables
    with SessionLocal() as session:
        counts = {}
        for table in Base.metadata.sorted_tables:
            res = session.execute(text(f"SELECT COUNT(*) FROM `{table.name}`;"))
            counts[table.name] = res.scalar()
        print(f"\n[12] Verified all {len(counts)} tables queryable in MariaDB:")
        for tname, cnt in sorted(counts.items()):
            print(f"    - {tname:<25}: {cnt} rows")

    print("\n=======================================================")
    print(">>> ALL 12 VERIFICATION SUITES PASSED FLAWLESSLY! <<<")
    print("=======================================================")


if __name__ == "__main__":
    run_checks()
