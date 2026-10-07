"""fullstack plan features: draft borrowing, item photos, notification recipients/reads,
scheduler runs, unified RBAC permission codes, Indonesian notification templates.

Revision ID: a7c3e91d2b40
Revises: f627cba678a2
Create Date: 2026-10-07 08:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "a7c3e91d2b40"
down_revision: Union[str, Sequence[str], None] = "f627cba678a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BIGU = mysql.BIGINT(unsigned=True)
DT6 = mysql.DATETIME(fsp=6)
TS6 = sa.text("CURRENT_TIMESTAMP(6)")
OPTS = dict(mysql_charset="utf8mb4", mysql_collate="utf8mb4_unicode_ci", mysql_engine="InnoDB")

# ---------------------------------------------------------------------------
# RBAC: kode permission diseragamkan dengan antarmuka (frontend/lib/constants.ts)
# ---------------------------------------------------------------------------
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
LEGACY_MAP = {
    "asset.view": ["dashboard.view", "inventory.view", "borrowing.view", "monitoring.view", "notification.view"],
    "asset.create": ["inventory.manage", "masterdata.manage", "qr.manage"],
    "asset.update": ["inventory.manage", "qr.manage"],
    "asset.delete": ["inventory.manage"],
    "borrowing.create": ["borrowing.view", "borrowing.manage", "masterdata.manage", "monitoring.view"],
    "borrowing.return": ["borrowing.view", "return.manage", "monitoring.view"],
    "report.view": ["report.view", "report.export", "dashboard.view"],
    "user.manage": ["users.manage"],
    "settings.manage": ["settings.manage", "notification.manage", "notification.view"],
    "audit.view": ["audit.view"],
    "audit.read": ["audit.view"],
    "damage.update": ["return.manage"],
}
ROLE_DEFAULTS = {
    "SARPRAS": ["dashboard.view", "inventory.view", "inventory.manage", "masterdata.manage", "borrowing.view",
                "borrowing.manage", "return.manage", "monitoring.view", "notification.view", "notification.manage",
                "qr.manage", "report.view", "report.export"],
    "PIMPINAN": ["dashboard.view", "inventory.view", "borrowing.view", "monitoring.view", "notification.view",
                 "report.view", "report.export"],
}

FOOT = (
    "\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}"
    "\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, "
    "atau membalas email ini."
)
TEMPLATES = [
    ("LOAN_CONFIRMATION", "Konfirmasi peminjaman",
     "[SIIPB] Peminjaman {{kode_transaksi}} — kembalikan paling lambat {{batas_kembali}}",
     "Yth. {{nama_peminjam}},\n\nPetugas Sarpras/IT telah mencatat peminjaman barang atas nama Anda:\n\n"
     "{{daftar_barang}}\n\nTanggal peminjaman : {{tanggal_pinjam}}\nBatas pengembalian : {{batas_kembali}}\n"
     "Tujuan             : {{tujuan}}\n\nMohon kembalikan barang sebelum batas waktu. Kondisi dan kelengkapan "
     "barang akan diperiksa saat pengembalian." + FOOT),
    ("H_MINUS_3", "Pengingat H-3", "[SIIPB] Pengingat: batas pengembalian {{kode_transaksi}} tinggal 3 hari",
     "Yth. {{nama_peminjam}},\n\nBarang berikut harus dikembalikan paling lambat {{batas_kembali}} (3 hari lagi):"
     "\n\n{{daftar_barang}}" + FOOT),
    ("H_MINUS_1", "Pengingat H-1", "[SIIPB] Besok batas pengembalian {{kode_transaksi}}",
     "Yth. {{nama_peminjam}},\n\nBesok, {{batas_kembali}}, adalah batas pengembalian barang berikut:\n\n"
     "{{daftar_barang}}" + FOOT),
    ("H_DAY", "Hari ini jatuh tempo", "[SIIPB] Hari ini batas pengembalian {{kode_transaksi}}",
     "Yth. {{nama_peminjam}},\n\nHari ini, {{batas_kembali}}, adalah batas pengembalian barang berikut:\n\n"
     "{{daftar_barang}}\n\nMohon diserahkan ke petugas hari ini." + FOOT),
    ("H_PLUS_1", "Terlambat H+1", "[SIIPB] Peminjaman {{kode_transaksi}} terlambat {{hari_terlambat}} hari",
     "Yth. {{nama_peminjam}},\n\nBatas pengembalian barang berikut telah lewat ({{batas_kembali}}). Saat ini "
     "terlambat {{hari_terlambat}} hari:\n\n{{daftar_barang}}\n\nMohon segera mengembalikan barang." + FOOT),
    ("H_PLUS_3", "Eskalasi H+3", "[SIIPB] ESKALASI: {{kode_transaksi}} terlambat {{hari_terlambat}} hari",
     "Yth. {{nama_peminjam}},\n(tembusan: Petugas Sarpras/IT)\n\nPeminjaman {{kode_transaksi}} telah terlambat "
     "{{hari_terlambat}} hari dari batas {{batas_kembali}}:\n\n{{daftar_barang}}\n\nPetugas akan menindaklanjuti "
     "keterlambatan ini." + FOOT),
    ("H_PLUS_7", "Eskalasi lanjutan H+7",
     "[SIIPB] ESKALASI LANJUTAN: {{kode_transaksi}} terlambat {{hari_terlambat}} hari",
     "Yth. {{nama_peminjam}},\n(tembusan: Petugas Sarpras/IT dan Pimpinan)\n\nPeminjaman {{kode_transaksi}} telah "
     "terlambat {{hari_terlambat}} hari dari batas {{batas_kembali}}:\n\n{{daftar_barang}}\n\nKeterlambatan ini "
     "telah dilaporkan kepada pimpinan unit." + FOOT),
    ("RETURN_CONFIRMATION", "Konfirmasi pengembalian", "[SIIPB] Pengembalian {{kode_transaksi}} telah diterima",
     "Yth. {{nama_peminjam}},\n\nPetugas telah menerima pengembalian barang berikut pada {{tanggal_kembali}}:\n\n"
     "{{daftar_barang_kembali}}\n\nTerima kasih." + FOOT),
]


def _data_upgrade() -> None:
    conn = op.get_bind()

    # --- permissions ---
    existing = {code: pid for pid, code in conn.execute(sa.text("SELECT id, code FROM permissions"))}
    for code, name, module in PERMISSIONS:
        if code in existing:
            conn.execute(sa.text("UPDATE permissions SET name=:n, module=:m WHERE code=:c"), dict(n=name, m=module, c=code))
        else:
            conn.execute(sa.text("INSERT INTO permissions (code, name, module) VALUES (:c, :n, :m)"), dict(c=code, n=name, m=module))
    perm_id = {code: pid for pid, code in conn.execute(sa.text("SELECT id, code FROM permissions"))}
    new_codes = {c for c, _, _ in PERMISSIONS}

    # map legacy grants to the unified codes
    rows = conn.execute(sa.text(
        "SELECT rp.role_id, p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id"
    )).fetchall()
    grants = {(rid, code) for rid, code in rows if code in new_codes}
    for rid, code in rows:
        for nc in LEGACY_MAP.get(code, []):
            grants.add((rid, nc))
    roles = {code: rid for rid, code in conn.execute(sa.text("SELECT id, code FROM roles"))}
    for rcode, codes in ROLE_DEFAULTS.items():
        if rcode in roles:
            grants.update((roles[rcode], c) for c in codes)
    if "ADMIN" in roles:
        grants.update((roles["ADMIN"], c) for c in new_codes)

    conn.execute(sa.text("DELETE FROM role_permissions"))
    for rid, code in sorted(grants):
        conn.execute(sa.text("INSERT INTO role_permissions (role_id, permission_id) VALUES (:r, :p)"),
                     dict(r=rid, p=perm_id[code]))
    legacy = [pid for code, pid in perm_id.items() if code not in new_codes]
    for pid in legacy:
        conn.execute(sa.text("DELETE FROM permissions WHERE id=:p"), dict(p=pid))

    # --- templates (upsert by code; keep custom edits only when already in new {{var}} style) ---
    for code, name, subject, body in TEMPLATES:
        row = conn.execute(sa.text("SELECT id, body FROM notification_templates WHERE code=:c"), dict(c=code)).first()
        if row is None:
            conn.execute(sa.text(
                "INSERT INTO notification_templates (code, name, subject, body) VALUES (:c, :n, :s, :b)"
            ), dict(c=code, n=name, s=subject, b=body))
        elif "{{" not in (row[1] or ""):
            conn.execute(sa.text(
                "UPDATE notification_templates SET name=:n, subject=:s, body=:b WHERE id=:i"
            ), dict(n=name, s=subject, b=body, i=row[0]))

    # --- existing borrowings were checked out at creation ---
    conn.execute(sa.text(
        "UPDATE borrowings SET checked_out_at = borrowed_at, checked_out_by = handled_by "
        "WHERE checked_out_at IS NULL AND status <> 'DRAF'"
    ))
    conn.execute(sa.text("UPDATE borrowing_items SET condition_out = 'BAIK' WHERE condition_out IS NULL"))
    conn.execute(sa.text(
        "INSERT INTO asset_photos (asset_id, path, sort_order) "
        "SELECT id, photo_path, 0 FROM assets WHERE photo_path IS NOT NULL AND photo_path <> ''"
    ))


def upgrade() -> None:
    # assets / item_photos
    op.add_column("assets", sa.Column("acquisition_source", sa.String(150), nullable=True))
    op.create_table(
        "asset_photos",
        sa.Column("id", BIGU, autoincrement=True, nullable=False),
        sa.Column("asset_id", BIGU, nullable=False),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", DT6, server_default=TS6, nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], name="fk_asset_photos_asset_id_assets", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_asset_photos"),
        **OPTS,
    )
    op.create_index("ix_asset_photos_asset_id", "asset_photos", ["asset_id"])

    # users
    op.add_column("users", sa.Column("phone", sa.String(30), nullable=True))

    # borrowings: draft & checkout
    op.drop_constraint(op.f("ck_borrowings_status"), "borrowings", type_="check")
    op.create_check_constraint(
        op.f("ck_borrowings_status"), "borrowings",
        "`status` IN ('DRAF', 'AKTIF', 'TERLAMBAT', 'DIKEMBALIKAN', 'DIBATALKAN')",
    )
    op.add_column("borrowings", sa.Column("checked_out_at", DT6, nullable=True))
    op.add_column("borrowings", sa.Column("checked_out_by", BIGU, nullable=True))
    op.add_column("borrowings", sa.Column("cancelled_at", DT6, nullable=True))
    op.add_column("borrowings", sa.Column("cancel_reason", sa.Text(), nullable=True))
    op.create_index("ix_borrowings_checked_out_by", "borrowings", ["checked_out_by"])
    op.create_foreign_key("fk_borrowings_checked_out_by_users", "borrowings", "users", ["checked_out_by"], ["id"], ondelete="SET NULL")
    op.alter_column("borrowing_items", "checked_out_at", existing_type=DT6, nullable=True)
    op.add_column("borrowing_items", sa.Column("condition_out", sa.String(20), nullable=True))

    # return items
    op.add_column("return_items", sa.Column("asset_status_after", sa.String(30), nullable=True))

    # notifications: recipients & reads
    op.add_column("notifications", sa.Column("recipient_name", sa.String(150), nullable=True))
    op.add_column("notifications", sa.Column("recipient_type", sa.String(20), server_default=sa.text("'PEMINJAM'"), nullable=False))
    op.add_column("notifications", sa.Column("recipient_user_id", BIGU, nullable=True))
    op.create_index("ix_notifications_recipient_user_id", "notifications", ["recipient_user_id"])
    op.create_foreign_key("fk_notifications_recipient_user_id_users", "notifications", "users", ["recipient_user_id"], ["id"], ondelete="SET NULL")
    op.create_check_constraint(
        op.f("ck_notifications_recipient_type"), "notifications",
        "`recipient_type` IN ('PEMINJAM', 'PETUGAS', 'PIMPINAN')",
    )
    op.create_table(
        "notification_reads",
        sa.Column("notification_id", BIGU, nullable=False),
        sa.Column("user_id", BIGU, nullable=False),
        sa.Column("read_at", DT6, server_default=TS6, nullable=False),
        sa.ForeignKeyConstraint(["notification_id"], ["notifications.id"], name="fk_notification_reads_notification_id_notifications", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_notification_reads_user_id_users", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("notification_id", "user_id", name="pk_notification_reads"),
        **OPTS,
    )
    op.create_index("ix_notification_reads_user_id", "notification_reads", ["user_id"])

    # scheduler runs
    op.create_table(
        "scheduler_runs",
        sa.Column("id", BIGU, autoincrement=True, nullable=False),
        sa.Column("run_date", sa.Date(), nullable=False),
        sa.Column("trigger", sa.String(30), nullable=False),
        sa.Column("triggered_by", BIGU, nullable=True),
        sa.Column("checked", sa.Integer(), nullable=False),
        sa.Column("late_marked", sa.Integer(), nullable=False),
        sa.Column("sent", sa.Integer(), nullable=False),
        sa.Column("skipped", sa.Integer(), nullable=False),
        sa.Column("failed", sa.Integer(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", DT6, server_default=TS6, nullable=False),
        sa.ForeignKeyConstraint(["triggered_by"], ["users.id"], name="fk_scheduler_runs_triggered_by_users", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_scheduler_runs"),
        **OPTS,
    )
    op.create_index("ix_scheduler_runs_run_date", "scheduler_runs", ["run_date"])
    op.create_index("ix_scheduler_runs_triggered_by", "scheduler_runs", ["triggered_by"])

    _data_upgrade()


def downgrade() -> None:
    op.drop_table("scheduler_runs")
    op.drop_table("notification_reads")
    op.drop_constraint(op.f("ck_notifications_recipient_type"), "notifications", type_="check")
    op.drop_constraint("fk_notifications_recipient_user_id_users", "notifications", type_="foreignkey")
    op.drop_index("ix_notifications_recipient_user_id", table_name="notifications")
    op.drop_column("notifications", "recipient_user_id")
    op.drop_column("notifications", "recipient_type")
    op.drop_column("notifications", "recipient_name")
    op.drop_column("return_items", "asset_status_after")
    op.drop_column("borrowing_items", "condition_out")
    op.execute("UPDATE borrowing_items SET checked_out_at = created_at WHERE checked_out_at IS NULL")
    op.alter_column("borrowing_items", "checked_out_at", existing_type=DT6, nullable=False)
    op.drop_constraint("fk_borrowings_checked_out_by_users", "borrowings", type_="foreignkey")
    op.drop_index("ix_borrowings_checked_out_by", table_name="borrowings")
    for col in ("cancel_reason", "cancelled_at", "checked_out_by", "checked_out_at"):
        op.drop_column("borrowings", col)
    op.execute("UPDATE borrowings SET status = 'DIBATALKAN' WHERE status = 'DRAF'")
    op.drop_constraint(op.f("ck_borrowings_status"), "borrowings", type_="check")
    op.create_check_constraint(
        op.f("ck_borrowings_status"), "borrowings",
        "`status` IN ('AKTIF', 'TERLAMBAT', 'DIKEMBALIKAN', 'DIBATALKAN')",
    )
    op.drop_column("users", "phone")
    op.drop_table("asset_photos")
    op.drop_column("assets", "acquisition_source")
    # permission/template data changes are not reverted (codes are a superset-compatible rename).
