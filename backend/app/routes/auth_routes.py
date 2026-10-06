"""Authentication API endpoints."""
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
    """Get current authenticated user profile and permissions.
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Informasi profil pengguna
    """
    return success_response(
        data={
            "id": g.current_user["id"],
            "username": g.current_user["username"],
            "roles": g.current_user["roles"],
            "permissions": list(g.current_user["permissions"]),
        },
        message="Profil pengguna berhasil dimuat",
    )


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
    from app.services.auth_service import authenticate_oauth_identity

    if not hasattr(oauth, "google"):
        return error_response("Google OAuth belum dikonfigurasi", status_code=501)

    try:
        token = oauth.google.authorize_access_token()
        userinfo = token.get("userinfo")
        if not userinfo:
            userinfo = oauth.google.userinfo()

        provider_subject = str(userinfo["sub"])
        email = userinfo.get("email")

        with SessionLocal() as session:
            res = authenticate_oauth_identity(
                session=session,
                provider="google",
                provider_subject=provider_subject,
                email=email,
            )
            return success_response(data=res, message="Login Google OAuth berhasil")
    except Exception as e:
        return error_response(f"Autentikasi Google gagal: {str(e)}", status_code=400)

