"""Return transactions and incident reports (damage & loss) routes."""
from flask import Blueprint, g, request

from app.database import SessionLocal
from app.middleware.auth_middleware import jwt_required, permission_required
from app.models.enums import RepairStatus
from app.schemas.return_schema import ReturnCreateSchema
from app.services.damage_loss_service import (
    get_damage_reports,
    get_loss_reports,
    update_damage_repair_status,
)
from app.services.return_service import get_return_by_id, get_returns, process_return
from app.utils.response import error_response, success_response

return_bp = Blueprint("returns", __name__, url_prefix="/api/v1")


def serialize_return(r) -> dict:
    items_list = []
    for it in r.items:
        dmg = it.damage_reports[0] if (hasattr(it, "damage_reports") and it.damage_reports) else None
        loss = it.loss_report if hasattr(it, "loss_report") else None
        items_list.append({
            "id": it.id,
            "borrowing_item_id": it.borrowing_item_id,
            "asset_id": it.asset_id,
            "asset_name": it.asset.name if it.asset else None,
            "inventory_code": it.asset.inventory_code if it.asset else None,
            "final_condition": it.final_condition,
            "completeness": it.completeness,
            "notes": it.notes,
            "damage_report": {
                "id": dmg.id,
                "severity": dmg.severity,
                "description": dmg.description,
                "repair_status": dmg.repair_status,
                "repair_cost": float(dmg.repair_cost) if dmg.repair_cost is not None else None,
            } if dmg else None,
            "loss_report": {
                "id": loss.id,
                "description": loss.description,
                "action_taken": loss.action_taken,
            } if loss else None,
        })

    return {
        "id": r.id,
        "borrowing_id": r.borrowing_id,
        "transaction_number": r.borrowing.transaction_number if r.borrowing else None,
        "received_by": r.received_by,
        "receiver_name": r.receiver.full_name if r.receiver else None,
        "returned_at": r.returned_at.isoformat() if r.returned_at else None,
        "notes": r.notes,
        "items": items_list,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }



# ---- Return Transactions ----
@return_bp.get("/returns")
@jwt_required
def list_returns():
    """List return transactions.
    ---
    tags:
      - Returns
    security:
      - Bearer: []
    parameters:
      - in: query
        name: borrowing_id
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
        description: Daftar pengembalian berhasil diambil
    """
    borrowing_id = request.args.get("borrowing_id", type=int)
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    with SessionLocal() as session:
        items, total = get_returns(session, borrowing_id=borrowing_id, page=page, per_page=per_page)
        return success_response(
            data=[serialize_return(r) for r in items],
            meta={"page": page, "per_page": per_page, "total": total},
            message="Daftar pengembalian berhasil diambil",
        )


@return_bp.get("/returns/<int:return_id>")
@jwt_required
def get_return_detail(return_id: int):
    """Get single return detail.
    ---
    tags:
      - Returns
    security:
      - Bearer: []
    responses:
      200:
        description: Detail pengembalian berhasil diambil
      404:
        description: Pengembalian tidak ditemukan
    """
    with SessionLocal() as session:
        ret = get_return_by_id(session, return_id)
        if not ret:
            return error_response("Data pengembalian tidak ditemukan", status_code=404)
        return success_response(data=serialize_return(ret), message="Detail pengembalian berhasil diambil")


@return_bp.post("/returns")
@permission_required("borrowing.return")
def create_return_transaction():
    """Process return of borrowed items (supports partial or complete returns).
    ---
    tags:
      - Returns
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required:
            - borrowing_id
            - items
          properties:
            borrowing_id:
              type: integer
            notes:
              type: string
            items:
              type: array
              items:
                type: object
                required:
                  - borrowing_item_id
                  - asset_id
                  - final_condition
                properties:
                  borrowing_item_id:
                    type: integer
                  asset_id:
                    type: integer
                  final_condition:
                    type: string
                    enum: [BAIK, RUSAK, HILANG]
                  completeness:
                    type: string
                  notes:
                    type: string
                  damage:
                    type: object
                  loss:
                    type: object
    responses:
      201:
        description: Pengembalian berhasil diproses
      400:
        description: Validasi gagal atau item tidak cocok
    """
    data = request.get_json(silent=True) or {}
    schema = ReturnCreateSchema()
    errors = schema.validate(data)
    if errors:
        return error_response("Validasi input pengembalian gagal", error_code="VALIDATION_ERROR", errors=errors)

    with SessionLocal() as session:
        try:
            ret = process_return(
                session=session,
                borrowing_id=data["borrowing_id"],
                received_by=g.current_user["id"],
                items_data=data["items"],
                notes=data.get("notes"),
            )
            return success_response(
                data=serialize_return(ret),
                message="Pengembalian barang berhasil dicatat",
                status_code=201,
            )
        except ValueError as e:
            return error_response(str(e), error_code="RETURN_FAILED", status_code=400)


# ---- Damage Reports ----
@return_bp.get("/damage-reports")
@jwt_required
def list_damage_reports():
    """List damage incident reports.
    ---
    tags:
      - Damage Reports
    security:
      - Bearer: []
    parameters:
      - in: query
        name: repair_status
        type: string
        enum: [DILAPORKAN, DALAM_PERBAIKAN, SELESAI, TIDAK_DAPAT_DIPERBAIKI]
      - in: query
        name: severity
        type: string
        enum: [RINGAN, SEDANG, BERAT]
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
        description: Daftar laporan kerusakan berhasil diambil
    """
    repair_status = request.args.get("repair_status")
    severity = request.args.get("severity")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    with SessionLocal() as session:
        items, total = get_damage_reports(
            session=session,
            repair_status=repair_status,
            severity=severity,
            page=page,
            per_page=per_page,
        )
        return success_response(
            data=[
                {
                    "id": d.id,
                    "return_item_id": d.return_item_id,
                    "asset_name": d.return_item.asset.name if d.return_item and d.return_item.asset else None,
                    "inventory_code": d.return_item.asset.inventory_code if d.return_item and d.return_item.asset else None,
                    "reported_by": d.reported_by,
                    "reporter_name": d.reporter.full_name if d.reporter else None,
                    "severity": d.severity,
                    "description": d.description,
                    "evidence_path": d.evidence_path,
                    "action_taken": d.action_taken,
                    "repair_status": d.repair_status,
                    "repair_cost": float(d.repair_cost) if d.repair_cost is not None else None,
                    "reported_at": d.reported_at.isoformat() if d.reported_at else None,
                    "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
                }
                for d in items
            ],
            meta={"page": page, "per_page": per_page, "total": total},
            message="Daftar laporan kerusakan berhasil diambil",
        )


@return_bp.put("/damage-reports/<int:report_id>/repair-status")
@permission_required("damage.update")
def update_repair_status(report_id: int):
    """Update repair lifecycle status for a damage report.
    ---
    tags:
      - Damage Reports
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        schema:
          type: object
          required:
            - repair_status
          properties:
            repair_status:
              type: string
              enum: [DILAPORKAN, DALAM_PERBAIKAN, SELESAI, TIDAK_DAPAT_DIPERBAIKI]
            action_taken:
              type: string
            repair_cost:
              type: number
    responses:
      200:
        description: Status perbaikan berhasil diperbarui
      400:
        description: Validasi status gagal
    """
    data = request.get_json(silent=True) or {}
    new_status = data.get("repair_status")
    valid_statuses = [s.value for s in RepairStatus]
    if not new_status or new_status.upper() not in valid_statuses:
        return error_response(f"repair_status harus salah satu dari: {', '.join(valid_statuses)}", status_code=400)

    with SessionLocal() as session:
        try:
            d = update_damage_repair_status(
                session=session,
                report_id=report_id,
                repair_status=new_status,
                action_taken=data.get("action_taken"),
                repair_cost=data.get("repair_cost"),
                user_id=g.current_user["id"],
            )
            return success_response(
                data={"id": d.id, "repair_status": d.repair_status, "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None},
                message="Status perbaikan berhasil diperbarui",
            )
        except ValueError as e:
            return error_response(str(e), status_code=400)


# ---- Loss Reports ----
@return_bp.get("/loss-reports")
@jwt_required
def list_loss_reports():
    """List loss incident reports.
    ---
    tags:
      - Loss Reports
    security:
      - Bearer: []
    parameters:
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
        description: Daftar laporan kehilangan berhasil diambil
    """
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    with SessionLocal() as session:
        items, total = get_loss_reports(session, page=page, per_page=per_page)
        return success_response(
            data=[
                {
                    "id": l.id,
                    "return_item_id": l.return_item_id,
                    "asset_name": l.return_item.asset.name if l.return_item and l.return_item.asset else None,
                    "inventory_code": l.return_item.asset.inventory_code if l.return_item and l.return_item.asset else None,
                    "reported_by": l.reported_by,
                    "reporter_name": l.reporter.full_name if l.reporter else None,
                    "description": l.description,
                    "evidence_path": l.evidence_path,
                    "action_taken": l.action_taken,
                    "reported_at": l.reported_at.isoformat() if l.reported_at else None,
                }
                for l in items
            ],
            meta={"page": page, "per_page": per_page, "total": total},
            message="Daftar laporan kehilangan berhasil diambil",
        )
