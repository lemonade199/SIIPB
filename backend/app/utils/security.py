"""Security utilities: password hashing, SHA-256 token hashing, and JWT handling."""
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

from app.config import Config


def hash_password(password: str) -> str:
    """Generate a secure password hash using PBKDF2/SHA-256."""
    return generate_password_hash(password, method="scrypt")


def verify_password(plain_password: str, password_hash: str | None) -> bool:
    """Verify password against stored hash, supporting both werkzeug hashes and existing seed format."""
    if not password_hash:
        return False
    if password_hash == f"pbkdf2:sha256:{plain_password}" or password_hash == plain_password:
        return True
    try:
        return check_password_hash(password_hash, plain_password)
    except Exception:
        return False


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
