"""Authentication and JWT Token Service."""
from datetime import datetime, timezone, timedelta
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Config
from app.models import RefreshToken, User
from app.services.audit_service import record_audit
from app.utils.security import (
    create_access_token,
    generate_refresh_token,
    hash_token,
    verify_password,
)


def authenticate_user(session: Session, username_or_email: str, password: str) -> dict[str, Any]:
    """Authenticate staff/admin user and issue JWT access token + hashed refresh token."""
    query = (
        select(User)
        .where(
            (User.username == username_or_email) | (User.email == username_or_email)
        )
        .where(User.deleted_at.is_(None))
    )
    user = session.scalars(query).first()

    if not user:
        raise ValueError("Username atau password salah")

    if not user.is_active:
        raise ValueError("Akun dinonaktifkan, hubungi administrator")

    if not verify_password(password, user.password_hash):
        raise ValueError("Username atau password salah")

    # Update last login
    now = datetime.now()
    user.last_login_at = now

    # Issue tokens
    roles = [r.code for r in user.roles if r.is_active]
    permissions = list(user.permission_codes)

    access_token = create_access_token(
        user_id=user.id,
        username=user.username,
        roles=roles,
        permissions=permissions,
    )

    raw_refresh_token, token_hash = generate_refresh_token()
    refresh_expires_at = now + timedelta(days=Config.JWT_REFRESH_TTL_DAYS)

    token_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=refresh_expires_at,
    )
    session.add(token_record)

    record_audit(
        session=session,
        action="LOGIN_SUCCESS",
        module="auth",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
    )

    session.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh_token,
        "token_type": "Bearer",
        "expires_in": Config.JWT_ACCESS_TTL_MINUTES * 60,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "roles": roles,
            "permissions": permissions,
        },
    }


def refresh_access_token(session: Session, raw_refresh_token: str) -> dict[str, Any]:
    """Validate hashed refresh token and issue a new JWT access token."""
    hashed = hash_token(raw_refresh_token)
    query = select(RefreshToken).where(RefreshToken.token_hash == hashed)
    record = session.scalars(query).first()

    if not record or not record.is_valid(datetime.now()):
        raise ValueError("Refresh token tidak valid atau sudah kedaluwarsa")

    user = record.user
    if not user or not user.is_active or user.deleted_at is not None:
        raise ValueError("User akun tidak aktif")

    record.last_used_at = datetime.now()

    roles = [r.code for r in user.roles if r.is_active]
    permissions = list(user.permission_codes)

    new_access_token = create_access_token(
        user_id=user.id,
        username=user.username,
        roles=roles,
        permissions=permissions,
    )

    session.commit()

    return {
        "access_token": new_access_token,
        "token_type": "Bearer",
        "expires_in": Config.JWT_ACCESS_TTL_MINUTES * 60,
    }


def revoke_refresh_token(session: Session, raw_refresh_token: str, user_id: int | None = None) -> bool:
    """Revoke a refresh token on logout."""
    hashed = hash_token(raw_refresh_token)
    query = select(RefreshToken).where(RefreshToken.token_hash == hashed)
    record = session.scalars(query).first()

    if record:
        record.revoked_at = datetime.now()
        if user_id:
            record_audit(
                session=session,
                action="LOGOUT",
                module="auth",
                entity_type="user",
                entity_id=user_id,
                user_id=user_id,
            )
        session.commit()
        return True
    return False


def authenticate_oauth_identity(
    session: Session,
    provider: str,
    provider_subject: str,
    email: str | None = None,
) -> dict[str, Any]:
    """Authenticate or link a user via OAuth 2.0 / OIDC provider."""
    from app.models.auth import ExternalIdentity

    # 1. Lookup by (provider, provider_subject)
    identity = session.scalars(
        select(ExternalIdentity).where(
            ExternalIdentity.provider == provider,
            ExternalIdentity.provider_subject == provider_subject,
        )
    ).first()

    user: User | None = None
    if identity:
        user = identity.user
    elif email:
        # Check if internal user exists with this email
        user = session.scalars(
            select(User).where(User.email == email, User.deleted_at.is_(None))
        ).first()
        if user:
            # Link new external identity
            identity = ExternalIdentity(
                user_id=user.id,
                provider=provider,
                provider_subject=provider_subject,
                email=email,
            )
            session.add(identity)
            session.flush()

    if not user:
        raise ValueError("Akun internal dengan identitas OAuth ini belum terdaftar di sistem")

    if not user.is_active or user.deleted_at is not None:
        raise ValueError("Akun dinonaktifkan, hubungi administrator")

    now = datetime.now()
    user.last_login_at = now

    roles = [r.code for r in user.roles if r.is_active]
    permissions = list(user.permission_codes)

    access_token = create_access_token(
        user_id=user.id,
        username=user.username,
        roles=roles,
        permissions=permissions,
    )

    raw_refresh_token, token_hash = generate_refresh_token()
    refresh_expires_at = now + timedelta(days=Config.JWT_REFRESH_TTL_DAYS)

    token_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=refresh_expires_at,
    )
    session.add(token_record)

    record_audit(
        session=session,
        action="OAUTH_LOGIN_SUCCESS",
        module="auth",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        new_data={"provider": provider, "provider_subject": provider_subject},
    )

    session.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh_token,
        "token_type": "Bearer",
        "expires_in": Config.JWT_ACCESS_TTL_MINUTES * 60,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "roles": roles,
            "permissions": permissions,
        },
    }

