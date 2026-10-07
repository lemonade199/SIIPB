"""Pengaturan sistem, scheduler, dan backup (dokumen Plan modul 11)."""
from datetime import date

from flask import Blueprint, g, request, send_file
from sqlalchemy import select

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required, permission_required, any_permission_required
from app.models import SchedulerRun
from app.services.audit_service import record_audit
from app.services.settings_service import SettingsError, get_settings, update_settings
from app.utils.response import error_response, success_response

settings_bp = Blueprint("settings", __name__, url_prefix="/api/v1")

PUBLIC_KEYS = ("institution", "unit_sarpras", "staff_email", "staff_phone", "return_location", "parameters",
               "checkout_notify", "return_notify", "rules", "scheduler")


@settings_bp.get("/settings")
@jwt_required
def settings_show():
    """Pengaturan aplikasi. Pengguna tanpa izin `settings.manage` hanya menerima bagian umum.
    ---
    tags: [Settings]
    security: [{Bearer: []}]
    responses:
      200: {description: Pengaturan}
    """
    from app.middleware.auth_middleware import has_permission

    with SessionLocal() as session:
        data = get_settings(session)
        if not has_permission("settings.manage"):
            data = {k: data[k] for k in PUBLIC_KEYS if k in data}
            data["security"] = {"oidc_enabled": get_settings(session)["security"].get("oidc_enabled", False)}
        return success_response(data=data)


@settings_bp.get("/settings/public")
def settings_public():
    """Info publik untuk halaman login (nama instansi, SSO aktif).
    ---
    tags: [Settings]
    responses:
      200: {description: Info publik}
    """
    with SessionLocal() as session:
        s = get_settings(session)
        return success_response(data={
            "institution": s["institution"],
            "unit_sarpras": s["unit_sarpras"],
            "oidc_enabled": bool(s["security"].get("oidc_enabled")),
        })


@settings_bp.put("/settings")
@permission_required("settings.manage")
def settings_update():
    """Simpan pengaturan (sebagian). `smtp.password` disimpan terenkripsi dan tidak pernah dikembalikan.
    ---
    tags: [Settings]
    security: [{Bearer: []}]
    responses:
      200: {description: Pengaturan disimpan}
    """
    with SessionLocal() as session:
        try:
            data = update_settings(session, request.get_json(silent=True) or {}, g.current_user["id"])
        except SettingsError as e:
            return error_response(str(e), error_code="VALIDATION_ERROR", errors=e.errors)
        return success_response(data=data, message="Pengaturan disimpan")


@settings_bp.post("/settings/smtp/test")
@permission_required("settings.manage")
def smtp_test():
    """Uji koneksi & login SMTP dengan konfigurasi tersimpan.
    ---
    tags: [Settings]
    security: [{Bearer: []}]
    responses:
      200: {description: Hasil uji}
    """
    import smtplib
    import ssl

    from app.services.settings_service import smtp_config

    with SessionLocal() as session:
        cfg = smtp_config(session)
    if not cfg["username"] or not cfg["password"]:
        return success_response(data={"ok": True, "mode": "simulasi"},
                                message="Kredensial SMTP belum diisi — email disimulasikan (mode pengembangan).")
    try:
        if cfg["encryption"] in ("SSL", "SSL/TLS"):
            server = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=15, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=15)
        with server:
            if cfg["encryption"] == "STARTTLS":
                server.starttls(context=ssl.create_default_context())
            server.login(cfg["username"], cfg["password"])
        return success_response(data={"ok": True, "mode": "smtp"}, message=f"Terhubung ke {cfg['host']}:{cfg['port']}")
    except Exception as exc:  # noqa: BLE001
        return error_response(f"Koneksi SMTP gagal: {exc}", error_code="SMTP_FAILED")


# ---------------------------------------------------------------- scheduler
@settings_bp.post("/scheduler/run")
@permission_required("notification.manage")
def scheduler_run():
    """Jalankan pemeriksaan jatuh tempo sekarang (sama dengan Celery Beat). Idempoten.
    ---
    tags: [Scheduler]
    security: [{Bearer: []}]
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            date: {type: string, format: date, description: "Tanggal pemeriksaan (bawaan hari ini; hanya untuk uji/UAT)"}
    responses:
      200: {description: Hasil pemeriksaan}
    """
    from app.services.scheduler_service import run_due_check, serialize_run

    body = request.get_json(silent=True) or {}
    run_date = None
    if body.get("date"):
        try:
            run_date = date.fromisoformat(body["date"])
        except ValueError:
            return error_response("Format tanggal YYYY-MM-DD", error_code="VALIDATION_ERROR")
    with SessionLocal() as session:
        run = run_due_check(session, run_date=run_date, trigger="MANUAL", user_id=g.current_user["id"])
        return success_response(data=serialize_run(run), message=(
            f"Pemeriksaan selesai: {run.checked} transaksi, {run.late_marked} ditandai terlambat, "
            f"{run.sent} email terkirim, {run.skipped} dilewati, {run.failed} gagal."
        ))


@settings_bp.get("/scheduler/runs")
@any_permission_required("notification.view", "notification.manage")
def scheduler_runs():
    """Riwayat pemeriksaan scheduler.
    ---
    tags: [Scheduler]
    security: [{Bearer: []}]
    responses:
      200: {description: Riwayat}
    """
    from app.services.scheduler_service import serialize_run

    limit = min(200, request.args.get("limit", 50, type=int))
    with SessionLocal() as session:
        runs = session.scalars(select(SchedulerRun).order_by(SchedulerRun.id.desc()).limit(limit)).all()
        return success_response(data=[serialize_run(r) for r in runs])


# ---------------------------------------------------------------- backup
@settings_bp.get("/backups")
@permission_required("settings.manage")
def backups_index():
    """Daftar berkas backup database.
    ---
    tags: [Backup]
    security: [{Bearer: []}]
    responses:
      200: {description: Daftar backup}
    """
    from app.services.backup_service import list_backups

    return success_response(data=list_backups())


@settings_bp.post("/backups")
@permission_required("settings.manage")
def backups_create():
    """Buat backup database sekarang (mysqldump, gzip).
    ---
    tags: [Backup]
    security: [{Bearer: []}]
    responses:
      200: {description: Hasil backup}
    """
    from app.services.backup_service import run_backup

    with SessionLocal() as session:
        entry = run_backup(session, by=g.current_user["username"], kind="Manual")
        record_audit(session, "BACKUP", "settings", "backup", None, g.current_user["id"], new_data=entry)
        session.commit()
        if entry["status"] != "SUKSES":
            return error_response(f"Backup gagal: {entry.get('error')}", error_code="BACKUP_FAILED", errors=entry)
        return success_response(data=entry, message=f"Backup {entry['file']} dibuat ({entry['size_kb']} KB)")


@settings_bp.get("/backups/<name>")
@permission_required("settings.manage")
def backups_download(name: str):
    """Unduh berkas backup.
    ---
    tags: [Backup]
    security: [{Bearer: []}]
    responses:
      200: {description: Berkas .sql.gz}
    """
    from app.services.backup_service import backup_path

    p = backup_path(name)
    if not p:
        return error_response("Berkas backup tidak ditemukan", error_code="NOT_FOUND", status_code=404)
    with SessionLocal() as session:
        record_audit(session, "DOWNLOAD", "settings", "backup", None, g.current_user["id"], new_data={"file": name})
        session.commit()
    return send_file(p, as_attachment=True, download_name=name, mimetype="application/gzip")
