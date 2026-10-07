"""Peminjaman: daftar, detail, buat (draf/checkout), ubah draf, checkout, batalkan."""
from datetime import date

from flask import Blueprint, g, request
from marshmallow import ValidationError

from app.database import SessionLocal
from app.middleware.auth_middleware import permission_required
from app.models import BorrowingStatus
from app.schemas.borrowing_schema import BorrowingCancelSchema, BorrowingCreateSchema
from app.services.borrowing_service import (
    BorrowingError,
    cancel_borrowing,
    checkout_borrowing,
    create_borrowing,
    get_borrowing_by_id,
    get_borrowings,
    update_draft,
)
from app.services.notification_service import dispatch
from app.utils.response import error_response, success_response

borrowing_bp = Blueprint("borrowings", __name__, url_prefix="/api/v1/borrowings")


def _iso(v):
    return v.isoformat() if v is not None and hasattr(v, "isoformat") else (str(v) if v else None)


def serialize_borrowing(b) -> dict:
    returned_at = max((r.returned_at for r in b.returns), default=None) if b.status == BorrowingStatus.DIKEMBALIKAN.value else None
    late_days = 0
    if b.status in (BorrowingStatus.AKTIF.value, BorrowingStatus.TERLAMBAT.value):
        late_days = max(0, (date.today() - b.due_date).days)
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
            "unit_id": b.borrower.unit_id,
        } if b.borrower else None,
        "handled_by": b.handled_by,
        "handler_name": b.handler.full_name if b.handler else None,
        "borrowed_at": _iso(b.borrowed_at),
        "start_date": _iso(b.start_date),
        "due_date": _iso(b.due_date),
        "status": b.status,
        "purpose": b.purpose,
        "notes": b.notes,
        "checked_out_at": _iso(b.checked_out_at),
        "checked_out_by": b.checked_out_by,
        "checked_out_name": b.checkout_user.full_name if b.checkout_user else None,
        "cancelled_at": _iso(b.cancelled_at),
        "cancel_reason": b.cancel_reason,
        "returned_at": _iso(returned_at),
        "late_days": late_days,
        "items": [
            {
                "id": it.id,
                "asset_id": it.asset_id,
                "asset_name": it.asset.name if it.asset else None,
                "inventory_code": it.asset.inventory_code if it.asset else None,
                "condition_out": it.condition_out,
                "checked_out_at": _iso(it.checked_out_at),
            }
            for it in b.items
        ],
        "created_at": _iso(b.created_at),
    }


def _fail(e: BorrowingError, status: int = 400):
    code = "NOT_FOUND" if "tidak ditemukan" in str(e) and not e.errors else "CHECKOUT_FAILED"
    return error_response(str(e), error_code=code, status_code=404 if code == "NOT_FOUND" else status,
                          errors=e.errors or None)


@borrowing_bp.get("")
@permission_required("borrowing.view")
def list_borrowings():
    """Daftar transaksi peminjaman.
    ---
    tags: [Borrowings]
    security: [{Bearer: []}]
    parameters:
      - {in: query, name: status, type: string, enum: [DRAF, AKTIF, TERLAMBAT, DIKEMBALIKAN, DIBATALKAN]}
      - {in: query, name: borrower_id, type: integer}
      - {in: query, name: search, type: string, description: nomor transaksi / nama peminjam}
      - {in: query, name: page, type: integer, default: 1}
      - {in: query, name: per_page, type: integer, default: 20}
    responses:
      200: {description: Daftar peminjaman}
    """
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))
    with SessionLocal() as session:
        items, total = get_borrowings(
            session,
            status=request.args.get("status"),
            borrower_id=request.args.get("borrower_id", type=int),
            search=request.args.get("search"),
            page=page,
            per_page=per_page,
        )
        return success_response(
            data=[serialize_borrowing(b) for b in items],
            meta={"page": page, "per_page": per_page, "total": total},
            message="Daftar transaksi peminjaman berhasil diambil",
        )


@borrowing_bp.get("/<int:borrowing_id>")
@permission_required("borrowing.view")
def get_borrowing_detail(borrowing_id: int):
    """Detail transaksi peminjaman.
    ---
    tags: [Borrowings]
    security: [{Bearer: []}]
    responses:
      200: {description: Detail transaksi}
      404: {description: Tidak ditemukan}
    """
    with SessionLocal() as session:
        b = get_borrowing_by_id(session, borrowing_id)
        if not b:
            return error_response("Transaksi peminjaman tidak ditemukan", error_code="NOT_FOUND", status_code=404)
        return success_response(data=serialize_borrowing(b), message="Detail transaksi peminjaman berhasil diambil")


@borrowing_bp.post("")
@permission_required("borrowing.manage")
def create_borrowing_transaction():
    """Catat peminjaman oleh petugas (peminjam tidak login).
    `checkout: true` (bawaan) langsung menyerahkan barang (status DIPINJAM + email konfirmasi);
    `checkout: false` menyimpan DRAF. Ketersediaan divalidasi dengan SELECT ... FOR UPDATE.
    ---
    tags: [Borrowings]
    security: [{Bearer: []}]
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required: [borrower_id, start_date, due_date, asset_ids]
          properties:
            borrower_id: {type: integer}
            start_date: {type: string, format: date}
            due_date: {type: string, format: date}
            purpose: {type: string}
            notes: {type: string}
            asset_ids: {type: array, items: {type: integer}}
            checkout: {type: boolean, default: true}
    responses:
      201: {description: Peminjaman dibuat}
      400: {description: Validasi gagal / barang tidak tersedia}
    """
    try:
        data = BorrowingCreateSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi input peminjaman gagal", error_code="VALIDATION_ERROR", errors=err.messages)

    with SessionLocal() as session:
        try:
            b, notif_ids = create_borrowing(session, data, g.current_user["id"], checkout=data["checkout"])
        except BorrowingError as e:
            return _fail(e)
        dispatch(notif_ids, session=session)
        session.refresh(b)
        msg = (f"Peminjaman {b.transaction_number} dicatat dan barang diserahkan" if data["checkout"]
               else f"Draf peminjaman {b.transaction_number} disimpan")
        return success_response(data=serialize_borrowing(b), message=msg, status_code=201)


@borrowing_bp.put("/<int:borrowing_id>")
@permission_required("borrowing.manage")
def edit_draft(borrowing_id: int):
    """Ubah draf peminjaman (hanya status DRAF).
    ---
    tags: [Borrowings]
    security: [{Bearer: []}]
    responses:
      200: {description: Draf diperbarui}
    """
    try:
        data = BorrowingCreateSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Validasi input peminjaman gagal", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        try:
            b = update_draft(session, borrowing_id, data, g.current_user["id"])
        except BorrowingError as e:
            return _fail(e)
        return success_response(data=serialize_borrowing(b), message="Draf peminjaman diperbarui")


@borrowing_bp.post("/<int:borrowing_id>/checkout")
@permission_required("borrowing.manage")
def checkout(borrowing_id: int):
    """Konfirmasi penyerahan barang (DRAF -> DIPINJAM) dan kirim email konfirmasi.
    ---
    tags: [Borrowings]
    security: [{Bearer: []}]
    responses:
      200: {description: Barang diserahkan}
      400: {description: Bukan draf / barang tidak tersedia}
    """
    with SessionLocal() as session:
        try:
            b, notif_ids = checkout_borrowing(session, borrowing_id, g.current_user["id"])
        except BorrowingError as e:
            return _fail(e)
        dispatch(notif_ids, session=session)
        session.refresh(b)
        return success_response(data=serialize_borrowing(b), message=f"{b.transaction_number} diserahkan kepada peminjam")


@borrowing_bp.post("/<int:borrowing_id>/cancel")
@permission_required("borrowing.manage")
def cancel(borrowing_id: int):
    """Batalkan draf peminjaman (tetap tersimpan sebagai riwayat).
    ---
    tags: [Borrowings]
    security: [{Bearer: []}]
    parameters:
      - in: body
        name: body
        schema: {type: object, required: [reason], properties: {reason: {type: string}}}
    responses:
      200: {description: Draf dibatalkan}
    """
    try:
        data = BorrowingCancelSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return error_response("Alasan pembatalan wajib diisi", error_code="VALIDATION_ERROR", errors=err.messages)
    with SessionLocal() as session:
        try:
            b = cancel_borrowing(session, borrowing_id, data["reason"].strip(), g.current_user["id"])
        except BorrowingError as e:
            return _fail(e)
        return success_response(data=serialize_borrowing(b), message="Draf dibatalkan")
