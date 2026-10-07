"""Kelola pengguna internal, role & permission (dokumen Plan §11: /api/v1/users)."""
from flask import Blueprint, g, request
from marshmallow import Schema, ValidationError, fields, validate

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required, permission_required
from app.models import Role, User
from app.services.user_service import (
    UserError,
    create_user,
    delete_role,
    delete_user,
    list_permissions,
    list_users,
    save_role,
    serialize_role,
    serialize_user,
    update_user,
)
from app.utils.response import error_response, success_response

user_bp = Blueprint("users", __name__, url_prefix="/api/v1")


class UserCreateSchema(Schema):
    username = fields.String(required=True, validate=validate.Regexp(r"^[a-zA-Z0-9._-]{3,100}$", error="3-100 karakter: huruf, angka, titik, _ atau -."))
    email = fields.Email(required=True)
    full_name = fields.String(required=True, validate=validate.Length(min=2, max=150))
    phone = fields.String(allow_none=True, validate=validate.Length(max=30))
    password = fields.String(allow_none=True, validate=validate.Length(max=128))
    unit_id = fields.Integer(allow_none=True)
    role_id = fields.Integer(allow_none=True)
    role_ids = fields.List(fields.Integer(), allow_none=True)
    is_active = fields.Boolean()
    sso_only = fields.Boolean()


class UserUpdateSchema(Schema):
    email = fields.Email()
    full_name = fields.String(validate=validate.Length(min=2, max=150))
    phone = fields.String(allow_none=True, validate=validate.Length(max=30))
    password = fields.String(allow_none=True, validate=validate.Length(max=128))
    unit_id = fields.Integer(allow_none=True)
    role_id = fields.Integer(allow_none=True)
    role_ids = fields.List(fields.Integer(), allow_none=True)
    is_active = fields.Boolean(allow_none=True)


class RoleSchema(Schema):
    code = fields.String(validate=validate.Length(min=3, max=50))
    name = fields.String(validate=validate.Length(min=2, max=100))
    description = fields.String(allow_none=True)
    is_active = fields.Boolean(allow_none=True)
    permissions = fields.List(fields.String(), allow_none=True)


def _err(e: UserError):
    return error_response(str(e), error_code="NOT_FOUND" if e.status == 404 else "VALIDATION_ERROR",
                          status_code=e.status, errors=e.errors or None)


@user_bp.get("/users")
@permission_required("users.manage")
def users_index():
    """Daftar pengguna internal.
    ---
    tags: [Users]
    security: [{Bearer: []}]
    parameters:
      - {in: query, name: search, type: string}
    responses:
      200: {description: Daftar pengguna}
    """
    with SessionLocal() as session:
        return success_response(data=[serialize_user(u) for u in list_users(session, request.args.get("search"))])


@user_bp.post("/users")
@permission_required("users.manage")
def users_create():
    """Tambah pengguna internal (admin/petugas/pimpinan).
    ---
    tags: [Users]
    security: [{Bearer: []}]
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required: [username, email, full_name, role_id]
          properties:
            username: {type: string}
            email: {type: string}
            full_name: {type: string}
            phone: {type: string}
            password: {type: string, description: "min 8 karakter, huruf & angka"}
            role_id: {type: integer}
    responses:
      201: {description: Pengguna dibuat}
    """
    try:
        data = UserCreateSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi pengguna gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        try:
            u = create_user(session, data, g.current_user["id"])
        except UserError as e:
            return _err(e)
        return success_response(data=serialize_user(u), message="Pengguna ditambahkan", status_code=201)


@user_bp.get("/users/directory")
@jwt_required
def users_directory():
    """Nama pengguna internal untuk tampilan (petugas pada transaksi/audit). Tanpa data sensitif.
    ---
    tags: [Users]
    security: [{Bearer: []}]
    responses:
      200: {description: Direktori pengguna}
    """
    from sqlalchemy import select

    with SessionLocal() as session:
        users = session.scalars(select(User).order_by(User.full_name)).all()
        return success_response(data=[
            {"id": u.id, "full_name": u.full_name, "username": u.username, "is_active": u.is_active and u.deleted_at is None,
             "roles": [r.code for r in u.roles]}
            for u in users
        ])


@user_bp.get("/users/<int:user_id>")
@permission_required("users.manage")
def users_show(user_id: int):
    """Detail pengguna.
    ---
    tags: [Users]
    security: [{Bearer: []}]
    responses:
      200: {description: Detail pengguna}
    """
    with SessionLocal() as session:
        u = session.get(User, user_id)
        if not u or u.deleted_at is not None:
            return error_response("Pengguna tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        return success_response(data=serialize_user(u))


@user_bp.put("/users/<int:user_id>")
@permission_required("users.manage")
def users_update(user_id: int):
    """Ubah pengguna (profil, role, aktif/nonaktif, reset kata sandi).
    ---
    tags: [Users]
    security: [{Bearer: []}]
    responses:
      200: {description: Pengguna diperbarui}
    """
    try:
        data = UserUpdateSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi pengguna gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        try:
            u = update_user(session, user_id, data, g.current_user["id"])
        except UserError as e:
            return _err(e)
        return success_response(data=serialize_user(u), message="Pengguna diperbarui")


@user_bp.delete("/users/<int:user_id>")
@permission_required("users.manage")
def users_delete(user_id: int):
    """Hapus (soft delete) pengguna.
    ---
    tags: [Users]
    security: [{Bearer: []}]
    responses:
      200: {description: Pengguna dihapus}
    """
    with SessionLocal() as session:
        try:
            delete_user(session, user_id, g.current_user["id"])
        except UserError as e:
            return _err(e)
        return success_response(message="Pengguna dihapus")


@user_bp.get("/roles")
@permission_required("users.manage")
def roles_index():
    """Daftar role beserta permission.
    ---
    tags: [Users]
    security: [{Bearer: []}]
    responses:
      200: {description: Daftar role}
    """
    from sqlalchemy import select

    with SessionLocal() as session:
        roles = session.scalars(select(Role).order_by(Role.id)).all()
        return success_response(data=[serialize_role(session, r) for r in roles])


@user_bp.post("/roles")
@permission_required("users.manage")
def roles_create():
    """Tambah role.
    ---
    tags: [Users]
    security: [{Bearer: []}]
    responses:
      201: {description: Role dibuat}
    """
    try:
        data = RoleSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi role gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        try:
            r = save_role(session, data, g.current_user["id"])
        except UserError as e:
            return _err(e)
        return success_response(data=serialize_role(session, r), message="Role ditambahkan", status_code=201)


@user_bp.put("/roles/<int:role_id>")
@permission_required("users.manage")
def roles_update(role_id: int):
    """Ubah role & permission (matriks RBAC).
    ---
    tags: [Users]
    security: [{Bearer: []}]
    responses:
      200: {description: Role diperbarui}
    """
    try:
        data = RoleSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi role gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    data.pop("code", None)
    with SessionLocal() as session:
        try:
            r = save_role(session, data, g.current_user["id"], role_id)
        except UserError as e:
            return _err(e)
        return success_response(data=serialize_role(session, r), message="Role diperbarui")


@user_bp.delete("/roles/<int:role_id>")
@permission_required("users.manage")
def roles_delete(role_id: int):
    """Hapus role non-sistem yang tidak dipakai.
    ---
    tags: [Users]
    security: [{Bearer: []}]
    responses:
      200: {description: Role dihapus}
    """
    with SessionLocal() as session:
        try:
            delete_role(session, role_id, g.current_user["id"])
        except UserError as e:
            return _err(e)
        return success_response(message="Role dihapus")


@user_bp.get("/permissions")
@permission_required("users.manage")
def permissions_index():
    """Daftar permission yang tersedia.
    ---
    tags: [Users]
    security: [{Bearer: []}]
    responses:
      200: {description: Daftar permission}
    """
    with SessionLocal() as session:
        return success_response(data=list_permissions(session))
