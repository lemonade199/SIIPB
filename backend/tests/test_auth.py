"""Autentikasi, JWT, refresh, profil, ganti kata sandi, RBAC (PB-001, PB-002)."""


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.get_json()["data"]["status"] == "UP"
    assert res.get_json()["data"]["migration"]


def test_login_success_returns_profile(client):
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["access_token"] and data["refresh_token"]
    assert data["user"]["username"] == "admin"
    assert "users.manage" in data["user"]["permissions"]


def test_login_by_email(client):
    res = client.post("/api/v1/auth/login", json={"username": "petugas@siipb.local", "password": "petugas123"})
    assert res.status_code == 200


def test_login_invalid_password(client):
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "salah-sekali"})
    assert res.status_code == 401
    assert res.get_json()["error_code"] == "AUTH_FAILED"


def test_password_is_hashed(db_session):
    from sqlalchemy import select

    from app.models import User

    for u in db_session.scalars(select(User)).all():
        assert u.password_hash.startswith("scrypt:"), u.username
        assert "admin123" not in u.password_hash


def test_requires_token(client):
    assert client.get("/api/v1/assets").status_code == 401
    assert client.get("/api/v1/assets", headers={"Authorization": "Bearer xxx"}).status_code == 401


def test_me_and_refresh(client):
    login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"}).get_json()["data"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login['access_token']}"})
    assert me.status_code == 200 and me.get_json()["data"]["roles"] == ["ADMIN"]
    ref = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert ref.status_code == 200 and ref.get_json()["data"]["access_token"]
    # logout mencabut refresh token
    client.post("/api/v1/auth/logout", json={"refresh_token": login["refresh_token"]},
                headers={"Authorization": f"Bearer {login['access_token']}"})
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]}).status_code == 401


def test_rbac_pimpinan_read_only(client, pimpinan_headers):
    assert client.get("/api/v1/dashboard/summary", headers=pimpinan_headers).status_code == 200
    assert client.get("/api/v1/reports/inventaris", headers=pimpinan_headers).status_code == 200
    assert client.post("/api/v1/assets", json={"category_id": 1, "name": "X"}, headers=pimpinan_headers).status_code == 403
    assert client.post("/api/v1/borrowings", json={}, headers=pimpinan_headers).status_code in (400, 403)
    assert client.get("/api/v1/users", headers=pimpinan_headers).status_code == 403
    assert client.get("/api/v1/audit-logs", headers=pimpinan_headers).status_code == 403


def test_rbac_petugas(client, petugas_headers):
    assert client.get("/api/v1/assets", headers=petugas_headers).status_code == 200
    assert client.get("/api/v1/users", headers=petugas_headers).status_code == 403
    assert client.put("/api/v1/settings", json={}, headers=petugas_headers).status_code == 403


def test_change_password_and_policy(client, auth_headers):
    res = client.post("/api/v1/users", json={
        "username": "uji.sandi", "email": "uji.sandi@contoh.id", "full_name": "Uji Sandi",
        "password": "Rahasia123", "role_id": 2}, headers=auth_headers)
    assert res.status_code == 201, res.get_json()
    login = client.post("/api/v1/auth/login", json={"username": "uji.sandi", "password": "Rahasia123"}).get_json()["data"]
    h = {"Authorization": f"Bearer {login['access_token']}"}
    weak = client.post("/api/v1/auth/change-password", json={"current_password": "Rahasia123", "new_password": "pendek"}, headers=h)
    assert weak.status_code == 400
    wrong = client.post("/api/v1/auth/change-password", json={"current_password": "salah", "new_password": "BaruSekali99"}, headers=h)
    assert wrong.status_code == 400
    ok = client.post("/api/v1/auth/change-password", json={"current_password": "Rahasia123", "new_password": "BaruSekali99"}, headers=h)
    assert ok.status_code == 200
    # sesi lama (refresh token) dicabut
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"username": "uji.sandi", "password": "BaruSekali99"}).status_code == 200


def test_sso_code_exchange_single_use(client, db_session):
    from sqlalchemy import select

    from app.models import User
    from app.services.auth_service import issue_sso_code

    user = db_session.scalars(select(User).where(User.username == "petugas")).first()
    code = issue_sso_code(db_session, user)
    first = client.post("/api/v1/auth/sso/exchange", json={"code": code})
    assert first.status_code == 200 and first.get_json()["data"]["user"]["username"] == "petugas"
    assert client.post("/api/v1/auth/sso/exchange", json={"code": code}).status_code == 401
