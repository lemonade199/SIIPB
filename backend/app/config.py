"""Application configuration loaded from environment variables."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory or project root
backend_dir = Path(__file__).resolve().parents[1]
load_dotenv(backend_dir / ".env")


class Config:
    # App
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("APP_DEBUG", "true").lower() in ("true", "1", "yes")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "siipb-super-secret-dev-key-change-in-production")

    # Database (MariaDB 13 existing)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "mariadb+pymysql://root:123@127.0.0.1:3306/siipb?charset=utf8mb4",
    )
    SQLALCHEMY_DATABASE_URI: str = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 3600,
        "pool_size": 10,
        "max_overflow": 20,
    }

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")

    # Celery
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
    CELERY_TIMEZONE: str = os.getenv("CELERY_TIMEZONE", "Asia/Jakarta")

    # JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TTL_MINUTES: int = int(os.getenv("JWT_ACCESS_TTL_MINUTES", "60"))
    JWT_REFRESH_TTL_DAYS: int = int(os.getenv("JWT_REFRESH_TTL_DAYS", "7"))

    # OAuth 2.0 / OIDC (Authlib)
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_DISCOVERY_URL: str = "https://accounts.google.com/.well-known/openid-configuration"

    # SMTP (Email notification)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")
    SMTP_SENDER_EMAIL: str = os.getenv("SMTP_SENDER_EMAIL", "no-reply@siipb.sch.id")
    SMTP_SENDER_NAME: str = os.getenv("SMTP_SENDER_NAME", "SIIPB Sarpras IT")

    # S3 / MinIO Object Storage
    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "http://127.0.0.1:9000")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "minioadmin")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "siipb-uploads")
    S3_SECURE: bool = os.getenv("S3_SECURE", "false").lower() in ("true", "1", "yes")
    UPLOAD_FOLDER: str = str(backend_dir / "uploads")

    # Pagination Defaults
    DEFAULT_PAGE: int = 1
    DEFAULT_PER_PAGE: int = 20
    MAX_PER_PAGE: int = 100


DATABASE_URL = Config.DATABASE_URL
