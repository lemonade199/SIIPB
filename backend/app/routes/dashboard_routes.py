"""Dashboard: ringkasan, daftar terlambat, statistik (dokumen Plan §11)."""
from flask import Blueprint, request

from app.database import SessionLocal
from app.middleware.auth_middleware import any_permission_required, permission_required
from app.services.dashboard_service import get_dashboard_summary, get_overdue, get_statistics
from app.utils.response import success_response

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/v1/dashboard")


@dashboard_bp.get("/summary")
@permission_required("dashboard.view")
def dashboard_summary():
    """Ringkasan dashboard: jumlah barang per status, transaksi aktif/terlambat/jatuh tempo, insiden.
    ---
    tags: [Dashboard]
    security: [{Bearer: []}]
    responses:
      200: {description: Ringkasan dashboard}
    """
    with SessionLocal() as session:
        return success_response(data=get_dashboard_summary(session), message="Ringkasan data dashboard berhasil dimuat")


@dashboard_bp.get("/overdue")
@any_permission_required("monitoring.view", "dashboard.view")
def dashboard_overdue():
    """Daftar transaksi terlambat beserta jumlah hari & tingkat eskalasi.
    ---
    tags: [Dashboard]
    security: [{Bearer: []}]
    responses:
      200: {description: Daftar keterlambatan}
    """
    with SessionLocal() as session:
        data = get_overdue(session)
        return success_response(data=data, meta={"total": len(data)}, message="Daftar keterlambatan")


@dashboard_bp.get("/statistics")
@any_permission_required("dashboard.view", "report.view")
def dashboard_statistics():
    """Statistik: tren bulanan peminjaman/pengembalian, barang terpopuler, distribusi status, ketepatan waktu.
    ---
    tags: [Dashboard]
    security: [{Bearer: []}]
    parameters:
      - {in: query, name: months, type: integer, default: 12}
    responses:
      200: {description: Statistik}
    """
    with SessionLocal() as session:
        return success_response(data=get_statistics(session, request.args.get("months", 12, type=int)), message="Statistik")
