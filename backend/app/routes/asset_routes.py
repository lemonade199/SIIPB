"""Asset and Inventory Management Routes."""
from flask import Blueprint, g, request

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required, permission_required
from app.schemas.asset_schema import AssetCreateSchema, AssetUpdateSchema
from app.services.asset_service import (
    create_asset,
    delete_asset,
    get_asset_by_id,
    get_asset_history,
    get_assets,
    update_asset,
)
from app.services.storage_service import save_upload_file
from app.utils.response import error_response, success_response

asset_bp = Blueprint("assets", __name__, url_prefix="/api/v1/assets")


def serialize_asset(asset) -> dict:
    return {
        "id": asset.id,
        "inventory_code": asset.inventory_code,
        "category_id": asset.category_id,
        "category_name": asset.category.name if asset.category else None,
        "location_id": asset.location_id,
        "location_name": asset.location.name if asset.location else None,
        "owner_unit_id": asset.owner_unit_id,
        "owner_unit_name": asset.owner_unit.name if asset.owner_unit else None,
        "name": asset.name,
        "brand": asset.brand,
        "model": asset.model,
        "serial_number": asset.serial_number,
        "description": asset.description,
        "photo_path": asset.photo_path,
        "purchase_date": asset.purchase_date.isoformat() if asset.purchase_date else None,
        "acquisition_cost": float(asset.acquisition_cost) if asset.acquisition_cost is not None else None,
        "status": asset.status,
        "condition": asset.condition,
        "is_active": asset.is_active,
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else None,
    }


@asset_bp.get("")
@jwt_required
def list_assets():
    """List assets with filtering and pagination.
    ---
    tags:
      - Assets
    security:
      - Bearer: []
    parameters:
      - in: query
        name: search
        type: string
      - in: query
        name: category_id
        type: integer
      - in: query
        name: location_id
        type: integer
      - in: query
        name: status
        type: string
        enum: [TERSEDIA, DIPINJAM, RUSAK, RUSAK_BERAT, HILANG, PEMELIHARAAN, NONAKTIF]
      - in: query
        name: condition
        type: string
        enum: [BAIK, RUSAK_RINGAN, RUSAK_BERAT]
      - in: query
        name: page
        type: integer
        default: 1
      - in: query
        name: per_page
        type: integer
        default: 20
    responses:
      200:
        description: Daftar aset berhasil diambil
    """
    search = request.args.get("search")
    category_id = request.args.get("category_id", type=int)
    location_id = request.args.get("location_id", type=int)
    status = request.args.get("status")
    condition = request.args.get("condition")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    with SessionLocal() as session:
        items, total = get_assets(
            session=session,
            search=search,
            category_id=category_id,
            location_id=location_id,
            status=status,
            condition=condition,
            page=page,
            per_page=per_page,
        )
        return success_response(
            data=[serialize_asset(a) for a in items],
            meta={"page": page, "per_page": per_page, "total": total},
            message="Daftar aset berhasil diambil",
        )


@asset_bp.get("/<int:asset_id>")
@jwt_required
def get_asset_detail(asset_id: int):
    """Get single asset detail.
    ---
    tags:
      - Assets
    security:
      - Bearer: []
    responses:
      200:
        description: Detail aset berhasil diambil
      404:
        description: Aset tidak ditemukan
    """
    with SessionLocal() as session:
        asset = get_asset_by_id(session, asset_id)
        if not asset:
            return error_response("Aset tidak ditemukan", status_code=404)
        return success_response(data=serialize_asset(asset), message="Detail aset berhasil diambil")


@asset_bp.post("")
@permission_required("asset.create")
def add_asset():
    """Register a new asset.
    ---
    tags:
      - Assets
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required:
            - inventory_code
            - category_id
            - name
    responses:
      201:
        description: Aset berhasil ditambahkan
      400:
        description: Validasi input gagal
    """
    data = request.get_json(silent=True) or {}
    schema = AssetCreateSchema()
    errors = schema.validate(data)
    if errors:
        return error_response("Validasi input aset gagal", error_code="VALIDATION_ERROR", errors=errors)

    with SessionLocal() as session:
        try:
            asset = create_asset(session, data, user_id=g.current_user["id"])
            return success_response(
                data=serialize_asset(asset),
                message="Aset berhasil ditambahkan ke inventaris",
                status_code=201,
            )
        except ValueError as e:
            return error_response(str(e), status_code=400)


@asset_bp.put("/<int:asset_id>")
@permission_required("asset.update")
def edit_asset(asset_id: int):
    """Update existing asset details.
    ---
    tags:
      - Assets
    security:
      - Bearer: []
    responses:
      200:
        description: Aset berhasil diperbarui
      404:
        description: Aset tidak ditemukan
    """
    data = request.get_json(silent=True) or {}
    schema = AssetUpdateSchema()
    errors = schema.validate(data)
    if errors:
        return error_response("Validasi input gagal", error_code="VALIDATION_ERROR", errors=errors)

    with SessionLocal() as session:
        try:
            asset = update_asset(session, asset_id, data, user_id=g.current_user["id"])
            return success_response(data=serialize_asset(asset), message="Aset berhasil diperbarui")
        except ValueError as e:
            return error_response(str(e), status_code=404 if "tidak ditemukan" in str(e) else 400)


@asset_bp.delete("/<int:asset_id>")
@permission_required("asset.delete")
def remove_asset(asset_id: int):
    """Soft delete / deactivate an asset.
    ---
    tags:
      - Assets
    security:
      - Bearer: []
    responses:
      200:
        description: Aset berhasil dinonaktifkan
      400:
        description: Gagal menonaktifkan aset
    """
    with SessionLocal() as session:
        try:
            delete_asset(session, asset_id, user_id=g.current_user["id"])
            return success_response(message="Aset berhasil dinonaktifkan")
        except ValueError as e:
            return error_response(str(e), status_code=400)


@asset_bp.get("/<int:asset_id>/history")
@jwt_required
def list_asset_history(asset_id: int):
    """Get audit timeline / history for an asset.
    ---
    tags:
      - Assets
    security:
      - Bearer: []
    responses:
      200:
        description: Riwayat pergerakan aset berhasil diambil
    """
    with SessionLocal() as session:
        asset = get_asset_by_id(session, asset_id)
        if not asset:
            return error_response("Aset tidak ditemukan", status_code=404)

        histories = get_asset_history(session, asset_id)
        return success_response(
            data=[
                {
                    "id": h.id,
                    "event_type": h.event_type,
                    "old_status": h.old_status,
                    "new_status": h.new_status,
                    "old_location_id": h.old_location_id,
                    "new_location_id": h.new_location_id,
                    "old_condition": h.old_condition,
                    "new_condition": h.new_condition,
                    "reason": h.reason,
                    "changed_by": h.changed_by,
                    "created_at": h.created_at.isoformat() if h.created_at else None,
                }
                for h in histories
            ],
            message="Riwayat pergerakan aset berhasil diambil",
        )


@asset_bp.post("/<int:asset_id>/upload-photo")
@permission_required("asset.update")
def upload_asset_photo(asset_id: int):
    """Upload photo for asset.
    ---
    tags:
      - Assets
    security:
      - Bearer: []
    consumes:
      - multipart/form-data
    parameters:
      - in: formData
        name: file
        type: file
        required: true
    responses:
      200:
        description: Foto aset berhasil diunggah
    """
    if "file" not in request.files:
        return error_response("File tidak ditemukan dalam request form-data", status_code=400)

    file_obj = request.files["file"]
    with SessionLocal() as session:
        asset = get_asset_by_id(session, asset_id)
        if not asset:
            return error_response("Aset tidak ditemukan", status_code=404)

        try:
            file_url = save_upload_file(file_obj, folder_prefix="assets")
            asset.photo_path = file_url
            session.commit()
            return success_response(data={"photo_path": file_url}, message="Foto aset berhasil diunggah")
        except ValueError as e:
            return error_response(str(e), status_code=400)
