"""Master data: unit kerja, kategori, lokasi, peminjam (tanpa akun)."""
from flask import Blueprint, g, request
from marshmallow import ValidationError

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required, permission_required
from app.schemas.master_schema import BorrowerSchema, CategorySchema, LocationSchema, OrganizationalUnitSchema
from app.services.master_service import MasterError, create_row, delete_row, get_borrowers, list_rows, update_row
from app.utils.response import error_response, success_response

master_bp = Blueprint("master", __name__, url_prefix="/api/v1")


def ser_unit(u):
    return {"id": u.id, "code": u.code, "name": u.name, "parent_id": u.parent_id, "description": u.description, "is_active": u.is_active}


def ser_category(c):
    return {"id": c.id, "code": c.code, "name": c.name, "description": c.description, "is_active": c.is_active}


def ser_location(l):
    return {"id": l.id, "code": l.code, "name": l.name, "parent_id": l.parent_id,
            "parent_name": l.parent.name if l.parent else None, "description": l.description, "is_active": l.is_active}


def ser_borrower(b):
    return {"id": b.id, "name": b.name, "identity_number": b.identity_number, "email": b.email, "phone": b.phone,
            "position": b.position, "unit_id": b.unit_id, "unit_name": b.unit.name if b.unit else None, "is_active": b.is_active}


RESOURCES = {
    # path: (kind, schema, serializer, label)
    "organizational-units": ("unit", OrganizationalUnitSchema, ser_unit, "Unit kerja"),
    "categories": ("category", CategorySchema, ser_category, "Kategori"),
    "locations": ("location", LocationSchema, ser_location, "Lokasi"),
}


def _all() -> bool:
    return request.args.get("all") in ("1", "true") or request.args.get("include_inactive") in ("1", "true")


def _err(e: MasterError):
    return error_response(str(e), error_code="NOT_FOUND" if e.status == 404 else "VALIDATION_ERROR",
                          status_code=e.status, errors=e.errors or None)


def _register(path: str, kind: str, schema_cls, ser, label: str):
    def index():
        with SessionLocal() as session:
            return success_response(data=[ser(r) for r in list_rows(session, kind, include_inactive=_all())])

    def create():
        try:
            data = schema_cls().load(request.get_json(silent=True) or {})
        except ValidationError as err:
            return error_response("Validasi gagal", error_code="VALIDATION_ERROR", errors=err.messages)
        with SessionLocal() as session:
            try:
                row = create_row(session, kind, data, g.current_user["id"])
            except MasterError as e:
                return _err(e)
            return success_response(data=ser(row), message=f"{label} ditambahkan", status_code=201)

    def update(row_id: int):
        try:
            data = schema_cls(partial=True).load(request.get_json(silent=True) or {})
        except ValidationError as err:
            return error_response("Validasi gagal", error_code="VALIDATION_ERROR", errors=err.messages)
        with SessionLocal() as session:
            try:
                row = update_row(session, kind, row_id, data, g.current_user["id"])
            except MasterError as e:
                return _err(e)
            return success_response(data=ser(row), message=f"{label} diperbarui")

    def delete(row_id: int):
        with SessionLocal() as session:
            try:
                delete_row(session, kind, row_id, g.current_user["id"])
            except MasterError as e:
                return _err(e)
            return success_response(message=f"{label} dihapus")

    doc = f"""{label}.
    ---
    tags: [Master Data]
    security: [{{Bearer: []}}]
    parameters:
      - {{in: query, name: all, type: boolean, description: sertakan data nonaktif}}
    responses:
      200: {{description: OK}}
    """
    for fn, verb in ((index, "Daftar"), (create, "Tambah"), (update, "Ubah"), (delete, "Hapus")):
        fn.__doc__ = f"{verb} {doc}"
        fn.__name__ = f"{kind}_{fn.__name__}"
    master_bp.add_url_rule(f"/{path}", view_func=jwt_required(index), methods=["GET"])
    master_bp.add_url_rule(f"/{path}", view_func=permission_required("masterdata.manage")(create), methods=["POST"])
    master_bp.add_url_rule(f"/{path}/<int:row_id>", view_func=permission_required("masterdata.manage")(update), methods=["PUT"])
    master_bp.add_url_rule(f"/{path}/<int:row_id>", view_func=permission_required("masterdata.manage")(delete), methods=["DELETE"])


for _path, (_kind, _schema, _ser, _label) in RESOURCES.items():
    _register(_path, _kind, _schema, _ser, _label)


# ---- Peminjam (TANPA AKUN) ----
@master_bp.get("/borrowers")
@jwt_required
def list_borrowers():
    """Daftar peminjam (pegawai/siswa; tidak memiliki akun).
    ---
    tags: [Master Data]
    security: [{Bearer: []}]
    parameters:
      - {in: query, name: search, type: string}
      - {in: query, name: unit_id, type: integer}
      - {in: query, name: all, type: boolean}
      - {in: query, name: page, type: integer, default: 1}
      - {in: query, name: per_page, type: integer, default: 20}
    responses:
      200: {description: Daftar peminjam}
    """
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))
    with SessionLocal() as session:
        items, total = get_borrowers(session, search=request.args.get("search"), unit_id=request.args.get("unit_id", type=int),
                                     active_only=not _all(), page=page, per_page=per_page)
        return success_response(data=[ser_borrower(b) for b in items], meta={"page": page, "per_page": per_page, "total": total})


@master_bp.post("/borrowers")
@permission_required("masterdata.manage")
def add_borrower():
    """Tambah peminjam.
    ---
    tags: [Master Data]
    security: [{Bearer: []}]
    responses:
      201: {description: Peminjam ditambahkan}
    """
    try:
        data = BorrowerSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        try:
            b = create_row(session, "borrower", data, g.current_user["id"])
        except MasterError as e:
            return _err(e)
        return success_response(data=ser_borrower(b), message="Data peminjam berhasil ditambahkan", status_code=201)


@master_bp.put("/borrowers/<int:borrower_id>")
@permission_required("masterdata.manage")
def edit_borrower(borrower_id: int):
    """Ubah / aktif-nonaktifkan peminjam.
    ---
    tags: [Master Data]
    security: [{Bearer: []}]
    responses:
      200: {description: Peminjam diperbarui}
    """
    try:
        data = BorrowerSchema(partial=True).load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        try:
            b = update_row(session, "borrower", borrower_id, data, g.current_user["id"])
        except MasterError as e:
            return _err(e)
        return success_response(data=ser_borrower(b), message="Data peminjam berhasil diubah")


@master_bp.delete("/borrowers/<int:borrower_id>")
@permission_required("masterdata.manage")
def remove_borrower(borrower_id: int):
    """Hapus peminjam yang belum pernah bertransaksi.
    ---
    tags: [Master Data]
    security: [{Bearer: []}]
    responses:
      200: {description: Peminjam dihapus}
    """
    with SessionLocal() as session:
        try:
            delete_row(session, "borrower", borrower_id, g.current_user["id"])
        except MasterError as e:
            return _err(e)
        return success_response(message="Data peminjam dihapus")
