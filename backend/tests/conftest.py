"""Fixture pytest SIIPB.

Tes berjalan pada database TERPISAH (bawaan `siipb_test`) yang dibuat ulang setiap sesi:
DROP/CREATE -> `alembic upgrade head` -> seed. Database pengembangan tidak disentuh.

    TEST_DATABASE_URL=mariadb+pymysql://root:123@127.0.0.1:3306/siipb_test?charset=utf8mb4 pytest
"""
import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

TEST_DB_URL = os.getenv("TEST_DATABASE_URL", "mariadb+pymysql://root:123@127.0.0.1:3306/siipb_test?charset=utf8mb4")
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["NOTIFICATION_DISPATCH"] = "sync"
os.environ["APP_ENV"] = "testing"
os.environ.setdefault("SMTP_USERNAME", "")
os.environ.setdefault("SMTP_PASSWORD", "")
_tmp = tempfile.mkdtemp(prefix="siipb-test-")
os.environ["UPLOAD_FOLDER"] = str(Path(_tmp) / "uploads")
os.environ["BACKUP_FOLDER"] = str(Path(_tmp) / "backups")


def _recreate_database():
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url

    url = make_url(TEST_DB_URL)
    name = url.database
    assert name and "test" in name, "TEST_DATABASE_URL harus menunjuk database khusus tes (nama mengandung 'test')"
    server = create_engine(url.set(database="information_schema"))
    with server.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS `{name}`"))
        conn.execute(text(f"CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
    server.dispose()

    from alembic import command
    from alembic.config import Config as AlembicConfig

    cfg = AlembicConfig(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    command.upgrade(cfg, "head")

    import importlib.util

    spec = importlib.util.spec_from_file_location("seed_data", BACKEND / "scripts" / "seed_data.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.seed()


@pytest.fixture(scope="session", autouse=True)
def database():
    _recreate_database()
    yield


@pytest.fixture(scope="session")
def app(database):
    from app import create_app

    application = create_app()
    application.config["TESTING"] = True
    return application


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


def _login(client, username, password):
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.get_json()
    return {"Authorization": f"Bearer {res.get_json()['data']['access_token']}"}


@pytest.fixture(scope="session")
def auth_headers(client):
    return _login(client, "admin", "admin123")


@pytest.fixture(scope="session")
def petugas_headers(client):
    return _login(client, "petugas", "petugas123")


@pytest.fixture(scope="session")
def pimpinan_headers(client):
    return _login(client, "pimpinan", "pimpinan123")


@pytest.fixture
def login(client):
    return lambda u, p: _login(client, u, p)


@pytest.fixture
def db_session():
    from app.database import SessionLocal

    with SessionLocal() as s:
        yield s


@pytest.fixture
def make_asset(client, auth_headers):
    def _make(**extra):
        body = {"category_id": 1, "location_id": 2, "name": "Barang Uji", "condition": "BAIK", **extra}
        res = client.post("/api/v1/assets", json=body, headers=auth_headers)
        assert res.status_code == 201, res.get_json()
        return res.get_json()["data"]
    return _make


@pytest.fixture
def make_borrowing(client, auth_headers, make_asset):
    def _make(n_items=1, start=None, due=None, checkout=True, borrower_id=1):
        start = start or date.today()
        due = due or start + timedelta(days=7)
        assets = [make_asset() for _ in range(n_items)]
        res = client.post("/api/v1/borrowings", json={
            "borrower_id": borrower_id,
            "start_date": start.isoformat(),
            "due_date": due.isoformat(),
            "purpose": "Kegiatan uji",
            "asset_ids": [a["id"] for a in assets],
            "checkout": checkout,
        }, headers=auth_headers)
        assert res.status_code == 201, res.get_json()
        return res.get_json()["data"]
    return _make
