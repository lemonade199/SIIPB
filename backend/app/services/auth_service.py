"""Authentication and JWT Token Service."""
from datetime import datetime, timedelta
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Config
from app.models import RefreshToken, User
from app.services.audit_service import record_audit
from app.utils.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    needs_rehash,
    validate_password_strength,
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
        record_audit(session, "LOGIN_FAILED", "auth", "user", user.id, None)
        session.commit()
        raise ValueError("Username atau password salah")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

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
        "user": user_profile(user),
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


def resolve_oauth_user(
    session: Session,
    provider: str,
    provider_subject: str,
    email: str | None = None,
) -> User:
    """Cari pengguna internal untuk identitas OAuth (provider, subject); tautkan via email terverifikasi."""
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
    return user


def authenticate_oauth_identity(
    session: Session,
    provider: str,
    provider_subject: str,
    email: str | None = None,
) -> dict[str, Any]:
    """Login via OAuth/OIDC dan terbitkan token JWT."""
    user = resolve_oauth_user(session, provider, provider_subject, email)
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
        "user": user_profile(user),
    }


def user_profile(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "unit_id": user.unit_id,
        "roles": [r.code for r in user.roles if r.is_active],
        "permissions": sorted(user.permission_codes),
        "login_method": login_method(user),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }


def login_method(user: User) -> str:
    local = bool(user.password_hash)
    sso = bool(user.external_identities)
    return "LOKAL + SSO" if local and sso else ("SSO" if sso else "LOKAL")


def change_password(session: Session, user_id: int, current: str, new: str) -> None:
    user = session.get(User, user_id)
    if not user:
        raise ValueError("Pengguna tidak ditemukan")
    if user.password_hash and not verify_password(current, user.password_hash):
        raise ValueError("Kata sandi saat ini salah")
    err = validate_password_strength(new)
    if err:
        raise ValueError(err)
    if current and current == new:
        raise ValueError("Kata sandi baru harus berbeda dari kata sandi lama")
    user.password_hash = hash_password(new)
    # cabut seluruh sesi lain (refresh token)
    now = datetime.now()
    for t in user.refresh_tokens:
        if t.revoked_at is None:
            t.revoked_at = now
    record_audit(session, "CHANGE_PASSWORD", "auth", "user", user.id, user.id)
    session.commit()


SSO_CODE_TTL_SECONDS = 60


def issue_sso_code(session: Session, user: User) -> str:
    """Kode sekali pakai (berlaku 60 detik) untuk ditukar frontend dengan token JWT setelah login SSO."""
    raw, token_hash = generate_refresh_token()
    session.add(RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now() + timedelta(seconds=SSO_CODE_TTL_SECONDS),
    ))
    session.commit()
    return raw


def exchange_sso_code(session: Session, code: str) -> dict[str, Any]:
    record = session.scalars(select(RefreshToken).where(RefreshToken.token_hash == hash_token(code))).first()
    now = datetime.now()
    if not record or not record.is_valid(now) or (record.expires_at - record.created_at).total_seconds() > SSO_CODE_TTL_SECONDS + 5:
        raise ValueError("Kode SSO tidak valid atau kedaluwarsa")
    record.revoked_at = now
    user = record.user
    if not user.is_active or user.deleted_at is not None:
        raise ValueError("Akun dinonaktifkan, hubungi administrator")
    raw_refresh, refresh_hash = generate_refresh_token()
    session.add(RefreshToken(user_id=user.id, token_hash=refresh_hash,
                             expires_at=now + timedelta(days=Config.JWT_REFRESH_TTL_DAYS)))
    roles = [r.code for r in user.roles if r.is_active]
    access = create_access_token(user.id, user.username, roles, list(user.permission_codes))
    session.commit()
    return {
        "access_token": access,
        "refresh_token": raw_refresh,
        "token_type": "Bearer",
        "expires_in": Config.JWT_ACCESS_TTL_MINUTES * 60,
        "user": user_profile(user),
    }
