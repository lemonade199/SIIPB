"""Authentication API endpoints."""
from datetime import datetime

from flask import Blueprint, g, request

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required
from app.schemas.auth_schema import LoginSchema, RefreshTokenSchema
from app.services.auth_service import authenticate_user, refresh_access_token, revoke_refresh_token
from app.utils.response import error_response, success_response

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.post("/login")
def login():
    """Login internal user (Admin/Petugas/Pimpinan).
    ---
    tags:
      - Authentication
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
              example: admin
            password:
              type: string
              example: admin123
    responses:
      200:
        description: Login berhasil dan mengembalikan access token serta refresh token
      400:
        description: Validasi input gagal
      401:
        description: Kredensial tidak valid
    """
    data = request.get_json(silent=True) or {}
    schema = LoginSchema()
    errors = schema.validate(data)
    if errors:
        return error_response("Data input tidak valid", error_code="VALIDATION_ERROR", errors=errors)

    with SessionLocal() as session:
        try:
            res = authenticate_user(session, data["username"], data["password"])
            return success_response(data=res, message="Login berhasil")
        except ValueError as e:
            return error_response(str(e), error_code="AUTH_FAILED", status_code=401)


@auth_bp.post("/refresh")
def refresh():
    """Refresh expired access token using valid refresh token.
    ---
    tags:
      - Authentication
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required:
            - refresh_token
          properties:
            refresh_token:
              type: string
    responses:
      200:
        description: Access token baru berhasil dibuat
      401:
        description: Refresh token tidak valid atau kedaluwarsa
    """
    data = request.get_json(silent=True) or {}
    schema = RefreshTokenSchema()
    errors = schema.validate(data)
    if errors:
        return error_response("Refresh token wajib diisi", error_code="VALIDATION_ERROR", errors=errors)

    with SessionLocal() as session:
        try:
            res = refresh_access_token(session, data["refresh_token"])
            return success_response(data=res, message="Token berhasil diperbarui")
        except ValueError as e:
            return error_response(str(e), error_code="INVALID_REFRESH_TOKEN", status_code=401)


@auth_bp.get("/me")
@jwt_required
def get_me():
    """Profil pengguna yang sedang login beserta role & permission.
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Informasi profil pengguna
    """
    from app.models import User
    from app.services.auth_service import user_profile

    with SessionLocal() as session:
        user = session.get(User, g.current_user["id"])
        return success_response(data=user_profile(user), message="Profil pengguna berhasil dimuat")


@auth_bp.put("/me")
@jwt_required
def update_me():
    """Ubah profil sendiri (nama, email, telepon).
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Profil diperbarui
    """
    from marshmallow import Schema, ValidationError, fields, validate
    from sqlalchemy import select

    from app.models import User
    from app.services.audit_service import record_audit
    from app.services.auth_service import user_profile

    class ProfileSchema(Schema):
        full_name = fields.String(validate=validate.Length(min=2, max=150))
        email = fields.Email()
        phone = fields.String(allow_none=True, validate=validate.Length(max=30))

    try:
        data = ProfileSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi profil gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        user = session.get(User, g.current_user["id"])
        if "email" in data and data["email"] != user.email:
            if session.scalars(select(User).where(User.email == data["email"], User.id != user.id)).first():
                return error_response("Email sudah dipakai pengguna lain", error_code="VALIDATION_ERROR",
                                      errors={"email": ["Email sudah dipakai."]})
        old = {k: getattr(user, k) for k in data}
        for k, v in data.items():
            setattr(user, k, v)
        record_audit(session, "UPDATE_PROFILE", "auth", "user", user.id, user.id, old_data=old, new_data=data)
        session.commit()
        return success_response(data=user_profile(user), message="Profil diperbarui")


@auth_bp.post("/change-password")
@jwt_required
def change_password_route():
    """Ganti kata sandi sendiri (minimal 8 karakter, huruf & angka). Semua sesi lain dicabut.
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required: [current_password, new_password]
          properties:
            current_password: {type: string}
            new_password: {type: string}
    responses:
      200:
        description: Kata sandi diganti
      400:
        description: Kata sandi lama salah / kebijakan tidak terpenuhi
    """
    from app.services.auth_service import change_password

    data = request.get_json(silent=True) or {}
    with SessionLocal() as session:
        try:
            change_password(session, g.current_user["id"], data.get("current_password") or "", data.get("new_password") or "")
        except ValueError as e:
            return error_response(str(e), error_code="VALIDATION_ERROR", errors={"new_password": [str(e)]})
    return success_response(message="Kata sandi berhasil diganti. Silakan login ulang di perangkat lain.")


@auth_bp.post("/sso/exchange")
def sso_exchange():
    """Tukar kode sekali pakai hasil login SSO (berlaku 60 detik) dengan token JWT.
    ---
    tags:
      - Authentication
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required: [code]
          properties:
            code: {type: string}
    responses:
      200:
        description: Token diterbitkan
      401:
        description: Kode tidak valid
    """
    from app.services.auth_service import exchange_sso_code

    code = (request.get_json(silent=True) or {}).get("code") or ""
    with SessionLocal() as session:
        try:
            return success_response(data=exchange_sso_code(session, code), message="Login SSO berhasil")
        except ValueError as e:
            return error_response(str(e), error_code="AUTH_FAILED", status_code=401)


@auth_bp.post("/logout")
@jwt_required
def logout():
    """Logout and revoke refresh token.
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            refresh_token:
              type: string
    responses:
      200:
        description: Logout berhasil
    """
    data = request.get_json(silent=True) or {}
    raw_token = data.get("refresh_token")
    if raw_token:
        with SessionLocal() as session:
            revoke_refresh_token(session, raw_token, user_id=g.current_user["id"])

    return success_response(message="Logout berhasil")


@auth_bp.get("/google")
def google_login():
    """Initiate Google OAuth 2.0 / OIDC login redirect."""
    from app.extensions import oauth
    from flask import url_for

    if not hasattr(oauth, "google"):
        return error_response("Google OAuth belum dikonfigurasi di server", status_code=501)

    redirect_uri = url_for("auth.google_callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@auth_bp.get("/google/callback")
def google_callback():
    """Google OAuth 2.0 / OIDC callback endpoint."""
    from app.extensions import oauth
    if not hasattr(oauth, "google"):
        return error_response("Google OAuth belum dikonfigurasi", status_code=501)

    from urllib.parse import quote

    from flask import redirect

    from app.config import Config
    from app.services.auth_service import issue_sso_code, resolve_oauth_user

    target = Config.FRONTEND_URL.rstrip("/") + "/login"
    try:
        token = oauth.google.authorize_access_token()  # memvalidasi state & nonce (Authlib)
        userinfo = token.get("userinfo") or oauth.google.userinfo()
        if userinfo.get("email") and userinfo.get("email_verified") is False:
            raise ValueError("Email akun SSO belum terverifikasi")
        with SessionLocal() as session:
            user = resolve_oauth_user(session, "google", str(userinfo["sub"]), userinfo.get("email"))
            user.last_login_at = datetime.now()
            code = issue_sso_code(session, user)
        return redirect(f"{target}#sso_code={quote(code)}")
    except Exception as e:  # noqa: BLE001
        return redirect(f"{target}#sso_error={quote(str(e)[:200])}")
