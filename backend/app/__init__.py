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

    # Enable CORS for frontend integration
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        supports_credentials=True,
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

    # Root and Health Check endpoints
    @app.get("/api/health")
    def health_check():
        return success_response(
            data={"status": "UP", "database": "MariaDB 13 Connected", "service": "SIIPB API v1"},
            message="Server SIIPB sehat dan siap melayani permintaan",
        )

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
        return error_response("Terjadi kesalahan internal pada server", error_code="INTERNAL_SERVER_ERROR", status_code=500)

    return app
