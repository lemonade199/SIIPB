"""API package for SIIPB REST Endpoints."""
from flask import Blueprint, jsonify

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/health")
def health_check():
    """Health check endpoint for frontend and monitoring."""
    return jsonify({
        "status": "ok",
        "service": "SIIPB API",
        "version": "1.0.0",
        "database": "MariaDB 13",
    }), 200
