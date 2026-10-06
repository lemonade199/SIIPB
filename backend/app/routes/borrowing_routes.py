"""Borrowing management routes with concurrent transaction support."""
from flask import Blueprint, g, request

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required, permission_required
from app.schemas.borrowing_schema import BorrowingCreateSchema
from app.services.borrowing_service import (
    checkout_borrowing,
    get_borrowing_by_id,
    get_borrowings,
)
from app.utils.response import error_response, success_response

borrowing_bp = Blueprint("borrowings", __name__, url_prefix="/api/v1/borrowings")


def serialize_borrowing(b) -> dict:
    return {
        "id": b.id,
        "transaction_number": b.transaction_number,
        "borrower_id": b.borrower_id,
        "borrower": {
            "id": b.borrower.id,
            "name": b.borrower.name,
            "identity_number": b.borrower.identity_number,
            "email": b.borrower.email,
            "phone": b.borrower.phone,
        } if b.borrower else None,
        "handled_by": b.handled_by,
        "handler_name": b.handler.full_name if b.handler else None,
        "borrowed_at": b.borrowed_at.isoformat() if hasattr(b.borrowed_at, "isoformat") else (str(b.borrowed_at) if b.borrowed_at else None),
        "start_date": b.start_date.isoformat() if hasattr(b.start_date, "isoformat") else (str(b.start_date) if b.start_date else None),
        "due_date": b.due_date.isoformat() if hasattr(b.due_date, "isoformat") else (str(b.due_date) if b.due_date else None),
        "status": b.status,
        "purpose": b.purpose,
        "notes": b.notes,
        "items": [
            {
                "id": it.id,
                "asset_id": it.asset_id,
                "asset_name": it.asset.name if it.asset else None,
                "inventory_code": it.asset.inventory_code if it.asset else None,
                "checked_out_at": it.checked_out_at.isoformat() if it.checked_out_at else None,
            }
            for it in b.items
        ],
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


@borrowing_bp.get("")
@jwt_required
def list_borrowings():
    """List borrowing transactions with filtering and pagination.
    ---
    tags:
      - Borrowings
    security:
      - Bearer: []
    parameters:
      - in: query
        name: status
        type: string
        enum: [AKTIF, DIKEMBALIKAN, TERLAMBAT, DIBATALKAN]
      - in: query
        name: borrower_id
        type: integer
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
        description: Daftar peminjaman berhasil diambil
    """
    status = request.args.get("status")
    borrower_id = request.args.get("borrower_id", type=int)
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    with SessionLocal() as session:
        items, total = get_borrowings(
            session=session,
            status=status,
            borrower_id=borrower_id,
            page=page,
            per_page=per_page,
        )
        return success_response(
            data=[serialize_borrowing(b) for b in items],
            meta={"page": page, "per_page": per_page, "total": total},
            message="Daftar transaksi peminjaman berhasil diambil",
        )


@borrowing_bp.get("/<int:borrowing_id>")
@jwt_required
def get_borrowing_detail(borrowing_id: int):
    """Get single borrowing transaction detail.
    ---
    tags:
      - Borrowings
    security:
      - Bearer: []
    responses:
      200:
        description: Detail transaksi peminjaman berhasil diambil
      404:
        description: Transaksi tidak ditemukan
    """
    with SessionLocal() as session:
        borrowing = get_borrowing_by_id(session, borrowing_id)
        if not borrowing:
            return error_response("Transaksi peminjaman tidak ditemukan", status_code=404)
        return success_response(
            data=serialize_borrowing(borrowing),
            message="Detail transaksi peminjaman berhasil diambil",
        )


@borrowing_bp.post("")
@permission_required("borrowing.create")
def create_borrowing_transaction():
    """Create checkout borrowing transaction.
    Uses database row-locking (SELECT ... FOR UPDATE) to ensure concurrency safety.
    ---
    tags:
      - Borrowings
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required:
            - borrower_id
            - start_date
            - due_date
            - asset_ids
          properties:
            borrower_id:
              type: integer
            start_date:
              type: string
              format: date
            due_date:
              type: string
              format: date
            purpose:
              type: string
            notes:
              type: string
            asset_ids:
              type: array
              items:
                type: integer
    responses:
      201:
        description: Peminjaman berhasil dibuat
      400:
        description: Validasi gagal atau aset tidak tersedia
    """
    data = request.get_json(silent=True) or {}
    schema = BorrowingCreateSchema()
    errors = schema.validate(data)
    if errors:
        return error_response("Validasi input peminjaman gagal", error_code="VALIDATION_ERROR", errors=errors)

    with SessionLocal() as session:
        try:
            borrowing = checkout_borrowing(
                session=session,
                borrower_id=data["borrower_id"],
                handled_by=g.current_user["id"],
                start_date=data["start_date"],
                due_date=data["due_date"],
                asset_ids=data["asset_ids"],
                purpose=data.get("purpose"),
                notes=data.get("notes"),
            )
            return success_response(
                data=serialize_borrowing(borrowing),
                message=f"Peminjaman berhasil dicatat dengan nomor transaksi {borrowing.transaction_number}",
                status_code=201,
            )
        except ValueError as e:
            return error_response(str(e), error_code="CHECKOUT_FAILED", status_code=400)
