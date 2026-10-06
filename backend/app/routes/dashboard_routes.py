"""Dashboard analytics and summary routes."""
from flask import Blueprint

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required
from app.services.dashboard_service import get_dashboard_summary
from app.utils.response import success_response

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/v1/dashboard")


@dashboard_bp.get("/summary")
@jwt_required
def dashboard_summary():
    """Get real-time dashboard analytics and inventory summaries.
    ---
    tags:
      - Dashboard
    security:
      - Bearer: []
    responses:
      200:
        description: Statistik ringkasan dashboard berhasil dimuat
    """
    with SessionLocal() as session:
        data = get_dashboard_summary(session)
        return success_response(data=data, message="Ringkasan data dashboard berhasil dimuat")
