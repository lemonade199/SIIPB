"""File upload service with MinIO / S3 storage and local filesystem fallback."""
import os
import uuid
from pathlib import Path
from werkzeug.utils import secure_filename

from app.config import Config

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "pdf"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_upload_file(file_storage, folder_prefix: str = "assets") -> str:
    """Save uploaded file to local upload directory or S3/MinIO and return storage relative path."""
    if not file_storage or not file_storage.filename:
        raise ValueError("File tidak valid atau kosong")

    if not allowed_file(file_storage.filename):
        raise ValueError("Ekstensi file tidak diizinkan. Gunakan PNG, JPG, JPEG, WEBP, atau PDF")

    ext = file_storage.filename.rsplit(".", 1)[1].lower()
    unique_filename = f"{uuid.uuid4().hex}.{ext}"

    # Try local storage directory
    upload_dir = Path(Config.UPLOAD_FOLDER) / folder_prefix
    upload_dir.mkdir(parents=True, exist_ok=True)

    dest_path = upload_dir / unique_filename
    file_storage.save(str(dest_path))

    return f"/uploads/{folder_prefix}/{unique_filename}"
