"""Backup database MariaDB (PB-017). Pemulihan dilakukan lewat skrip `scripts/restore_db.sh`
agar tidak dapat dipicu dari antarmuka web."""
from __future__ import annotations

import gzip
import os
import re
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

from sqlalchemy.orm import Session

from app.config import Config
from app.services.settings_service import append_backup_history, get_settings

NAME_RE = re.compile(r"^siipb-\d{8}-\d{6}\.sql\.gz$")


def _db_params() -> dict[str, str]:
    u = urlparse(Config.DATABASE_URL.replace("mariadb+pymysql", "mysql").replace("mysql+pymysql", "mysql"))
    return {
        "host": u.hostname or "127.0.0.1",
        "port": str(u.port or 3306),
        "user": unquote(u.username or "root"),
        "password": unquote(u.password or ""),
        "database": (u.path or "/siipb").lstrip("/"),
    }


def backup_dir() -> Path:
    p = Path(Config.BACKUP_FOLDER)
    p.mkdir(parents=True, exist_ok=True)
    return p


def list_backups() -> list[dict]:
    out = []
    for f in sorted(backup_dir().glob("siipb-*.sql.gz"), reverse=True):
        st = f.stat()
        out.append({"file": f.name, "size_kb": round(st.st_size / 1024), "created_at": datetime.fromtimestamp(st.st_mtime).isoformat()})
    return out


def backup_path(name: str) -> Path | None:
    if not NAME_RE.match(name):
        return None
    p = backup_dir() / name
    return p if p.exists() else None


def run_backup(session: Session, by: str = "system", kind: str = "Manual") -> dict:
    dump = shutil.which("mariadb-dump") or shutil.which("mysqldump")
    now = datetime.now()
    name = f"siipb-{now:%Y%m%d-%H%M%S}.sql.gz"
    entry = {"at": now.isoformat(timespec="seconds"), "type": kind, "size_kb": 0, "status": "GAGAL", "by": by, "file": name}
    if not dump:
        entry["error"] = "mysqldump/mariadb-dump tidak tersedia di server"
        append_backup_history(session, entry)
        session.commit()
        return entry
    p = _db_params()
    env = {**os.environ, "MYSQL_PWD": p["password"]}  # tidak muncul di daftar proses
    cmd = [dump, "-h", p["host"], "-P", p["port"], "-u", p["user"], "--single-transaction", "--quick", "--no-tablespaces",
           "--routines", "--triggers", "--skip-lock-tables", p["database"]]
    target = backup_dir() / name
    try:
        proc = subprocess.run(cmd, env=env, capture_output=True, timeout=600, check=False)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.decode("utf-8", "ignore")[:300] or f"exit {proc.returncode}")
        with gzip.open(target, "wb") as gz:
            gz.write(proc.stdout)
        entry["size_kb"] = round(target.stat().st_size / 1024)
        entry["status"] = "SUKSES"
    except Exception as exc:  # noqa: BLE001
        entry["error"] = str(exc)
        target.unlink(missing_ok=True)

    # retensi
    days = int(get_settings(session)["backup"].get("retention_days") or 14)
    limit = now - timedelta(days=days)
    for f in backup_dir().glob("siipb-*.sql.gz"):
        if datetime.fromtimestamp(f.stat().st_mtime) < limit:
            f.unlink(missing_ok=True)

    append_backup_history(session, entry)
    session.commit()
    return entry
