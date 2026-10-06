"""Assets REST API endpoints for inventory management."""
from flask import Blueprint, jsonify, request
from sqlalchemy import select

from app.database import SessionLocal
from app.models import Asset

assets_bp = Blueprint("assets", __name__, url_prefix="/api/assets")


@assets_bp.get("")
def list_assets():
    """List assets with optional query filters (status, category, search)."""
    status = request.args.get("status")
    search = request.args.get("q")

    with SessionLocal() as session:
        query = select(Asset).where(Asset.deleted_at.is_(None))

        if status:
            query = query.where(Asset.status == status.upper())
        if search:
            query = query.where(
                Asset.name.ilike(f"%{search}%")
                | Asset.inventory_code.ilike(f"%{search}%")
                | Asset.serial_number.ilike(f"%{search}%")
            )

        assets = session.scalars(query.limit(100)).all()

        return jsonify({
            "status": "success",
            "data": [
                {
                    "id": a.id,
                    "inventory_code": a.inventory_code,
                    "name": a.name,
                    "brand": a.brand,
                    "model": a.model,
                    "serial_number": a.serial_number,
                    "status": a.status,
                    "condition": a.condition,
                    "category_id": a.category_id,
                    "location_id": a.location_id,
                    "is_borrowable": a.is_borrowable,
                }
                for a in assets
            ],
            "count": len(assets),
        }), 200


@assets_bp.get("/<int:asset_id>")
def get_asset(asset_id: int):
    """Get single asset detail by ID."""
    with SessionLocal() as session:
        asset = session.get(Asset, asset_id)
        if not asset or asset.deleted_at is not None:
            return jsonify({"status": "error", "message": "Asset not found"}), 404

        return jsonify({
            "status": "success",
            "data": {
                "id": asset.id,
                "inventory_code": asset.inventory_code,
                "name": asset.name,
                "brand": asset.brand,
                "model": asset.model,
                "serial_number": asset.serial_number,
                "status": asset.status,
                "condition": asset.condition,
                "acquisition_cost": str(asset.acquisition_cost) if asset.acquisition_cost else None,
                "is_borrowable": asset.is_borrowable,
            },
        }), 200
