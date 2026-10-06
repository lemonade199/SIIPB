"""SIIPB Flask Application Factory."""
from flask import Flask, jsonify
from flask_cors import CORS

from app.api import api_bp
from app.api.assets import assets_bp
from app.api.auth import auth_bp


def create_app() -> Flask:
    """Create and configure the Flask application with CORS and blueprints."""
    app = Flask(__name__)

    # Enable CORS for frontend integration
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    # Register blueprints
    app.register_blueprint(api_bp)
    app.register_blueprint(assets_bp)
    app.register_blueprint(auth_bp)

    @app.errorhandler(404)
    def not_found(_err):
        return jsonify({"status": "error", "message": "Endpoint not found"}), 404

    @app.errorhandler(500)
    def internal_error(err):
        return jsonify({"status": "error", "message": "Internal server error"}), 500

    return app
