"""Buat koleksi Postman (v2.1) dari spesifikasi Swagger backend, siap di-Import di Postman versi apa pun.

    cd backend && python scripts/export_postman.py      # -> docs/postman/SIIPB.postman_collection.json

Isi koleksi: folder per modul, variabel {{baseUrl}} & {{token}}, login yang menyimpan token otomatis,
contoh body untuk setiap POST/PUT, serta parameter path & query dengan contoh nilai.
"""
import json
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

OUT = BACKEND.parent / "docs" / "postman" / "SIIPB.postman_collection.json"
TODAY, DUE = "2026-10-21", "2026-10-24"

# Contoh body untuk endpoint yang skemanya tidak tercantum di docstring (kunci: "METHOD path").
EXAMPLES = {
    "POST /api/v1/assets": {"category_id": 1, "location_id": 1, "name": "Laptop Lenovo ThinkPad T14", "brand": "Lenovo",
                            "model": "ThinkPad T14 Gen 3", "serial_number": "PF-3A21", "purchase_date": "2024-01-15",
                            "acquisition_cost": 14500000, "acquisition_source": "APBN 2024", "condition": "BAIK"},
    "PUT /api/v1/assets/{asset_id}": {"name": "Laptop Lenovo ThinkPad T14", "location_id": 2, "condition": "BAIK"},
    "PUT /api/v1/assets/{asset_id}/photos/order": {"photo_ids": [3, 2]},
    "POST /api/v1/borrowings": {"borrower_id": 1, "asset_ids": [1], "start_date": TODAY, "due_date": DUE,
                                "purpose": "Presentasi kegiatan", "notes": "Termasuk charger", "checkout": True},
    "PUT /api/v1/borrowings/{borrowing_id}": {"due_date": DUE, "purpose": "Presentasi kegiatan"},
    "POST /api/v1/borrowings/{borrowing_id}/cancel": {"reason": "Kegiatan dibatalkan"},
    "POST /api/v1/returns": {"borrowing_id": 1, "notes": "", "send_confirmation": True,
                             "items": [{"borrowing_item_id": 1, "asset_id": 1, "final_condition": "BAIK", "completeness": "Lengkap"}]},
    "PUT /api/v1/damage-reports/{report_id}/repair-status": {"repair_status": "SELESAI", "action_taken": "Ganti keyboard",
                                                              "repair_cost": 350000},
    "POST /api/v1/categories": {"code": "LPT", "name": "Laptop & Komputer"},
    "PUT /api/v1/categories/{row_id}": {"name": "Laptop & Komputer"},
    "POST /api/v1/locations": {"code": "GDA-GUDANG", "name": "Gudang Inventaris", "description": "Gedung A, Lt. 1"},
    "PUT /api/v1/locations/{row_id}": {"name": "Gudang Inventaris", "description": "Gedung A, Lt. 1"},
    "POST /api/v1/organizational-units": {"code": "TU", "name": "Tata Usaha"},
    "PUT /api/v1/organizational-units/{row_id}": {"name": "Tata Usaha"},
    "POST /api/v1/borrowers": {"name": "Andi Wijaya", "identity_number": "198501012010011001", "email": "andi.wijaya@instansi.go.id",
                               "phone": "0812-3456-7890", "position": "Staf Tata Usaha", "unit_id": 1},
    "PUT /api/v1/borrowers/{borrower_id}": {"phone": "0812-3456-7890", "is_active": True},
    "POST /api/v1/users": {"username": "budi.santoso", "email": "budi@instansi.go.id", "full_name": "Budi Santoso",
                           "password": "Rahasia123", "role_id": 2, "phone": "0812-3456-7890"},
    "PUT /api/v1/users/{user_id}": {"full_name": "Budi Santoso", "role_id": 2, "is_active": True},
    "POST /api/v1/roles": {"code": "STAF_GUDANG", "name": "Staf Gudang", "description": "Mengelola stok barang di gudang",
                           "permissions": ["dashboard.view", "inventory.view", "inventory.manage"]},
    "PUT /api/v1/roles/{role_id}": {"permissions": ["dashboard.view", "inventory.view"]},
    "PUT /api/v1/auth/me": {"full_name": "Administrator SIIPB", "phone": "0812-3456-7890"},
    "POST /api/v1/auth/refresh": {"refresh_token": "{{refreshToken}}"},
    "POST /api/v1/auth/logout": {"refresh_token": "{{refreshToken}}"},
    "POST /api/v1/auth/sso/exchange": {"code": "kode-sekali-pakai-dari-redirect-sso"},
    "PUT /api/v1/settings": {"institution": "SMA Negeri 1 Contoh", "smtp": {"host": "smtp.gmail.com", "port": 587, "encryption": "STARTTLS"}},
    "POST /api/v1/settings/smtp/test": {"to": "email.tujuan@contoh.com"},
    "POST /api/v1/scheduler/run": {},
    "PUT /api/v1/notifications/templates/{template_id}": {"subject": "[SIIPB] Pengingat pengembalian",
                                                          "body": "Yth. peminjam, mohon kembalikan barang sebelum batas waktu."},
}
FORM_FILES = {"POST /api/v1/assets/{asset_id}/photos": "files", "POST /api/v1/assets/{asset_id}/upload-photo": "file",
              "POST /api/v1/uploads": "file"}
PATH_EXAMPLES = {"rtype": "peminjaman", "code": "INV-LPT-0001", "name": "siipb-20261021-010000.sql.gz"}
PUBLIC = {"/api/health", "/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/sso/exchange",
          "/api/v1/settings/public", "/api/v1/auth/sso", "/api/v1/auth/sso/callback"}
SAVE_TOKENS = """const j = pm.response.json();
if (j.success && j.data.access_token) {
  pm.collectionVariables.set('token', j.data.access_token);
  if (j.data.refresh_token) pm.collectionVariables.set('refreshToken', j.data.refresh_token);
}"""


def example_from_schema(schema: dict):
    if not isinstance(schema, dict):
        return None
    if "example" in schema:
        return schema["example"]
    if schema.get("enum"):
        return schema["enum"][0]
    t = schema.get("type")
    if t == "object" or "properties" in schema:
        return {k: example_from_schema(v) for k, v in (schema.get("properties") or {}).items()}
    if t == "array":
        return [example_from_schema(schema.get("items") or {})]
    return {"integer": 1, "number": 0, "boolean": True}.get(t, "2026-10-21" if schema.get("format") == "date" else "contoh")


def build_request(path: str, method: str, op: dict) -> dict:
    key = f"{method.upper()} {path}"
    params = op.get("parameters", [])
    segs = [s.strip("{}") if s.startswith("{") else s for s in path.strip("/").split("/")]
    raw_path = "/".join(f":{s.strip('{}')}" if s.startswith("{") else s for s in path.strip("/").split("/"))
    path_vars = [{"key": p["name"], "value": PATH_EXAMPLES.get(p["name"], "1"), "description": p.get("description", "")}
                 for p in params if p.get("in") == "path"]
    query = [{"key": p["name"], "value": str(p.get("default", p.get("example", ""))), "disabled": True,
              "description": p.get("description", "")} for p in params if p.get("in") == "query"]
    req = {
        "method": method.upper(),
        "header": [],
        "url": {"raw": "{{baseUrl}}/" + raw_path, "host": ["{{baseUrl}}"],
                "path": [f":{s}" if f"{{{s}}}" in path else s for s in segs]},
        "description": (op.get("description") or op.get("summary") or "").strip(),
    }
    if path_vars:
        req["url"]["variable"] = path_vars
    if query:
        req["url"]["query"] = query
    if path in PUBLIC:
        req["auth"] = {"type": "noauth"}
    body = EXAMPLES.get(key)
    if body is None:
        schema = next((p.get("schema") for p in params if p.get("in") == "body"), None)
        body = example_from_schema(schema) if schema else None
    if key in FORM_FILES:
        req["body"] = {"mode": "formdata", "formdata": [{"key": FORM_FILES[key], "type": "file", "src": []}]}
    elif body is not None or method in ("post", "put"):
        req["header"].append({"key": "Content-Type", "value": "application/json"})
        req["body"] = {"mode": "raw", "raw": json.dumps(body if body is not None else {}, indent=2, ensure_ascii=False),
                       "options": {"raw": {"language": "json"}}}
    return req


def main() -> None:
    from app import create_app

    spec = create_app().test_client().get("/apispec_1.json").get_json()
    folders: dict[str, list] = {}
    for path, item in spec["paths"].items():
        for method, op in item.items():
            if method not in ("get", "post", "put", "delete", "patch"):
                continue
            name = (op.get("summary") or "").strip() or f"{method.upper()} {path}"
            entry = {"name": f"{method.upper()} {re.sub(r'^/api/v1', '', path)} - {name}", "request": build_request(path, method, op)}
            if path in ("/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/sso/exchange"):
                entry["event"] = [{"listen": "test", "script": {"type": "text/javascript", "exec": SAVE_TOKENS.splitlines()}}]
            folders.setdefault((op.get("tags") or ["Lainnya"])[0], []).append(entry)

    # login paling atas agar token tersedia untuk request lain
    folders.get("Authentication", []).sort(key=lambda e: "/auth/login " not in e["name"])
    order = ["Authentication"]
    items = [{"name": t, "item": folders[t]} for t in order if t in folders]
    items += [{"name": t, "item": v} for t, v in sorted(folders.items()) if t not in order]
    collection = {
        "info": {
            "name": "SIIPB API",
            "description": "Koleksi seluruh endpoint SIIPB. Jalankan Authentication > POST /auth/login lebih dulu: "
                           "token tersimpan otomatis dan dipakai request lain.\n\nUbah variabel baseUrl ke "
                           "https://averus.my.id untuk server AWS.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{token}}", "type": "string"}]},
        "variable": [{"key": "baseUrl", "value": "http://localhost"}, {"key": "token", "value": ""},
                     {"key": "refreshToken", "value": ""}],
        "item": items,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(collection, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(len(f["item"]) for f in items)
    print(f"{total} request dalam {len(items)} folder -> {OUT}")


if __name__ == "__main__":
    main()
