"""Skrip Pembuktian Mengapa NotificationEvent Tidak Boleh Digabung dengan Notification.

Jalankan dengan:
    python scripts/demo_notification_proof.py
"""
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import (
    Borrowing,
    Notification,
    NotificationEvent,
    NotificationEventCode,
    NotificationEventStatus,
    NotificationStatus,
)


def run_proof():
    print("=" * 65)
    print("DEMO PEMBUKTIAN ARSITEKTUR NOTIFIKASI DI SIIPB")
    print("=" * 65)

    with SessionLocal() as session:
        borrowing = session.scalars(select(Borrowing)).first()
        if not borrowing:
            print("[INFO] Tidak ada data peminjaman di DB untuk dites.")
            return

        print(f"\n[Fakta 1] Ada Transaksi Peminjaman: ID #{borrowing.id} ({borrowing.transaction_number})")
        print(f"          Peminjam: {borrowing.borrower.name if borrowing.borrower else '-'}")

        # -------------------------------------------------------------
        # SKENARIO A: DESAIN SAAT INI (TERPISAH)
        # 1 Event -> 3 Notifikasi ke Penerima Berbeda
        # -------------------------------------------------------------
        print("\n" + "-" * 65)
        print("SKENARIO A: DENGAN PEMISAHAN (Event terpisah dari Notification)")
        print("-" * 65)

        test_event_code = "TEST_ESCALATION_H3"

        # Bersihkan data tes sebelumnya jika ada
        old_ev = session.scalars(
            select(NotificationEvent).where(
                NotificationEvent.borrowing_id == borrowing.id,
                NotificationEvent.event_code == test_event_code,
            )
        ).first()
        if old_ev:
            for n in old_ev.notifications:
                session.delete(n)
            session.delete(old_ev)
            session.commit()

        # 1. Catat Event Tunggal
        event = NotificationEvent(
            borrowing_id=borrowing.id,
            event_code=test_event_code,
            scheduled_at=datetime.now(),
            status=NotificationEventStatus.PROCESSED.value,
        )
        session.add(event)
        session.flush()
        print(f"1. Event dibuat: ID #{event.id} [Code: {test_event_code}] (UNIQUE per transaksi)")

        # 2. Buat 3 Notifikasi Berbeda untuk 3 Orang dari 1 Event yang sama
        recipients = [
            ("PEMINJAM", "peminjam@gmail.com", "Peringatan: Barang belum kembali"),
            ("PETUGAS", "sarpras@siipb.local", "Monitoring: Peminjaman terlambat"),
            ("PIMPINAN", "pimpinan@siipb.local", "Eskalasi: Perlu tindakan pimpinan"),
        ]

        created_notifs = []
        for r_type, r_email, sub in recipients:
            n = Notification(
                event_id=event.id,
                borrower_id=borrowing.borrower_id,
                template_id=1,
                channel="EMAIL",
                recipient=r_email,
                recipient_type=r_type,
                subject=sub,
                status=NotificationStatus.QUEUED.value,
            )
            session.add(n)
            created_notifs.append(n)

        session.commit()
        print(f"2. Berhasil membuat {len(created_notifs)} notifikasi dari 1 event:")
        for cn in created_notifs:
            print(f"   -> [ID #{cn.id}] Penerima: {cn.recipient_type:8} ({cn.recipient})")

        # 3. Uji Idempotensi (Mencegah Spam)
        print("\n3. Uji Idempotensi: Scheduler berjalan lagi untuk event yang sama:")
        try:
            duplicate_event = NotificationEvent(
                borrowing_id=borrowing.id,
                event_code=test_event_code,
                scheduled_at=datetime.now(),
                status=NotificationEventStatus.PENDING.value,
            )
            session.add(duplicate_event)
            session.commit()
            print("   [GAGAL] Sistem mengizinkan event ganda!")
        except IntegrityError:
            session.rollback()
            print("   [BERHASIL DICEGAH] Database menolak event ganda (UniqueConstraint aktif).")
            print("   -> Hasil: Peminjam TIDAK akan menerima email ganda (Anti-Spam Terbukti).")

        # -------------------------------------------------------------
        # SKENARIO B: SIMULASI JIKA DIGABUNG KE SATU TABEL
        # -------------------------------------------------------------
        print("\n" + "-" * 65)
        print("SKENARIO B: KONTRAKDIKSI JIKA KEDUANYA DIGABUNG")
        print("-" * 65)
        print("Jika tabel digabung dan diberi UNIQUE(borrowing_id, event_code):")
        print("  - Pesan ke-1 (Peminjam): BERHASIL disimpan.")
        print("  - Pesan ke-2 (Petugas) : GAGAL disimpan (terkena Duplicate Key Error)!")
        print("  - Pesan ke-3 (Pimpinan): GAGAL disimpan (terkena Duplicate Key Error)!")
        print("\nJika constraint UNIQUE(borrowing_id, event_code) DICOPOT agar 3 pesan bisa masuk:")
        print("  - Setiap kali scheduler berjalan, 3 pesan baru akan terus terbuat.")
        print("  - Dalam 1 hari jika cron jalan 10 kali = 30 email terkirim ke peminjam (SPAM!).")
        print("=" * 65)

        # Bersihkan kembali data tes
        if event:
            for n in event.notifications:
                session.delete(n)
            session.delete(event)
            session.commit()


if __name__ == "__main__":
    run_proof()
