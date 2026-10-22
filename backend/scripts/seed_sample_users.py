"""Script untuk mengisi data user (Admin, Petugas, Pimpinan) ke database SIIPB.

Jalankan dengan:
    python scripts/seed_sample_users.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models import OrganizationalUnit, Role, User
from app.utils.security import hash_password

SAMPLE_USERS = [
    # ==========================
    # 1. ADMINISTRATOR
    # ==========================
    {
        "username": "admin",
        "email": "admin@siipb.local",
        "full_name": "Administrator Utama SIIPB",
        "password": "admin123",
        "role_code": "ADMIN",
        "unit_code": "SARPRAS",
        "phone": "0811-2233-4455",
    },
    {
        "username": "admin.fauzi",
        "email": "ahmad.fauzi@siipb.sch.id",
        "full_name": "Ahmad Fauzi, S.Kom (Admin IT)",
        "password": "admin123",
        "role_code": "ADMIN",
        "unit_code": "SARPRAS",
        "phone": "0812-3456-7890",
    },
    # ==========================
    # 2. PETUGAS SARPRAS / IT
    # ==========================
    {
        "username": "petugas",
        "email": "petugas@siipb.local",
        "full_name": "Budi Santoso (Petugas Sarpras)",
        "password": "petugas123",
        "role_code": "SARPRAS",
        "unit_code": "SARPRAS",
        "phone": "0812-1000-2000",
    },
    {
        "username": "petugas1",
        "email": "petugas1@siipb.sch.id",
        "full_name": "Siti Aminah, A.Md (Staf Sarpras)",
        "password": "petugas123",
        "role_code": "SARPRAS",
        "unit_code": "SARPRAS",
        "phone": "0812-5566-7788",
    },
    {
        "username": "petugas.dewi",
        "email": "dewi.anggraini@siipb.sch.id",
        "full_name": "Dewi Anggraini, A.Md (Staf Inventaris)",
        "password": "petugas123",
        "role_code": "SARPRAS",
        "unit_code": "SARPRAS",
        "phone": "0813-7788-9900",
    },
    {
        "username": "petugas.rizky",
        "email": "rizky.pratama@siipb.sch.id",
        "full_name": "Rizky Pratama (Teknisi Lab & Aset)",
        "password": "petugas123",
        "role_code": "SARPRAS",
        "unit_code": "SARPRAS",
        "phone": "0815-6677-8899",
    },
    # ==========================
    # 3. PIMPINAN
    # ==========================
    {
        "username": "pimpinan",
        "email": "pimpinan@siipb.local",
        "full_name": "Dr. Siti Rahayu, M.Pd (Kepala Instansi)",
        "password": "pimpinan123",
        "role_code": "PIMPINAN",
        "unit_code": "INSTANSI",
        "phone": "0811-9988-7766",
    },
    {
        "username": "pimpinan.bambang",
        "email": "bambang.supriyadi@siipb.sch.id",
        "full_name": "Drs. H. Bambang Supriyadi, M.M (Wakil Pimpinan Sarpras)",
        "password": "pimpinan123",
        "role_code": "PIMPINAN",
        "unit_code": "INSTANSI",
        "phone": "0812-9900-1122",
    },
]


def run():
    with SessionLocal() as session:
        roles = {r.code: r for r in session.query(Role).all()}
        units = {u.code: u for u in session.query(OrganizationalUnit).all()}

        created_count = 0
        updated_count = 0

        for item in SAMPLE_USERS:
            role = roles.get(item["role_code"])
            if not role:
                print(f"[SKIP] Role {item['role_code']} tidak ditemukan di database.")
                continue

            unit = units.get(item["unit_code"])
            user = session.query(User).filter_by(username=item["username"]).first()

            if not user:
                user = User(
                    username=item["username"],
                    email=item["email"],
                    full_name=item["full_name"],
                    password_hash=hash_password(item["password"]),
                    role_id=role.id,
                    unit_id=unit.id if unit else None,
                    phone=item["phone"],
                    is_active=True,
                )
                session.add(user)
                created_count += 1
                print(f"[CREATED] {item['username']} ({role.name}) - Password: {item['password']}")
            else:
                user.email = item["email"]
                user.full_name = item["full_name"]
                user.password_hash = hash_password(item["password"])
                user.role_id = role.id
                if unit:
                    user.unit_id = unit.id
                user.phone = item["phone"]
                user.is_active = True
                updated_count += 1
                print(f"[UPDATED] {item['username']} ({role.name}) - Password: {item['password']}")

        session.commit()
        print(f"\n[SELESAI] Total dibuat: {created_count}, Total diperbarui: {updated_count}")


if __name__ == "__main__":
    run()
