"""Penyimpanan berkas unggahan (lokal; jalur /uploads/... dilayani Nginx/Flask).

Keamanan (dokumen Plan §13): ukuran dibatasi, ekstensi DAN isi berkas (magic bytes) diperiksa,
nama berkas diganti UUID sehingga tidak ada path traversal.
"""
import uuid
from pathlib import Path

from app.config import Config

IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | {"pdf"}
SAFE_FOLDERS = {"assets", "evidence", "documents"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _sniff(head: bytes) -> str | None:
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if head.startswith(b"%PDF-"):
        return "pdf"
    return None


def save_upload_file(file_storage, folder_prefix: str = "assets", images_only: bool = False, max_mb: int | None = None) -> str:
    if not file_storage or not file_storage.filename:
        raise ValueError("File tidak valid atau kosong")
    if folder_prefix not in SAFE_FOLDERS:
        folder_prefix = "evidence"
    allowed = IMAGE_EXTENSIONS if images_only else ALLOWED_EXTENSIONS
    ext = file_storage.filename.rsplit(".", 1)[-1].lower() if "." in file_storage.filename else ""
    if ext not in allowed:
        raise ValueError("Tipe file tidak diizinkan. Gunakan " + ", ".join(sorted(e.upper() for e in allowed)))

    data = file_storage.read()
    limit = (max_mb or Config.MAX_UPLOAD_MB) * 1024 * 1024
    if len(data) > limit:
        raise ValueError(f"Ukuran file melebihi {max_mb or Config.MAX_UPLOAD_MB} MB")
    kind = _sniff(data[:16])
    if kind is None or kind != ("jpg" if ext == "jpeg" else ext):
        raise ValueError("Isi file tidak sesuai dengan tipenya")

    upload_dir = Path(Config.UPLOAD_FOLDER) / folder_prefix
    upload_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{'jpg' if kind == 'jpg' else kind}"
    (upload_dir / name).write_bytes(data)
    return f"/uploads/{folder_prefix}/{name}"
