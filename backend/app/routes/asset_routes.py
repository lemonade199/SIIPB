"""Inventaris barang. Tersedia di /api/v1/assets dan alias dokumen Plan /api/v1/items."""
import io

from flask import Blueprint, Response, g, request
from marshmallow import ValidationError

from app.database import SessionLocal
from app.middleware.auth_middleware import permission_required
from app.schemas.asset_schema import AssetCreateSchema, AssetStatusSchema, AssetUpdateSchema
from app.services.asset_service import (
    MAX_PHOTOS,
    AssetError,
    add_photos,
    change_status,
    create_asset,
    delete_asset,
    get_asset_by_id,
    get_asset_history,
    get_assets,
    remove_photo,
    reorder_photos,
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
        "photos": [{"id": p.id, "path": p.path} for p in asset.photos],
        "purchase_date": asset.purchase_date.isoformat() if asset.purchase_date else None,
        "acquisition_cost": float(asset.acquisition_cost) if asset.acquisition_cost is not None else None,
        "acquisition_source": asset.acquisition_source,
        "status": asset.status,
        "condition": asset.condition,
        "is_active": asset.is_active,
        "qr_payload": f"SIIPB:{asset.inventory_code}",
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else None,
    }


def _err(e: AssetError):
    return error_response(str(e), error_code="NOT_FOUND" if e.status == 404 else "VALIDATION_ERROR",
                          status_code=e.status, errors=e.errors or None)


def _bool_arg(name: str):
    v = request.args.get(name)
    return None if v is None else v.lower() in ("1", "true", "yes")


@asset_bp.get("")
@permission_required("inventory.view")
def list_assets():
    """Daftar barang dengan filter & paginasi.
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    parameters:
      - {in: query, name: search, type: string}
      - {in: query, name: category_id, type: integer}
      - {in: query, name: location_id, type: integer}
      - {in: query, name: status, type: string, enum: [TERSEDIA, DIPINJAM, RUSAK, RUSAK_BERAT, DALAM_PERBAIKAN, HILANG]}
      - {in: query, name: condition, type: string, enum: [BAIK, RUSAK_RINGAN, RUSAK_BERAT]}
      - {in: query, name: is_active, type: boolean}
      - {in: query, name: page, type: integer, default: 1}
      - {in: query, name: per_page, type: integer, default: 20}
    responses:
      200: {description: Daftar aset}
    """
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))
    with SessionLocal() as session:
        items, total = get_assets(
            session,
            search=request.args.get("search"),
            category_id=request.args.get("category_id", type=int),
            location_id=request.args.get("location_id", type=int),
            status=request.args.get("status"),
            condition=request.args.get("condition"),
            is_active=_bool_arg("is_active"),
            page=page,
            per_page=per_page,
        )
        return success_response(
            data=[serialize_asset(a) for a in items],
            meta={"page": page, "per_page": per_page, "total": total},
            message="Daftar aset berhasil diambil",
        )


@asset_bp.get("/<int:asset_id>")
@permission_required("inventory.view")
def get_asset_detail(asset_id: int):
    """Detail barang.
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    responses:
      200: {description: Detail aset}
      404: {description: Tidak ditemukan}
    """
    with SessionLocal() as session:
        asset = get_asset_by_id(session, asset_id)
        if not asset:
            return error_response("Aset tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        return success_response(data=serialize_asset(asset), message="Detail aset berhasil diambil")


@asset_bp.get("/by-code/<path:code>")
@permission_required("inventory.view")
def get_asset_by_qr(code: str):
    """Cari barang dari hasil pindai QR/barcode (`SIIPB:<kode>` atau kode saja).
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    responses:
      200: {description: Detail aset}
      404: {description: Tidak ditemukan}
    """
    from app.services.asset_service import get_asset_by_code

    code = code.strip()
    if code.upper().startswith("SIIPB:"):
        code = code[6:]
    with SessionLocal() as session:
        asset = get_asset_by_code(session, code)
        if not asset or asset.deleted_at is not None:
            return error_response("Barang dengan kode tersebut tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        return success_response(data=serialize_asset(asset))


@asset_bp.post("")
@permission_required("inventory.manage")
def add_asset():
    """Tambah barang. `inventory_code` kosong -> dibuat otomatis (INV-<KATEGORI>-0001).
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required: [category_id, name]
          properties:
            inventory_code: {type: string}
            category_id: {type: integer}
            location_id: {type: integer}
            name: {type: string}
            brand: {type: string}
            model: {type: string}
            serial_number: {type: string}
            purchase_date: {type: string, format: date}
            acquisition_cost: {type: number}
            acquisition_source: {type: string}
            condition: {type: string, enum: [BAIK, RUSAK_RINGAN, RUSAK_BERAT]}
            status: {type: string, enum: [TERSEDIA, RUSAK, RUSAK_BERAT, DALAM_PERBAIKAN, HILANG]}
            description: {type: string}
    responses:
      201: {description: Aset ditambahkan}
      400: {description: Validasi gagal}
    """
    try:
        data = AssetCreateSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi input aset gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        try:
            asset = create_asset(session, data, user_id=g.current_user["id"])
        except AssetError as e:
            return _err(e)
        return success_response(data=serialize_asset(asset), message="Aset berhasil ditambahkan ke inventaris", status_code=201)


@asset_bp.put("/<int:asset_id>")
@permission_required("inventory.manage")
def edit_asset(asset_id: int):
    """Ubah data barang / aktif-nonaktif (`is_active`, dengan `reason`).
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    responses:
      200: {description: Aset diperbarui}
      404: {description: Tidak ditemukan}
    """
    try:
        data = AssetUpdateSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi input gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        try:
            asset = update_asset(session, asset_id, data, user_id=g.current_user["id"])
        except AssetError as e:
            return _err(e)
        return success_response(data=serialize_asset(asset), message="Aset berhasil diperbarui")


@asset_bp.post("/<int:asset_id>/status")
@permission_required("inventory.manage")
def set_status(asset_id: int):
    """Ubah status barang secara manual (mis. selesai diperbaiki). DIPINJAM hanya lewat checkout.
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required: [status]
          properties:
            status: {type: string, enum: [TERSEDIA, RUSAK, RUSAK_BERAT, DALAM_PERBAIKAN, HILANG]}
            reason: {type: string}
    responses:
      200: {description: Status diperbarui}
    """
    try:
        data = AssetStatusSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi status gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        try:
            asset = change_status(session, asset_id, data["status"], (data.get("reason") or "").strip(), g.current_user["id"])
        except AssetError as e:
            return _err(e)
        return success_response(data=serialize_asset(asset), message=f"Status barang menjadi {asset.status}")


@asset_bp.delete("/<int:asset_id>")
@permission_required("inventory.manage")
def remove_asset(asset_id: int):
    """Nonaktifkan barang (riwayat tetap tersimpan).
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    responses:
      200: {description: Aset dinonaktifkan}
    """
    with SessionLocal() as session:
        try:
            delete_asset(session, asset_id, user_id=g.current_user["id"])
        except AssetError as e:
            return _err(e)
        return success_response(message="Aset berhasil dinonaktifkan")


@asset_bp.get("/<int:asset_id>/history")
@permission_required("inventory.view")
def list_asset_history(asset_id: int):
    """Riwayat pergerakan & status barang.
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    responses:
      200: {description: Riwayat aset}
    """
    with SessionLocal() as session:
        if not get_asset_by_id(session, asset_id):
            return error_response("Aset tidak ditemukan", error_code="NOT_FOUND", status_code=404)
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
                    "changed_by_name": h.changer.full_name if h.changer else None,
                    "created_at": h.created_at.isoformat() if h.created_at else None,
                }
                for h in get_asset_history(session, asset_id)
            ],
            message="Riwayat pergerakan aset berhasil diambil",
        )


def _upload_limit_mb(session) -> int:
    from app.services.settings_service import get_settings

    try:
        return int(get_settings(session)["security"].get("upload_max_mb") or 5)
    except (TypeError, ValueError):
        return 5


@asset_bp.post("/<int:asset_id>/photos")
@permission_required("inventory.manage")
def upload_photos(asset_id: int):
    """Unggah satu/lebih foto barang (field `files` atau `file`, maks 5 foto per barang, JPG/PNG/WEBP).
    `primary=true` menjadikan foto baru sebagai foto utama.
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    consumes: [multipart/form-data]
    parameters:
      - {in: formData, name: files, type: file, required: true}
      - {in: formData, name: primary, type: boolean}
    responses:
      200: {description: Foto diunggah}
    """
    files = request.files.getlist("files") or request.files.getlist("file")
    if not files:
        return error_response("File tidak ditemukan dalam form-data", error_code="VALIDATION_ERROR")
    with SessionLocal() as session:
        asset = get_asset_by_id(session, asset_id)
        if not asset:
            return error_response("Aset tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        if len(asset.photos) + len(files) > MAX_PHOTOS:
            return error_response(f"Maksimal {MAX_PHOTOS} foto per barang", error_code="VALIDATION_ERROR")
        try:
            limit = _upload_limit_mb(session)
            paths = [save_upload_file(f, "assets", images_only=True, max_mb=limit) for f in files]
            asset = add_photos(session, asset, paths, g.current_user["id"], primary=request.form.get("primary") in ("1", "true"))
        except (ValueError, AssetError) as e:
            return error_response(str(e), error_code="VALIDATION_ERROR")
        return success_response(data=serialize_asset(asset), message="Foto barang diunggah")


@asset_bp.post("/<int:asset_id>/upload-photo")
@permission_required("inventory.manage")
def upload_asset_photo(asset_id: int):
    """(Kompatibilitas) unggah satu foto sebagai foto utama.
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    consumes: [multipart/form-data]
    parameters:
      - {in: formData, name: file, type: file, required: true}
    responses:
      200: {description: Foto diunggah}
    """
    if "file" not in request.files:
        return error_response("File tidak ditemukan dalam request form-data", error_code="VALIDATION_ERROR")
    with SessionLocal() as session:
        asset = get_asset_by_id(session, asset_id)
        if not asset:
            return error_response("Aset tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        try:
            path = save_upload_file(request.files["file"], "assets", images_only=True, max_mb=_upload_limit_mb(session))
            asset = add_photos(session, asset, [path], g.current_user["id"], primary=True)
        except (ValueError, AssetError) as e:
            return error_response(str(e), error_code="VALIDATION_ERROR")
        return success_response(data={"photo_path": asset.photo_path, **serialize_asset(asset)}, message="Foto aset berhasil diunggah")


@asset_bp.delete("/<int:asset_id>/photos/<int:photo_id>")
@permission_required("inventory.manage")
def delete_photo(asset_id: int, photo_id: int):
    """Hapus satu foto barang.
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    responses:
      200: {description: Foto dihapus}
    """
    with SessionLocal() as session:
        asset = get_asset_by_id(session, asset_id)
        if not asset:
            return error_response("Aset tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        try:
            asset = remove_photo(session, asset, photo_id, g.current_user["id"])
        except AssetError as e:
            return _err(e)
        return success_response(data=serialize_asset(asset), message="Foto dihapus")


@asset_bp.put("/<int:asset_id>/photos/order")
@permission_required("inventory.manage")
def order_photos(asset_id: int):
    """Atur urutan foto (`photo_ids`, indeks 0 = foto utama).
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    responses:
      200: {description: Urutan disimpan}
    """
    ids = (request.get_json(silent=True) or {}).get("photo_ids") or []
    with SessionLocal() as session:
        asset = get_asset_by_id(session, asset_id)
        if not asset:
            return error_response("Aset tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        try:
            asset = reorder_photos(session, asset, [int(i) for i in ids], g.current_user["id"])
        except (AssetError, ValueError, TypeError) as e:
            return error_response(str(e), error_code="VALIDATION_ERROR")
        return success_response(data=serialize_asset(asset), message="Urutan foto disimpan")


@asset_bp.get("/<int:asset_id>/qr")
@permission_required("inventory.view")
def asset_qr(asset_id: int):
    """QR Code identitas barang (python `qrcode`). `format=svg` (bawaan) atau `png`.
    Isi QR: `SIIPB:<kode_inventaris>`.
    ---
    tags: [Assets]
    security: [{Bearer: []}]
    produces: [image/svg+xml, image/png]
    parameters:
      - {in: query, name: format, type: string, enum: [svg, png]}
    responses:
      200: {description: Gambar QR}
    """
    import qrcode
    import qrcode.image.svg

    fmt = (request.args.get("format") or "svg").lower()
    with SessionLocal() as session:
        asset = get_asset_by_id(session, asset_id)
        if not asset:
            return error_response("Aset tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        payload = f"SIIPB:{asset.inventory_code}"
    buf = io.BytesIO()
    if fmt == "png":
        qrcode.make(payload, box_size=10, border=2).save(buf, format="PNG")
        mime = "image/png"
    else:
        qrcode.make(payload, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2).save(buf)
        mime = "image/svg+xml"
    return Response(buf.getvalue(), mimetype=mime, headers={"Cache-Control": "private, max-age=3600"})
