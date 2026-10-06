"""Master data routes for Organizational Units, Categories, Locations, and Borrowers."""
from flask import Blueprint, g, request

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required, permission_required
from app.schemas.master_schema import (
    BorrowerSchema,
    CategorySchema,
    LocationSchema,
    OrganizationalUnitSchema,
)
from app.services.master_service import (
    create_borrower,
    create_category,
    create_location,
    create_unit,
    delete_borrower,
    get_borrowers,
    get_categories,
    get_locations,
    get_units,
    update_borrower,
)
from app.utils.response import error_response, success_response

master_bp = Blueprint("master", __name__, url_prefix="/api/v1")


# ---- Organizational Units ----
@master_bp.get("/organizational-units")
@jwt_required
def list_units():
    with SessionLocal() as session:
        units = get_units(session)
        return success_response(
            data=[{"id": u.id, "code": u.code, "name": u.name, "parent_id": u.parent_id, "is_active": u.is_active} for u in units]
        )


@master_bp.post("/organizational-units")
@permission_required("settings.manage")
def add_unit():
    data = request.get_json(silent=True) or {}
    errors = OrganizationalUnitSchema().validate(data)
    if errors:
        return error_response("Validasi gagal", errors=errors)

    with SessionLocal() as session:
        try:
            u = create_unit(session, data, g.current_user["id"])
            return success_response(data={"id": u.id, "code": u.code, "name": u.name}, message="Unit berhasil dibuat", status_code=201)
        except Exception as e:
            return error_response(str(e))


# ---- Categories ----
@master_bp.get("/categories")
@jwt_required
def list_categories():
    with SessionLocal() as session:
        cats = get_categories(session)
        return success_response(
            data=[{"id": c.id, "code": c.code, "name": c.name, "description": c.description} for c in cats]
        )


@master_bp.post("/categories")
@permission_required("asset.create")
def add_category():
    data = request.get_json(silent=True) or {}
    errors = CategorySchema().validate(data)
    if errors:
        return error_response("Validasi gagal", errors=errors)

    with SessionLocal() as session:
        try:
            c = create_category(session, data, g.current_user["id"])
            return success_response(data={"id": c.id, "code": c.code, "name": c.name}, message="Kategori berhasil dibuat", status_code=201)
        except Exception as e:
            return error_response(str(e))


# ---- Locations ----
@master_bp.get("/locations")
@jwt_required
def list_locations():
    with SessionLocal() as session:
        locs = get_locations(session)
        return success_response(
            data=[{"id": l.id, "code": l.code, "name": l.name, "parent_id": l.parent_id} for l in locs]
        )


@master_bp.post("/locations")
@permission_required("asset.create")
def add_location():
    data = request.get_json(silent=True) or {}
    errors = LocationSchema().validate(data)
    if errors:
        return error_response("Validasi gagal", errors=errors)

    with SessionLocal() as session:
        try:
            l = create_location(session, data, g.current_user["id"])
            return success_response(data={"id": l.id, "code": l.code, "name": l.name}, message="Lokasi berhasil dibuat", status_code=201)
        except Exception as e:
            return error_response(str(e))


# ---- Borrowers (Peminjam TANPA AKUN) ----
@master_bp.get("/borrowers")
@jwt_required
def list_borrowers():
    search = request.args.get("search")
    unit_id = request.args.get("unit_id", type=int)
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    with SessionLocal() as session:
        items, total = get_borrowers(session, search=search, unit_id=unit_id, page=page, per_page=per_page)
        return success_response(
            data=[
                {
                    "id": b.id,
                    "name": b.name,
                    "identity_number": b.identity_number,
                    "email": b.email,
                    "phone": b.phone,
                    "position": b.position,
                    "unit_id": b.unit_id,
                    "unit_name": b.unit.name if b.unit else None,
                    "is_active": b.is_active,
                }
                for b in items
            ],
            meta={"page": page, "per_page": per_page, "total": total},
        )


@master_bp.post("/borrowers")
@permission_required("borrowing.create")
def add_borrower():
    data = request.get_json(silent=True) or {}
    errors = BorrowerSchema().validate(data)
    if errors:
        return error_response("Validasi gagal", errors=errors)

    with SessionLocal() as session:
        try:
            b = create_borrower(session, data, g.current_user["id"])
            return success_response(
                data={"id": b.id, "name": b.name, "email": b.email},
                message="Data peminjam berhasil ditambahkan",
                status_code=201,
            )
        except Exception as e:
            return error_response(str(e))


@master_bp.put("/borrowers/<int:borrower_id>")
@permission_required("borrowing.create")
def edit_borrower(borrower_id: int):
    data = request.get_json(silent=True) or {}
    with SessionLocal() as session:
        try:
            b = update_borrower(session, borrower_id, data, g.current_user["id"])
            return success_response(data={"id": b.id, "name": b.name}, message="Data peminjam berhasil diubah")
        except ValueError as e:
            return error_response(str(e), status_code=404)


@master_bp.delete("/borrowers/<int:borrower_id>")
@permission_required("borrowing.create")
def remove_borrower(borrower_id: int):
    with SessionLocal() as session:
        try:
            delete_borrower(session, borrower_id, g.current_user["id"])
            return success_response(message="Data peminjam berhasil dinonaktifkan")
        except ValueError as e:
            return error_response(str(e), status_code=404)
        except Exception as e:
            return error_response("Peminjam memiliki histori transaksi aktif dan tidak dapat dihapus", status_code=400)
