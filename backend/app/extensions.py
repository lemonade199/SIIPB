"""Ekstensi Flask: Swagger dan Celery."""
import re

from celery import Celery
from flasgger import Swagger
from authlib.integrations.flask_client import OAuth

from app.config import Config

celery = Celery(
    "siipb",
    broker=Config.CELERY_BROKER_URL,
    backend=Config.CELERY_RESULT_BACKEND,
)
celery.conf.update(
    timezone=Config.CELERY_TIMEZONE,
    enable_utc=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
)

swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "SIIPB API Specification",
        "description": "Sistem Informasi Inventaris Barang, Peminjaman, dan Pengembalian Barang. Login: POST /api/v1/auth/login lalu klik Authorize dan isi `Bearer <access_token>`.",
        "version": "1.0.0",
        "contact": {
            "name": "SIIPB Developer Team"
        }
    },
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "Format: Bearer <JWT_ACCESS_TOKEN>"
        }
    },
    "security": [
        {"Bearer": []}
    ]
}

swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec_1",
            "route": "/apispec_1.json",
            # alias lama (/api/v1/items, /auth/google) tidak ditampilkan ganda di dokumentasi
            "rule_filter": lambda rule: not rule.rule.startswith("/api/v1/items")
            and rule.endpoint not in ("auth.google_login", "auth.google_callback"),
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/api/docs"
}

def _normalize_spec(spec: dict) -> dict:
    """Lengkapi spesifikasi agar valid Swagger 2.0 (dibutuhkan Postman & tombol Try it out):
    parameter path `{id}` dideklarasikan dan setiap operasi punya operationId unik."""
    for path, item in spec.get("paths", {}).items():
        names = re.findall(r"\{(\w+)\}", path)
        for method, op in item.items():
            if not isinstance(op, dict):
                continue
            params = op.setdefault("parameters", [])
            declared = {p.get("name") for p in params if p.get("in") == "path"}
            for name in names:
                if name not in declared:
                    params.append({"name": name, "in": "path", "required": True,
                                   "type": "integer" if name == "id" or name.endswith("_id") else "string"})
            op.setdefault("operationId", re.sub(r"\W+", "_", f"{method}{path}").strip("_"))
    return spec


class SiipbSwagger(Swagger):
    def get_apispecs(self, endpoint="apispec_1"):
        return _normalize_spec(super().get_apispecs(endpoint))


swagger = SiipbSwagger(template=swagger_template, config=swagger_config)

# OAuth registry — klien SSO/OIDC didaftarkan dinamis dari pengaturan (app/services/oidc_service.py)
oauth = OAuth()
