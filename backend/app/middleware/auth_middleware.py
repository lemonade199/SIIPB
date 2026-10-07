"""Autentikasi (JWT) & otorisasi (RBAC) untuk endpoint API.

Token akses membawa klaim identitas; status akun, role, dan permission dibaca ulang dari database
pada setiap permintaan sehingga penonaktifan akun atau perubahan role berlaku seketika.
"""
from functools import wraps

from flask import g, request

from app.database import SessionLocal
from app.models import User
from app.utils.response import error_response
from app.utils.security import decode_access_token


def _load_identity(payload: dict) -> dict | None:
    with SessionLocal() as session:
        user = session.get(User, int(payload["sub"]))
        if not user or not user.is_active or user.deleted_at is not None:
            return None
        roles = [r.code for r in user.roles if r.is_active]
        return {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "roles": roles,
            "permissions": set(user.permission_codes),
        }


def jwt_required(f):
    """Wajib header ``Authorization: Bearer <access_token>`` yang valid dan akun aktif."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return error_response("Header Authorization wajib disertakan", error_code="UNAUTHORIZED", status_code=401)
        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return error_response("Format Authorization harus: Bearer <token>", error_code="INVALID_TOKEN_FORMAT", status_code=401)
        payload = decode_access_token(parts[1])
        if not payload:
            return error_response("Token akses tidak valid atau sudah kedaluwarsa", error_code="TOKEN_EXPIRED_OR_INVALID", status_code=401)
        identity = _load_identity(payload)
        if identity is None:
            return error_response("Akun tidak aktif atau tidak ditemukan", error_code="ACCOUNT_INACTIVE", status_code=401)
        g.current_user = identity
        return f(*args, **kwargs)

    return decorated_function


def _has(perm: str) -> bool:
    return "ADMIN" in g.current_user.get("roles", []) or perm in g.current_user.get("permissions", set())


def has_permission(perm: str) -> bool:
    return _has(perm)


def permission_required(*perms: str):
    """Pengguna wajib memiliki SEMUA permission yang disebut (role ADMIN selalu lolos)."""
    def decorator(f):
        @wraps(f)
        @jwt_required
        def decorated_function(*args, **kwargs):
            missing = [p for p in perms if not _has(p)]
            if missing:
                return error_response(
                    f"Akses ditolak: Anda tidak memiliki izin {', '.join(missing)}",
                    error_code="FORBIDDEN",
                    status_code=403,
                )
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def any_permission_required(*perms: str):
    """Pengguna cukup memiliki SALAH SATU permission yang disebut."""
    def decorator(f):
        @wraps(f)
        @jwt_required
        def decorated_function(*args, **kwargs):
            if not any(_has(p) for p in perms):
                return error_response(
                    f"Akses ditolak: diperlukan salah satu izin {', '.join(perms)}",
                    error_code="FORBIDDEN",
                    status_code=403,
                )
            return f(*args, **kwargs)

        return decorated_function

    return decorator
