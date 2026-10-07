"""SIIPB Flask Application Factory."""
import os
from flask import Flask, send_from_directory
from flask_cors import CORS

from app.config import Config
from app.extensions import oauth, swagger
from app.routes import register_api_routes
from app.utils.response import error_response, success_response


def create_app(config_class=Config) -> Flask:
    """Create and configure the Flask application with CORS, Swagger, and API v1 blueprints."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    if config_class.APP_ENV == "production":
        weak = [k for k in ("SECRET_KEY", "JWT_SECRET_KEY")
                if len(getattr(config_class, k) or "") < 16
                or any(w in getattr(config_class, k).lower() for w in ("change", "ganti"))]
        if weak:
            raise RuntimeError(f"Konfigurasi production tidak aman: atur {', '.join(weak)} (acak, >= 16 karakter)")

    # Di balik Nginx: hormati X-Forwarded-Proto/Host (redirect OAuth & URL eksternal memakai https)
    if os.getenv("TRUST_PROXY", "0") == "1":
        from werkzeug.middleware.proxy_fix import ProxyFix

        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # Batas ukuran unggahan (ditolak Flask sebelum diproses)
    app.config["MAX_CONTENT_LENGTH"] = (config_class.MAX_UPLOAD_MB * 5 + 1) * 1024 * 1024

    # CORS: hanya origin frontend yang diizinkan di production (CORS_ORIGINS, dipisah koma)
    origins = [o.strip() for o in config_class.CORS_ORIGINS.split(",") if o.strip()] or ["*"]
    CORS(
        app,
        resources={r"/api/*": {"origins": origins}},
        supports_credentials=False,
        expose_headers=["Content-Disposition"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    # Initialize extensions
    swagger.init_app(app)
    oauth.init_app(app)

    # Register API v1 Blueprints
    register_api_routes(app)

    # Static route for uploads (development / local storage)
    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(Config.UPLOAD_FOLDER, filename)

    # Session Flask hanya dipakai Authlib (state/nonce OIDC)
    app.secret_key = config_class.SECRET_KEY
    app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax",
                      SESSION_COOKIE_SECURE=config_class.APP_ENV == "production")

    @app.after_request
    def security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return resp

    @app.get("/api/health")
    def health_check():
        """Health check (database & versi migrasi).
        ---
        tags: [System]
        responses:
          200: {description: Sehat}
          503: {description: Database tidak tersedia}
        """
        from sqlalchemy import text

        from app.database import engine

        try:
            with engine.connect() as conn:
                version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
            return success_response(
                data={"status": "UP", "database": "OK", "migration": version, "service": "SIIPB API v1"},
                message="Server SIIPB sehat dan siap melayani permintaan",
            )
        except Exception:  # noqa: BLE001
            return error_response("Database tidak tersedia", error_code="DB_DOWN", status_code=503)

    @app.errorhandler(413)
    def too_large(err):
        return error_response("Ukuran berkas terlalu besar", error_code="FILE_TOO_LARGE", status_code=413)

    # Standard JSON Error Handlers
    @app.errorhandler(400)
    def bad_request(err):
        return error_response("Permintaan tidak valid (Bad Request)", error_code="BAD_REQUEST", status_code=400)

    @app.errorhandler(404)
    def not_found(err):
        return error_response("Endpoint atau sumber daya tidak ditemukan", error_code="NOT_FOUND", status_code=404)

    @app.errorhandler(405)
    def method_not_allowed(err):
        return error_response("Metode HTTP tidak diizinkan untuk endpoint ini", error_code="METHOD_NOT_ALLOWED", status_code=405)

    @app.errorhandler(500)
    def internal_error(err):
        app.logger.exception("Unhandled error: %s", err)
        return error_response("Terjadi kesalahan internal pada server", error_code="INTERNAL_SERVER_ERROR", status_code=500)

    return app
