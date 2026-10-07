"""Security utilities: password hashing, SHA-256 token hashing, and JWT handling."""
import hashlib
import hmac
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

from app.config import Config


def hash_password(password: str) -> str:
    """Hash kata sandi (scrypt, werkzeug)."""
    return generate_password_hash(password, method="scrypt")


def verify_password(plain_password: str, password_hash: str | None) -> bool:
    """Verifikasi kata sandi terhadap hash werkzeug (scrypt/pbkdf2).

    Kompatibilitas: data awal lama menyimpan ``pbkdf2:sha256:<plain>`` (bukan hash). Format itu masih
    diterima satu kali lalu langsung di-hash ulang saat login (lihat :func:`needs_rehash`).
    """
    if not password_hash or not plain_password:
        return False
    if is_legacy_plain_hash(password_hash):
        return hmac.compare_digest(password_hash, f"pbkdf2:sha256:{plain_password}")
    try:
        return check_password_hash(password_hash, plain_password)
    except Exception:
        return False


def is_legacy_plain_hash(password_hash: str) -> bool:
    # hash werkzeug asli berformat "method$salt$hash"
    return password_hash.startswith("pbkdf2:sha256:") and "$" not in password_hash


def needs_rehash(password_hash: str | None) -> bool:
    return bool(password_hash) and (is_legacy_plain_hash(password_hash) or not password_hash.startswith("scrypt:"))


def validate_password_strength(password: str) -> str | None:
    """Kebijakan minimum: 8 karakter, mengandung huruf dan angka."""
    if len(password or "") < 8:
        return "Kata sandi minimal 8 karakter."
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return "Kata sandi harus mengandung huruf dan angka."
    return None


def hash_token(raw_token: str) -> str:
    """Hash a token using SHA-256 for secure storage in refresh_tokens.token_hash."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> tuple[str, str]:
    """Generate a random cryptographically secure token and its SHA-256 hash.

    Returns:
        (raw_token, token_hash)
    """
    raw_token = secrets.token_urlsafe(64)
    token_hash = hash_token(raw_token)
    return raw_token, token_hash


def create_access_token(
    user_id: int,
    username: str,
    roles: list[str],
    permissions: list[str],
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token containing user identity and permission claims."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=Config.JWT_ACCESS_TTL_MINUTES)

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "username": username,
        "roles": roles,
        "permissions": permissions,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }

    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm=Config.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a JWT access token. Returns payload dict or None if invalid/expired."""
    try:
        payload = jwt.decode(
            token,
            Config.JWT_SECRET_KEY,
            algorithms=[Config.JWT_ALGORITHM],
            options={"require": ["exp", "sub", "username"]},
        )
        if payload.get("type") != "access":
            return None
        return payload
    except (jwt.PyJWTError, Exception):
        return None
