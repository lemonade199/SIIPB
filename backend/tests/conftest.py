"""Test configuration and fixtures for SIIPB API tests."""
import os
import sys
from pathlib import Path
import pytest

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

from app import create_app
from app.database import SessionLocal
from app.services.auth_service import authenticate_user


@pytest.fixture(scope="session")
def app():
    """Create Flask application instance for testing."""
    app = create_app()
    app.config["TESTING"] = True
    yield app


@pytest.fixture(scope="session")
def client(app):
    """Test HTTP client."""
    return app.test_client()


@pytest.fixture(scope="session")
def db_session():
    """Database session fixture."""
    with SessionLocal() as session:
        yield session


@pytest.fixture(scope="session")
def admin_token():
    """Generate access token for admin."""
    with SessionLocal() as session:
        auth_data = authenticate_user(session, "admin", "admin123")
        return auth_data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    """HTTP headers with admin bearer token."""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }
