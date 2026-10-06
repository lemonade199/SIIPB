"""Tests for Authentication endpoints."""


def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["status"] == "UP"


def test_login_success(client):
    payload = {"username": "admin", "password": "admin123"}
    res = client.post("/api/v1/auth/login", json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]
    assert data["data"]["user"]["username"] == "admin"


def test_login_invalid_password(client):
    payload = {"username": "admin", "password": "wrongpassword"}
    res = client.post("/api/v1/auth/login", json=payload)
    assert res.status_code == 401
    data = res.get_json()
    assert data["success"] is False
    assert data["error_code"] == "AUTH_FAILED"


def test_get_me_profile(client, auth_headers):
    res = client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["username"] == "admin"
    assert "permissions" in data["data"]
    assert "asset.create" in data["data"]["permissions"]


def test_refresh_token(client):
    # 1. Login to get refresh token
    login_res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    refresh_token = login_res.get_json()["data"]["refresh_token"]

    # 2. Refresh
    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_res.status_code == 200
    data = ref_res.get_json()
    assert data["success"] is True
    assert "access_token" in data["data"]
