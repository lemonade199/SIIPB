"""Registrasi blueprint API v1 SIIPB."""
from flask import Flask

from app.routes.asset_routes import asset_bp
from app.routes.audit_routes import audit_bp
from app.routes.auth_routes import auth_bp
from app.routes.borrowing_routes import borrowing_bp
from app.routes.dashboard_routes import dashboard_bp
from app.routes.master_routes import master_bp
from app.routes.notification_routes import notification_bp
from app.routes.report_routes import report_bp
from app.routes.return_routes import return_bp
from app.routes.settings_routes import settings_bp
from app.routes.upload_routes import upload_bp
from app.routes.user_routes import user_bp


def register_api_routes(app: Flask) -> None:
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(master_bp)
    app.register_blueprint(asset_bp)
    # Alias sesuai dokumen Plan §11: /api/v1/items == /api/v1/assets
    app.register_blueprint(asset_bp, url_prefix="/api/v1/items", name="items")
    app.register_blueprint(borrowing_bp)
    app.register_blueprint(return_bp)
    app.register_blueprint(notification_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(upload_bp)


__all__ = ["register_api_routes"]
