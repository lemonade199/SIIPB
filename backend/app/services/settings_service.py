"""Pengaturan aplikasi (dokumen Plan modul 11: SMTP, template, aturan notifikasi, backup).

Disimpan pada tabel ``system_settings``:
- ``app.settings`` (JSON) — pengaturan umum, SMTP (tanpa kata sandi), scheduler, aturan notifikasi,
  keamanan, backup, parameter status/kondisi.
- ``smtp.password`` (secret) — dienkripsi dengan Fernet (kunci diturunkan dari SECRET_KEY).
"""
from __future__ import annotations

import base64
import copy
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Config
from app.models import SystemSetting
from app.services.audit_service import record_audit

SETTINGS_KEY = "app.settings"
SMTP_PASSWORD_KEY = "smtp.password"

# Kode event aturan (frontend) <-> kode event/template backend.
RULE_EVENTS = {
    "H-3": "H_MINUS_3",
    "H-1": "H_MINUS_1",
    "H": "H_DAY",
    "H+1": "H_PLUS_1",
    "H+3": "H_PLUS_3",
    "H+7": "H_PLUS_7",
}

DEFAULT_SETTINGS: dict[str, Any] = {
    "institution": "Instansi Contoh",
    "unit_sarpras": "Bagian Sarana & Prasarana / IT",
    "staff_email": "sarpras@siipb.local",
    "staff_phone": "ext. 1020",
    "return_location": "Ruang Sarpras, Gedung A Lt. 1",
    "smtp": {
        "host": Config.SMTP_HOST,
        "port": Config.SMTP_PORT,
        "username": Config.SMTP_USERNAME,
        "encryption": "STARTTLS" if Config.SMTP_USE_TLS else "NONE",
        "from_name": Config.SMTP_SENDER_NAME,
        "from_email": Config.SMTP_SENDER_EMAIL,
        "simulate_failure": False,
    },
    "scheduler": {"enabled": True, "time": "08:00", "timezone": Config.CELERY_TIMEZONE, "last_run_date": None},
    "checkout_notify": True,
    "return_notify": True,
    "rules": [
        {"event": "H-3", "days": -3, "active": True, "to": ["peminjam"], "template": "H_MINUS_3", "desc": "Pengingat batas pengembalian"},
        {"event": "H-1", "days": -1, "active": True, "to": ["peminjam"], "template": "H_MINUS_1", "desc": "Pengingat satu hari sebelum jatuh tempo"},
        {"event": "H", "days": 0, "active": True, "to": ["peminjam"], "template": "H_DAY", "desc": "Hari ini batas pengembalian"},
        {"event": "H+1", "days": 1, "active": True, "to": ["peminjam"], "template": "H_PLUS_1", "desc": "Pemberitahuan sudah terlambat"},
        {"event": "H+3", "days": 3, "active": True, "to": ["peminjam", "petugas"], "template": "H_PLUS_3", "desc": "Eskalasi keterlambatan"},
        {"event": "H+7", "days": 7, "active": True, "to": ["peminjam", "petugas", "pimpinan"], "template": "H_PLUS_7", "desc": "Eskalasi lanjutan"},
    ],
    "security": {
        "jwt_access_minutes": Config.JWT_ACCESS_TTL_MINUTES,
        "jwt_refresh_days": Config.JWT_REFRESH_TTL_DAYS,
        "session_hours": 8,
        "oidc_enabled": bool(Config.GOOGLE_CLIENT_ID),
        "oidc_issuer": "https://accounts.google.com",
        "oidc_client_id": Config.GOOGLE_CLIENT_ID,
        "upload_max_mb": 5,
        "upload_types": "JPG, PNG, WEBP",
    },
    "backup": {"schedule": "Harian 01.00 WIB", "retention_days": 14, "history": [], "last_restore_test": ""},
    "parameters": None,  # diisi frontend (label & keterangan status/kondisi)
}

# Kunci yang boleh diubah lewat API (backup.history dikelola server).
EDITABLE = set(DEFAULT_SETTINGS) - {"backup"}


def _fernet() -> Fernet:
    key = hashlib.sha256(Config.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str | None) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""


def _row(session: Session, key: str) -> SystemSetting | None:
    return session.scalars(select(SystemSetting).where(SystemSetting.key == key)).first()


def _merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    for k, v in (patch or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def get_settings(session: Session) -> dict[str, Any]:
    """Pengaturan lengkap (default + tersimpan). Kata sandi SMTP tidak pernah dikembalikan."""
    row = _row(session, SETTINGS_KEY)
    stored: dict[str, Any] = {}
    if row and row.value:
        try:
            stored = json.loads(row.value)
        except ValueError:
            stored = {}
    data = _merge(DEFAULT_SETTINGS, stored)
    # Aturan: pertahankan urutan default & tambahkan event yang belum ada.
    by_event = {r["event"]: r for r in data.get("rules") or []}
    data["rules"] = [
        {**d, **by_event.get(d["event"], {}), "template": RULE_EVENTS[d["event"]]}
        for d in DEFAULT_SETTINGS["rules"]
    ]
    pw = _row(session, SMTP_PASSWORD_KEY)
    data["smtp"]["password_set"] = bool(pw and pw.value) or bool(Config.SMTP_PASSWORD)
    return data


def _validate(patch: dict[str, Any]) -> dict[str, str]:
    errors: dict[str, str] = {}
    smtp = patch.get("smtp") or {}
    if "port" in smtp:
        try:
            port = int(smtp["port"])
            if not 1 <= port <= 65535:
                raise ValueError
        except (TypeError, ValueError):
            errors["smtp.port"] = "Port SMTP harus 1-65535."
    sched = patch.get("scheduler") or {}
    if "time" in sched:
        t = str(sched["time"])
        if len(t) != 5 or t[2] != ":" or not (t[:2].isdigit() and t[3:].isdigit()) or int(t[:2]) > 23 or int(t[3:]) > 59:
            errors["scheduler.time"] = "Format jam HH:MM."
    for r in patch.get("rules") or []:
        if r.get("event") not in RULE_EVENTS:
            errors["rules"] = f"Event aturan tidak dikenal: {r.get('event')}"
        bad = set(r.get("to") or []) - {"peminjam", "petugas", "pimpinan"}
        if bad:
            errors["rules"] = f"Penerima tidak dikenal: {', '.join(sorted(bad))}"
    sec = patch.get("security") or {}
    if "upload_max_mb" in sec:
        try:
            if not 1 <= int(sec["upload_max_mb"]) <= 50:
                raise ValueError
        except (TypeError, ValueError):
            errors["security.upload_max_mb"] = "Batas unggah 1-50 MB."
    return errors


def update_settings(session: Session, patch: dict[str, Any], user_id: int) -> dict[str, Any]:
    patch = {k: v for k, v in (patch or {}).items() if k in EDITABLE}
    errors = _validate(patch)
    if errors:
        raise SettingsError(errors)

    smtp_patch = dict(patch.get("smtp") or {})
    password = smtp_patch.pop("password", None)
    smtp_patch.pop("password_set", None)
    if "smtp" in patch:
        patch["smtp"] = smtp_patch
    if "rules" in patch:
        patch["rules"] = [
            {
                "event": r["event"],
                "days": int(r.get("days", 0)),
                "active": bool(r.get("active", True)),
                "to": list(r.get("to") or ["peminjam"]),
                "desc": str(r.get("desc") or ""),
            }
            for r in patch["rules"]
        ]

    before = get_settings(session)
    row = _row(session, SETTINGS_KEY)
    stored = json.loads(row.value) if row and row.value else {}
    stored = _merge(stored, patch)
    if row is None:
        row = SystemSetting(key=SETTINGS_KEY, value_type="JSON", is_secret=False, description="Pengaturan aplikasi SIIPB")
        session.add(row)
    row.value = json.dumps(stored, ensure_ascii=False)
    row.updated_by = user_id

    if password:
        pw = _row(session, SMTP_PASSWORD_KEY)
        if pw is None:
            pw = SystemSetting(key=SMTP_PASSWORD_KEY, value_type="STRING", is_secret=True, description="Kata sandi SMTP (terenkripsi)")
            session.add(pw)
        pw.value = encrypt_secret(str(password))
        pw.updated_by = user_id

    changed = {k: patch[k] for k in patch if before.get(k) != patch[k]}
    record_audit(
        session, "UPDATE", "settings", "settings", None, user_id,
        old_data={k: before.get(k) for k in changed},
        new_data={**changed, **({"smtp_password": "(diubah)"} if password else {})},
    )
    session.commit()
    return get_settings(session)


def append_backup_history(session: Session, entry: dict[str, Any]) -> None:
    row = _row(session, SETTINGS_KEY)
    stored = json.loads(row.value) if row and row.value else {}
    backup = stored.setdefault("backup", {})
    history = backup.setdefault("history", [])
    history.append(entry)
    backup["history"] = history[-50:]
    if row is None:
        row = SystemSetting(key=SETTINGS_KEY, value_type="JSON", is_secret=False)
        session.add(row)
    row.value = json.dumps(stored, ensure_ascii=False)


def set_last_run_date(session: Session, run_date: str) -> None:
    row = _row(session, SETTINGS_KEY)
    stored = json.loads(row.value) if row and row.value else {}
    stored.setdefault("scheduler", {})["last_run_date"] = run_date
    if row is None:
        row = SystemSetting(key=SETTINGS_KEY, value_type="JSON", is_secret=False)
        session.add(row)
    row.value = json.dumps(stored, ensure_ascii=False)


def smtp_config(session: Session) -> dict[str, Any]:
    """Konfigurasi SMTP efektif untuk worker (pengaturan DB > environment)."""
    s = get_settings(session)["smtp"]
    pw_row = _row(session, SMTP_PASSWORD_KEY)
    password = decrypt_secret(pw_row.value) if pw_row else ""
    return {
        "host": s.get("host") or Config.SMTP_HOST,
        "port": int(s.get("port") or Config.SMTP_PORT),
        "username": s.get("username") or Config.SMTP_USERNAME,
        "password": password or Config.SMTP_PASSWORD,
        "encryption": (s.get("encryption") or "STARTTLS").upper(),
        "from_name": s.get("from_name") or Config.SMTP_SENDER_NAME,
        "from_email": s.get("from_email") or Config.SMTP_SENDER_EMAIL,
        "simulate_failure": bool(s.get("simulate_failure")),
    }


class SettingsError(ValueError):
    def __init__(self, errors: dict[str, str]):
        super().__init__("Validasi pengaturan gagal")
        self.errors = errors
