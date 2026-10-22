"""Authentication API endpoints."""
from datetime import datetime

from flask import Blueprint, current_app, g, request

from app.config import Config
from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required
from app.schemas.auth_schema import LoginSchema, RefreshTokenSchema
from app.services.auth_service import authenticate_user, refresh_access_token, revoke_refresh_token
from app.services.captcha_service import captcha_service
from app.utils.response import error_response, success_response

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.get("/captcha")
def get_captcha():
    """Minta tantangan CAPTCHA gambar baru untuk formulir login.
    ---
    tags:
      - Authentication
    responses:
      200:
        description: Challenge CAPTCHA baru berisi ID dan gambar Base64 Data URI
    """
    challenge = captcha_service.create_challenge()
    return success_response(data=challenge, message="Challenge CAPTCHA berhasil dibuat")


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
            captcha_id:
              type: string
              description: ID challenge CAPTCHA
            captcha_answer:
              type: string
              description: Jawaban 6 karakter kode CAPTCHA
    responses:
      200:
        description: Login berhasil dan mengembalikan access token serta refresh token
      400:
        description: Validasi input gagal atau CAPTCHA tidak valid
      401:
        description: Kredensial tidak valid
    """
    data = request.get_json(silent=True) or {}
    schema = LoginSchema()
    errors = schema.validate(data)
    if errors:
        return error_response("Data input tidak valid", error_code="VALIDATION_ERROR", errors=errors)

    # Verifikasi CAPTCHA
    is_testing = current_app.config.get("TESTING") or Config.APP_ENV == "testing"
    # captcha juga diterima dari query string (mis. diisi lewat tab Params di Postman)
    captcha_id = request.args.get("captcha_id") or data.get("captcha_id")
    captcha_answer = request.args.get("captcha_answer") or data.get("captcha_answer")

    # Dalam mode non-testing atau jika client mengirimkan parameter captcha, verifikasi wajib
    if not is_testing or captcha_id or captcha_answer:
        if not captcha_id or not captcha_answer:
            return error_response(
                "Kode CAPTCHA dan ID challenge wajib disertakan",
                error_code="INVALID_CAPTCHA",
                status_code=400,
                errors={"captcha_answer": ["Kode CAPTCHA wajib diisi."]},
            )

        ok, reason = captcha_service.verify(captcha_id, captcha_answer)
        if not ok:
            return error_response(
                reason,
                error_code="INVALID_CAPTCHA",
                status_code=400,
                errors={"captcha_answer": [reason]},
            )

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

    from app.utils.validators import normalize_phone, phone_error

    try:
        data = ProfileSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi profil gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    if "phone" in data:
        data["phone"] = normalize_phone(data["phone"]) or None
        if err := phone_error(data["phone"] or ""):
            return error_response(err, error_code="VALIDATION_ERROR", errors={"phone": [err]})
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


def _sso_settings():
    from app.services.settings_service import oidc_config

    with SessionLocal() as session:
        return oidc_config(session)


@auth_bp.get("/sso")
@auth_bp.get("/google", endpoint="google_login")
def sso_login():
    """Mulai login SSO (OAuth 2.0 / OpenID Connect) ke Identity Provider yang diatur di Pengaturan.
    ---
    tags:
      - Authentication
    responses:
      302:
        description: Redirect ke halaman login Identity Provider
      501:
        description: SSO belum diaktifkan / dikonfigurasi
    """
    from flask import url_for

    from app.services.oidc_service import get_client

    cfg = _sso_settings()
    if not cfg["ready"]:
        return error_response("SSO belum diaktifkan atau dikonfigurasi di server", error_code="SSO_NOT_CONFIGURED", status_code=501)
    return get_client(cfg).authorize_redirect(url_for("auth.sso_callback", _external=True))


@auth_bp.get("/sso/callback")
@auth_bp.get("/google/callback", endpoint="google_callback")
def sso_callback():
    """Callback Identity Provider: validasi state & nonce, cocokkan pengguna, lalu redirect ke frontend
    dengan kode sekali pakai (#sso_code=…) yang ditukar lewat POST /auth/sso/exchange.
    ---
    tags:
      - Authentication
    responses:
      302:
        description: Redirect ke halaman login frontend
    """
    from urllib.parse import quote

    from flask import redirect

    from app.config import Config
    from app.services.auth_service import issue_sso_code, resolve_oauth_user
    from app.services.oidc_service import get_client

    target = Config.FRONTEND_URL.rstrip("/") + "/login"
    try:
        cfg = _sso_settings()
        if not cfg["ready"]:
            raise ValueError("SSO belum diaktifkan atau dikonfigurasi")
        client = get_client(cfg)
        token = client.authorize_access_token()  # memvalidasi state & nonce (Authlib)
        userinfo = token.get("userinfo") or client.userinfo()
        if userinfo.get("email") and userinfo.get("email_verified") is False:
            raise ValueError("Email akun SSO belum terverifikasi")
        with SessionLocal() as session:
            user = resolve_oauth_user(session, cfg["provider"], str(userinfo["sub"]), userinfo.get("email"))
            user.last_login_at = datetime.now()
            code = issue_sso_code(session, user)
        return redirect(f"{target}#sso_code={quote(code)}")
    except Exception as e:  # noqa: BLE001
        return redirect(f"{target}#sso_error={quote(str(e)[:200])}")
