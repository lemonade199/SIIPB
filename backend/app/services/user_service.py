"""Pengguna internal, role, dan permission (PB-001, PB-002)."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Permission, Role, RolePermission, User, UserRole
from app.services.audit_service import record_audit
from app.services.auth_service import login_method
from app.utils.security import hash_password, validate_password_strength

SYSTEM_ROLES = {"ADMIN", "SARPRAS", "PIMPINAN"}


class UserError(ValueError):
    def __init__(self, message: str, errors: dict[str, str] | None = None, status: int = 400):
        super().__init__(message)
        self.errors = errors or {}
        self.status = status


# ---------------------------------------------------------------- serializers
def serialize_user(u: User) -> dict[str, Any]:
    roles = [r for r in u.roles]
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "full_name": u.full_name,
        "phone": u.phone,
        "unit_id": u.unit_id,
        "is_active": u.is_active,
        "roles": [{"id": r.id, "code": r.code, "name": r.name} for r in roles],
        "role_id": roles[0].id if roles else None,
        "login_method": login_method(u),
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def serialize_role(session: Session, r: Role) -> dict[str, Any]:
    users = session.scalar(
        select(func.count()).select_from(UserRole).join(User, User.id == UserRole.user_id)
        .where(UserRole.role_id == r.id, User.deleted_at.is_(None))
    ) or 0
    return {
        "id": r.id,
        "code": r.code,
        "name": r.name,
        "description": r.description,
        "is_active": r.is_active,
        "system": r.code in SYSTEM_ROLES,
        "permissions": sorted(p.code for p in r.permissions),
        "user_count": users,
    }


def list_permissions(session: Session) -> list[dict[str, Any]]:
    return [
        {"id": p.id, "code": p.code, "name": p.name, "module": p.module, "description": p.description}
        for p in session.scalars(select(Permission).order_by(Permission.module, Permission.code)).all()
    ]


# ---------------------------------------------------------------- users
def list_users(session: Session, search: str | None = None, include_inactive: bool = True) -> list[User]:
    q = select(User).where(User.deleted_at.is_(None))
    if not include_inactive:
        q = q.where(User.is_active.is_(True))
    if search:
        q = q.where(User.full_name.ilike(f"%{search}%") | User.username.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
    return list(session.scalars(q.order_by(User.full_name)).all())


def _role_ids(data: dict[str, Any]) -> list[int] | None:
    if data.get("role_ids") is not None:
        return [int(i) for i in data["role_ids"]]
    if data.get("role_id") is not None:
        return [int(data["role_id"])]
    return None


def _active_admin_count(session: Session, exclude_user: int | None = None) -> int:
    q = (
        select(func.count(func.distinct(User.id)))
        .select_from(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(Role.code == "ADMIN", User.is_active.is_(True), User.deleted_at.is_(None))
    )
    if exclude_user:
        q = q.where(User.id != exclude_user)
    return session.scalar(q) or 0


def _check_unique(session: Session, data: dict[str, Any], user_id: int | None = None) -> None:
    errors: dict[str, str] = {}
    if data.get("username"):
        q = select(User).where(User.username == data["username"])
        if user_id:
            q = q.where(User.id != user_id)
        if session.scalars(q).first():
            errors["username"] = "Username sudah dipakai."
    if data.get("email"):
        q = select(User).where(User.email == data["email"])
        if user_id:
            q = q.where(User.id != user_id)
        if session.scalars(q).first():
            errors["email"] = "Email sudah dipakai."
    if errors:
        raise UserError("Data pengguna bentrok", errors)


def _set_roles(session: Session, user: User, role_ids: list[int], actor_id: int) -> None:
    roles = [session.get(Role, rid) for rid in role_ids]
    if not role_ids or any(r is None for r in roles):
        raise UserError("Role tidak valid", {"role_id": "Pilih role yang valid."})
    user.role_links.clear()
    session.flush()
    for r in roles:
        user.role_links.append(UserRole(role_id=r.id, assigned_by=actor_id))
    session.flush()
    session.refresh(user)


def create_user(session: Session, data: dict[str, Any], actor_id: int) -> User:
    _check_unique(session, data)
    password = data.get("password") or ""
    if password:
        err = validate_password_strength(password)
        if err:
            raise UserError(err, {"password": err})
    elif not data.get("sso_only"):
        raise UserError("Kata sandi wajib diisi untuk login lokal", {"password": "Kata sandi wajib diisi."})
    role_ids = _role_ids(data)
    if not role_ids:
        raise UserError("Role wajib dipilih", {"role_id": "Pilih role."})
    user = User(
        username=data["username"].strip(),
        email=data["email"].strip(),
        full_name=data["full_name"].strip(),
        phone=(data.get("phone") or "").strip() or None,
        unit_id=data.get("unit_id"),
        password_hash=hash_password(password) if password else None,
        is_active=data.get("is_active", True),
    )
    session.add(user)
    session.flush()
    _set_roles(session, user, role_ids, actor_id)
    record_audit(session, "CREATE", "users", "user", user.id, actor_id, new_data={
        "username": user.username, "email": user.email, "full_name": user.full_name,
        "roles": [r.code for r in user.roles],
    })
    session.commit()
    return user


def update_user(session: Session, user_id: int, data: dict[str, Any], actor_id: int) -> User:
    user = session.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise UserError("Pengguna tidak ditemukan", status=404)
    _check_unique(session, data, user_id)
    old = serialize_user(user)
    was_admin = any(r.code == "ADMIN" for r in user.roles)

    for k in ("email", "full_name", "unit_id"):
        if k in data and data[k] is not None:
            setattr(user, k, data[k].strip() if isinstance(data[k], str) else data[k])
    if "phone" in data:
        user.phone = (data.get("phone") or "").strip() or None
    if data.get("password"):
        err = validate_password_strength(data["password"])
        if err:
            raise UserError(err, {"password": err})
        user.password_hash = hash_password(data["password"])
        now = datetime.now()
        for t in user.refresh_tokens:
            if t.revoked_at is None:
                t.revoked_at = now
    if "is_active" in data and data["is_active"] is not None:
        if user.id == actor_id and not data["is_active"]:
            raise UserError("Anda tidak dapat menonaktifkan akun sendiri")
        if was_admin and not data["is_active"] and _active_admin_count(session, user.id) == 0:
            raise UserError("Minimal harus ada satu administrator aktif")
        user.is_active = bool(data["is_active"])
    role_ids = _role_ids(data)
    if role_ids is not None:
        new_codes = {session.get(Role, rid).code for rid in role_ids if session.get(Role, rid)}
        if was_admin and "ADMIN" not in new_codes:
            if user.id == actor_id:
                raise UserError("Anda tidak dapat mencabut role Administrator dari akun sendiri")
            if _active_admin_count(session, user.id) == 0:
                raise UserError("Minimal harus ada satu administrator aktif")
        _set_roles(session, user, role_ids, actor_id)

    new = serialize_user(user)
    changed = {k: new[k] for k in ("email", "full_name", "phone", "is_active", "roles") if old[k] != new[k]}
    if data.get("password"):
        changed["password"] = "(direset)"
    record_audit(session, "UPDATE", "users", "user", user.id, actor_id,
                 old_data={k: old.get(k) for k in changed if k != "password"}, new_data=changed)
    session.commit()
    return user


def delete_user(session: Session, user_id: int, actor_id: int) -> None:
    user = session.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise UserError("Pengguna tidak ditemukan", status=404)
    if user.id == actor_id:
        raise UserError("Anda tidak dapat menghapus akun sendiri")
    if any(r.code == "ADMIN" for r in user.roles) and _active_admin_count(session, user.id) == 0:
        raise UserError("Minimal harus ada satu administrator aktif")
    user.deleted_at = datetime.now()
    user.is_active = False
    for t in user.refresh_tokens:
        if t.revoked_at is None:
            t.revoked_at = user.deleted_at
    record_audit(session, "DELETE", "users", "user", user.id, actor_id, old_data={"username": user.username})
    session.commit()


# ---------------------------------------------------------------- roles
def _perm_ids(session: Session, codes: list[str]) -> list[int]:
    perms = session.scalars(select(Permission).where(Permission.code.in_(codes))).all()
    unknown = set(codes) - {p.code for p in perms}
    if unknown:
        raise UserError(f"Permission tidak dikenal: {', '.join(sorted(unknown))}", {"permissions": "Permission tidak dikenal."})
    return [p.id for p in perms]


def save_role(session: Session, data: dict[str, Any], actor_id: int, role_id: int | None = None) -> Role:
    if role_id:
        role = session.get(Role, role_id)
        if not role:
            raise UserError("Role tidak ditemukan", status=404)
    else:
        code = (data.get("code") or "").strip().upper().replace(" ", "_")
        if not code or len(code) < 3:
            raise UserError("Kode role minimal 3 karakter", {"code": "Kode role minimal 3 karakter."})
        if session.scalars(select(Role).where(Role.code == code)).first():
            raise UserError("Kode role sudah dipakai", {"code": "Kode role sudah dipakai."})
        role = Role(code=code, name=code)
        session.add(role)
        session.flush()
    old = serialize_role(session, role) if role_id else None

    if data.get("name"):
        role.name = data["name"].strip()
    if "description" in data:
        role.description = (data.get("description") or "").strip() or None
    if "is_active" in data and data["is_active"] is not None:
        if role.code == "ADMIN" and not data["is_active"]:
            raise UserError("Role Administrator tidak dapat dinonaktifkan")
        role.is_active = bool(data["is_active"])
    if data.get("permissions") is not None:
        codes = list(dict.fromkeys(data["permissions"]))
        if role.code == "ADMIN":
            codes = [p.code for p in session.scalars(select(Permission)).all()]  # admin selalu penuh
        ids = _perm_ids(session, codes)
        role.permission_links.clear()
        session.flush()
        for pid in ids:
            role.permission_links.append(RolePermission(permission_id=pid))
    session.flush()
    session.refresh(role)
    new = serialize_role(session, role)
    record_audit(session, "UPDATE" if role_id else "CREATE", "users", "role", role.id, actor_id,
                 old_data={k: old[k] for k in ("name", "description", "permissions", "is_active")} if old else None,
                 new_data={k: new[k] for k in ("code", "name", "description", "permissions", "is_active")})
    session.commit()
    return role


def delete_role(session: Session, role_id: int, actor_id: int) -> None:
    role = session.get(Role, role_id)
    if not role:
        raise UserError("Role tidak ditemukan", status=404)
    if role.code in SYSTEM_ROLES:
        raise UserError("Role bawaan sistem tidak dapat dihapus")
    if serialize_role(session, role)["user_count"]:
        raise UserError("Role masih dipakai pengguna")
    record_audit(session, "DELETE", "users", "role", role.id, actor_id, old_data={"code": role.code})
    session.delete(role)
    session.commit()
