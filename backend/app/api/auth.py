"""Auth API endpoints."""
from flask import Blueprint, jsonify, request

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/login")
def login():
    """Login endpoint for staff/admin. (Borrowers do NOT have login accounts)."""
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({
            "status": "error",
            "message": "Username dan password wajib diisi",
        }), 400

    # Mock response or placeholder for user verification
    return jsonify({
        "status": "success",
        "message": "Login berhasil (stub)",
        "user": {
            "username": username,
            "roles": ["ADMIN"],
        },
    }), 200
