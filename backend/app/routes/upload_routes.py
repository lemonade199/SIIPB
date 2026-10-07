"""File and evidence upload routes."""
from flask import Blueprint, request

from app.middleware.auth_middleware import any_permission_required
from app.services.storage_service import save_upload_file
from app.utils.response import error_response, success_response

upload_bp = Blueprint("uploads", __name__, url_prefix="/api/v1/uploads")


@upload_bp.post("")
@any_permission_required("inventory.manage", "return.manage")
def upload_file():
    """Upload photo evidence or document.
    ---
    tags:
      - Uploads
    security:
      - Bearer: []
    consumes:
      - multipart/form-data
    parameters:
      - in: formData
        name: file
        type: file
        required: true
      - in: formData
        name: folder
        type: string
        default: evidence
    responses:
      200:
        description: File berhasil diunggah
      400:
        description: File tidak valid
    """
    if "file" not in request.files:
        return error_response("File tidak ditemukan dalam request form-data", status_code=400)

    file_obj = request.files["file"]
    folder = request.form.get("folder", "evidence")

    try:
        url_path = save_upload_file(file_obj, folder_prefix=folder)
        return success_response(
            data={"file_url": url_path},
            message="File berhasil diunggah",
            status_code=201,
        )
    except ValueError as e:
        return error_response(str(e), status_code=400)
