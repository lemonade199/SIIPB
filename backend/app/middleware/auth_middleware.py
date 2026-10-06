"""Authentication and Authorization (RBAC) middleware decorators."""
from functools import wraps
from flask import g, request

from app.utils.response import error_response
from app.utils.security import decode_access_token


def jwt_required(f):
    """Ensure a valid JWT access token is present in the Authorization header."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return error_response(
                message="Header Authorization wajib disertakan",
                error_code="UNAUTHORIZED",
                status_code=401,
            )

        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return error_response(
                message="Format Authorization harus: Bearer <token>",
                error_code="INVALID_TOKEN_FORMAT",
                status_code=401,
            )

        token = parts[1]
        payload = decode_access_token(token)
        if not payload:
            return error_response(
                message="Token akses tidak valid atau sudah kedaluwarsa",
                error_code="TOKEN_EXPIRED_OR_INVALID",
                status_code=401,
            )

        # Attach claims to Flask's request context
        g.current_user = {
            "id": int(payload["sub"]),
            "username": payload["username"],
            "roles": payload.get("roles", []),
            "permissions": set(payload.get("permissions", [])),
        }

        return f(*args, **kwargs)

    return decorated_function


def permission_required(*perms: str):
    """Ensure the authenticated user has ALL or ANY of the required permission codes.

    Admin role bypasses individual checks.
    """
    def decorator(f):
        @wraps(f)
        @jwt_required
        def decorated_function(*args, **kwargs):
            user_perms = g.current_user.get("permissions", set())
            user_roles = g.current_user.get("roles", [])

            # Admin role has full access
            if "ADMIN" in user_roles:
                return f(*args, **kwargs)

            # Check if user has all required permissions
            missing = [p for p in perms if p not in user_perms]
            if missing:
                return error_response(
                    message=f"Akses ditolak: Anda tidak memiliki izin {', '.join(missing)}",
                    error_code="FORBIDDEN",
                    status_code=403,
                )

            return f(*args, **kwargs)

        return decorated_function

    return decorator
