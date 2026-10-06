"""Routes registration package for SIIPB API v1."""
from flask import Flask

from app.routes.asset_routes import asset_bp
from app.routes.audit_routes import audit_bp
from app.routes.auth_routes import auth_bp
from app.routes.dashboard_routes import dashboard_bp
from app.routes.master_routes import master_bp
from app.routes.notification_routes import notification_bp
from app.routes.borrowing_routes import borrowing_bp
from app.routes.return_routes import return_bp
from app.routes.upload_routes import upload_bp


def register_api_routes(app: Flask) -> None:
    """Register all API v1 blueprints to Flask app."""
    app.register_blueprint(auth_bp)
    app.register_blueprint(master_bp)
    app.register_blueprint(asset_bp)
    app.register_blueprint(borrowing_bp)
    app.register_blueprint(return_bp)
    app.register_blueprint(notification_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(upload_bp)


__all__ = [
    "register_api_routes",
    "auth_bp",
    "master_bp",
    "asset_bp",
    "borrowing_bp",
    "return_bp",
    "notification_bp",
    "dashboard_bp",
    "audit_bp",
    "upload_bp",
]
