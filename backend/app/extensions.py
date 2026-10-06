"""Flask extensions and external integrations."""
from celery import Celery
from flasgger import Swagger
from authlib.integrations.flask_client import OAuth

from app.config import Config

# Celery instance
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

# Swagger instance
swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "SIIPB API Specification",
        "description": "Sistem Informasi Inventaris Barang, Peminjaman, dan Pengembalian Barang",
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
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/api/docs"
}

swagger = Swagger(template=swagger_template, config=swagger_config)

# OAuth instance
oauth = OAuth()
if Config.GOOGLE_CLIENT_ID and Config.GOOGLE_CLIENT_SECRET:
    oauth.register(
        name="google",
        client_id=Config.GOOGLE_CLIENT_ID,
        client_secret=Config.GOOGLE_CLIENT_SECRET,
        server_metadata_url=Config.GOOGLE_DISCOVERY_URL,
        client_kwargs={"scope": "openid email profile"},
    )
