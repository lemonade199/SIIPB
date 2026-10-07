"""Laporan: pratinjau JSON, unduh Excel (openpyxl) & PDF (WeasyPrint)."""
from datetime import datetime

from flask import Blueprint, Response, g, request

from app.database import SessionLocal
from app.middleware.auth_middleware import has_permission, permission_required
from app.services.audit_service import record_audit
from app.services.report_service import REPORT_TYPES, build_report, to_pdf, to_xlsx
from app.services.settings_service import get_settings
from app.utils.response import error_response, success_response

report_bp = Blueprint("reports", __name__, url_prefix="/api/v1/reports")
FILTER_KEYS = ("from", "to", "unit_id", "category_id", "location_id", "status")


@report_bp.get("")
@permission_required("report.view")
def report_types():
    """Jenis laporan yang tersedia.
    ---
    tags: [Reports]
    security: [{Bearer: []}]
    responses:
      200: {description: Jenis laporan}
    """
    return success_response(data=[{"type": k, "title": v} for k, v in REPORT_TYPES.items()])


@report_bp.get("/<rtype>")
@permission_required("report.view")
def report(rtype: str):
    """Buat laporan. `format=json` (pratinjau), `xlsx`, atau `pdf`.
    ---
    tags: [Reports]
    security: [{Bearer: []}]
    produces: [application/json, application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet]
    parameters:
      - {in: path, name: rtype, type: string, enum: [inventaris, peminjaman, pengembalian, keterlambatan, kerusakan], required: true}
      - {in: query, name: format, type: string, enum: [json, xlsx, pdf], default: json}
      - {in: query, name: from, type: string, format: date}
      - {in: query, name: to, type: string, format: date}
      - {in: query, name: unit_id, type: integer}
      - {in: query, name: category_id, type: integer}
      - {in: query, name: location_id, type: integer}
      - {in: query, name: status, type: string}
    responses:
      200: {description: Laporan}
    """
    fmt = (request.args.get("format") or "json").lower()
    if rtype not in REPORT_TYPES:
        return error_response("Jenis laporan tidak dikenal", error_code="NOT_FOUND", status_code=404)
    if fmt not in ("json", "xlsx", "pdf"):
        return error_response("Format harus json, xlsx, atau pdf", error_code="VALIDATION_ERROR")
    if fmt != "json" and not has_permission("report.export"):
        return error_response("Akses ditolak: Anda tidak memiliki izin report.export", error_code="FORBIDDEN", status_code=403)
    filters = {k: request.args.get(k) for k in FILTER_KEYS if request.args.get(k)}
    with SessionLocal() as session:
        try:
            rep = build_report(session, rtype, filters)
        except ValueError as e:
            return error_response(str(e), error_code="VALIDATION_ERROR")
        if fmt == "json":
            return success_response(data={"type": rep.type, "title": rep.title, "columns": rep.columns,
                                          "rows": rep.rows, "summary": rep.summary, "filters": rep.filters})
        settings = get_settings(session)
        user = g.current_user.get("full_name") or g.current_user["username"]
        record_audit(session, "EXPORT", "report", "report", None, g.current_user["id"],
                     new_data={"type": rtype, "format": fmt, "rows": len(rep.rows), "filters": filters})
        session.commit()
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    if fmt == "xlsx":
        body = to_xlsx(rep, settings, user)
        mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        body = to_pdf(rep, settings, user)
        mime = "application/pdf"
    name = f"laporan-{rtype}-{stamp}.{fmt}"
    return Response(body, mimetype=mime, headers={
        "Content-Disposition": f'attachment; filename="{name}"',
        "Access-Control-Expose-Headers": "Content-Disposition",
    })
