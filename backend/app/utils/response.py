"""Standard API response formatter matching SIIPB specifications."""
from typing import Any
from flask import jsonify, Response


def api_response(
    success: bool = True,
    data: Any = None,
    message: str = "",
    status_code: int = 200,
    error_code: str | None = None,
    errors: Any = None,
    meta: dict[str, Any] | None = None,
) -> tuple[Response, int]:
    """Build a uniform JSON response format.

    Success format:
    {
        "success": true,
        "message": "...",
        "data": { ... },
        "meta": { "page": 1, ... }  # optional
    }

    Error format:
    {
        "success": false,
        "message": "...",
        "error_code": "ASSET_NOT_AVAILABLE",
        "data": null,
        "errors": { ... }  # optional validation details
    }
    """
    payload: dict[str, Any] = {
        "success": success,
        "message": message,
        "data": data,
    }

    if not success:
        if error_code:
            payload["error_code"] = error_code
        if errors is not None:
            payload["errors"] = errors
    elif meta is not None:
        payload["meta"] = meta

    return jsonify(payload), status_code


def success_response(data: Any = None, message: str = "Operasi berhasil", status_code: int = 200, meta: dict[str, Any] | None = None):
    return api_response(success=True, data=data, message=message, status_code=status_code, meta=meta)


def error_response(message: str, error_code: str | None = None, status_code: int = 400, errors: Any = None):
    return api_response(success=False, data=None, message=message, status_code=status_code, error_code=error_code, errors=errors)
