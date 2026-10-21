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


def test_jwt_ttl_from_system_settings_and_exp_claim(client, auth_headers, db_session):
    """Skenario 1, 2, 5, 6, 8: Pengaturan TTL pada system_settings diterapkan pada access token (exp claim)
    dan refresh token (expires_at), dan update via dashboard langsung berdampak."""
    from datetime import datetime
    import jwt
    from sqlalchemy import select

    from app.config import Config
    from app.models import RefreshToken
    from app.utils.security import hash_token

    update_res = client.put(
        "/api/v1/settings",
        json={"security": {"jwt_access_minutes": 45, "jwt_refresh_days": 14}},
        headers=auth_headers,
    )
    assert update_res.status_code == 200

    before_login = datetime.now()
    login_res = client.post("/api/v1/auth/login", json={"username": "petugas@siipb.local", "password": "petugas123"})
    assert login_res.status_code == 200
    data = login_res.get_json()["data"]

    # Verifikasi expires_in sesuai (45 menit = 2700 detik)
    assert data["expires_in"] == 45 * 60

    payload = jwt.decode(data["access_token"], Config.JWT_SECRET_KEY, algorithms=[Config.JWT_ALGORITHM])
    assert payload["exp"] - payload["iat"] == 45 * 60

    # Verifikasi refresh token expires_at tersimpan sesuai 14 hari
    ref_record = db_session.scalars(select(RefreshToken).where(RefreshToken.token_hash == hash_token(data["refresh_token"]))).first()
    assert ref_record is not None
    diff = (ref_record.expires_at - before_login).total_seconds() / 86400
    assert 13.9 <= diff <= 14.1

    client.put(
        "/api/v1/settings",
        json={"security": {"jwt_access_minutes": Config.JWT_ACCESS_TTL_MINUTES, "jwt_refresh_days": Config.JWT_REFRESH_TTL_DAYS}},
        headers=auth_headers,
    )


def test_token_ttl_fallback_when_settings_missing_or_empty(db_session):
    """Skenario 3: Fallback ke Config ketika nilai konfigurasi tidak tersedia."""
    import json
    from sqlalchemy import select

    from app.config import Config
    from app.models import SystemSetting
    from app.services.auth_service import get_token_ttl

    # Simpan app.settings tanpa field jwt_access_minutes / jwt_refresh_days
    row = db_session.scalars(select(SystemSetting).where(SystemSetting.key == "app.settings")).first()
    if row:
        row.value = json.dumps({"institution": "Test Instansi"})
    else:
        db_session.add(SystemSetting(key="app.settings", value=json.dumps({"institution": "Test Instansi"})))
    db_session.commit()

    access_min, refresh_days = get_token_ttl(db_session)
    assert access_min == Config.JWT_ACCESS_TTL_MINUTES
    assert refresh_days == Config.JWT_REFRESH_TTL_DAYS


def test_token_ttl_validation_and_safe_fallback(client, auth_headers, db_session):
    """Skenario 4: Penolakan nilai TTL tidak valid pada endpoint settings & penanganan fallback aman."""
    import json
    from sqlalchemy import select

    from app.config import Config
    from app.models import SystemSetting
    from app.services.auth_service import authenticate_user, get_token_ttl

    # Validasi penolakan nilai <= 0 atau non-integer saat update settings
    res1 = client.put("/api/v1/settings", json={"security": {"jwt_access_minutes": 0}}, headers=auth_headers)
    assert res1.status_code == 400
    assert "security.jwt_access_minutes" in res1.get_json()["errors"]

    res2 = client.put("/api/v1/settings", json={"security": {"jwt_access_minutes": -10}}, headers=auth_headers)
    assert res2.status_code == 400
    assert "security.jwt_access_minutes" in res2.get_json()["errors"]

    res3 = client.put("/api/v1/settings", json={"security": {"jwt_refresh_days": 0}}, headers=auth_headers)
    assert res3.status_code == 400
    assert "security.jwt_refresh_days" in res3.get_json()["errors"]

    res4 = client.put("/api/v1/settings", json={"security": {"jwt_refresh_days": "bukan_angka"}}, headers=auth_headers)
    assert res4.status_code == 400
    assert "security.jwt_refresh_days" in res4.get_json()["errors"]

    res5 = client.put("/api/v1/settings", json={"security": {"jwt_access_minutes": True}}, headers=auth_headers)
    assert res5.status_code == 400
    assert "security.jwt_access_minutes" in res5.get_json()["errors"]

    # Penanganan aman jika data di database berisi nilai tidak valid
    row = db_session.scalars(select(SystemSetting).where(SystemSetting.key == "app.settings")).first()
    if row:
        row.value = json.dumps({"security": {"jwt_access_minutes": -99, "jwt_refresh_days": "invalid"}})
        db_session.commit()

    # get_token_ttl tidak boleh crash, melainkan fallback secara aman ke Config
    acc, ref = get_token_ttl(db_session)
    assert acc == Config.JWT_ACCESS_TTL_MINUTES
    assert ref == Config.JWT_REFRESH_TTL_DAYS

    # Token issuance tetap berjalan aman menggunakan fallback
    login_res = authenticate_user(db_session, "admin", "admin123")
    assert login_res["expires_in"] == Config.JWT_ACCESS_TTL_MINUTES * 60

    if row:
        db_session.delete(row)
        db_session.commit()


def test_consistent_ttl_across_all_issuance_paths(client, auth_headers, db_session):
    """Skenario 7: Konsistensi TTL di seluruh jalur penerbitan token:
    - Login lokal (authenticate_user)
    - Refresh token (refresh_access_token)
    - SSO exchange (exchange_sso_code)
    - OAuth login (authenticate_oauth_identity)
    """
    import jwt
    from sqlalchemy import select

    from app.config import Config
    from app.models import User
    from app.services.auth_service import (
        authenticate_oauth_identity,
        authenticate_user,
        exchange_sso_code,
        issue_sso_code,
        refresh_access_token,
    )

    client.put("/api/v1/settings", json={"security": {"jwt_access_minutes": 35, "jwt_refresh_days": 10}}, headers=auth_headers)

    # Jalur Local Login
    local = authenticate_user(db_session, "admin", "admin123")
    assert local["expires_in"] == 35 * 60
    p1 = jwt.decode(local["access_token"], Config.JWT_SECRET_KEY, algorithms=[Config.JWT_ALGORITHM])
    assert p1["exp"] - p1["iat"] == 35 * 60

    # Jalur Token Refresh
    refreshed = refresh_access_token(db_session, local["refresh_token"])
    assert refreshed["expires_in"] == 35 * 60
    p2 = jwt.decode(refreshed["access_token"], Config.JWT_SECRET_KEY, algorithms=[Config.JWT_ALGORITHM])
    assert p2["exp"] - p2["iat"] == 35 * 60

    # Jalur SSO Code Exchange
    user = db_session.scalars(select(User).where(User.username == "petugas")).first()
    sso_code = issue_sso_code(db_session, user)
    sso_ex = exchange_sso_code(db_session, sso_code)
    assert sso_ex["expires_in"] == 35 * 60
    p3 = jwt.decode(sso_ex["access_token"], Config.JWT_SECRET_KEY, algorithms=[Config.JWT_ALGORITHM])
    assert p3["exp"] - p3["iat"] == 35 * 60

    # Jalur OAuth Identity Login
    user.google_subject = "test-google-sub-12345"
    db_session.commit()
    oauth_res = authenticate_oauth_identity(db_session, "google", "test-google-sub-12345", email=user.email)
    assert oauth_res["expires_in"] == 35 * 60
    p4 = jwt.decode(oauth_res["access_token"], Config.JWT_SECRET_KEY, algorithms=[Config.JWT_ALGORITHM])
    assert p4["exp"] - p4["iat"] == 35 * 60

    client.put(
        "/api/v1/settings",
        json={"security": {"jwt_access_minutes": Config.JWT_ACCESS_TTL_MINUTES, "jwt_refresh_days": Config.JWT_REFRESH_TTL_DAYS}},
        headers=auth_headers,
    )


def test_ttl_change_does_not_affect_already_issued_tokens(client, auth_headers, db_session):
    """Skenario 9, 10, 11:
    - Perubahan TTL tidak mengubah masa berlaku token yang sudah terbit.
    - Token lama tidak diperpanjang atau diperpendek saat refresh.
    - Refresh token kedaluwarsa atau dicabut tetap ditolak.
    - Logout tetap mencabut refresh token.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import select

    from app.config import Config
    from app.models import RefreshToken
    from app.utils.security import hash_token

    # Terbitkan token awal pada konfigurasi TTL 60 menit & 7 hari
    client.put(
        "/api/v1/settings",
        json={"security": {"jwt_access_minutes": 60, "jwt_refresh_days": 7}},
        headers=auth_headers,
    )
    login1 = client.post("/api/v1/auth/login", json={"username": "petugas@siipb.local", "password": "petugas123"}).get_json()["data"]
    ref_token1 = login1["refresh_token"]

    rec1 = db_session.scalars(select(RefreshToken).where(RefreshToken.token_hash == hash_token(ref_token1))).first()
    original_expires_at = rec1.expires_at

    # Administrator mengubah pengaturan TTL ke 15 menit & 2 hari
    client.put(
        "/api/v1/settings",
        json={"security": {"jwt_access_minutes": 15, "jwt_refresh_days": 2}},
        headers=auth_headers,
    )

    # Verifikasi token lama tidak berubah expires_at-nya di database
    db_session.refresh(rec1)
    assert rec1.expires_at == original_expires_at

    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": ref_token1})
    assert ref_res.status_code == 200
    ref_data = ref_res.get_json()["data"]

    # Access token baru menggunakan TTL baru (15 menit = 900 detik)
    assert ref_data["expires_in"] == 15 * 60

    # Refresh token lama tidak diperpanjang / tidak dimodifikasi expires_at-nya
    db_session.rollback()
    rec1 = db_session.scalars(select(RefreshToken).where(RefreshToken.token_hash == hash_token(ref_token1))).first()
    assert rec1.expires_at == original_expires_at

    # Token kedaluwarsa ditolak
    rec1.expires_at = datetime.now() - timedelta(minutes=5)
    db_session.commit()
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": ref_token1}).status_code == 401

    login2 = client.post("/api/v1/auth/login", json={"username": "petugas@siipb.local", "password": "petugas123"}).get_json()["data"]
    client.post("/api/v1/auth/logout", json={"refresh_token": login2["refresh_token"]}, headers={"Authorization": f"Bearer {login2['access_token']}"})
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": login2["refresh_token"]}).status_code == 401

    client.put(
        "/api/v1/settings",
        json={"security": {"jwt_access_minutes": Config.JWT_ACCESS_TTL_MINUTES, "jwt_refresh_days": Config.JWT_REFRESH_TTL_DAYS}},
        headers=auth_headers,
    )


# ==============================================================================
# PENGUJIAN CAPTCHA (PB-CAPTCHA)
# ==============================================================================
def test_captcha_endpoint_generates_valid_challenge(client):
    res = client.get("/api/v1/auth/captcha")
    assert res.status_code == 200
    body = res.get_json()
    assert body["success"] is True
    data = body["data"]
    assert "captcha_id" in data and len(data["captcha_id"]) == 36  # UUID v4
    assert data["image"].startswith("data:image/png;base64,")
    assert data["expires_in"] == 300


def test_login_with_valid_captcha(client):
    from app.services.captcha_service import captcha_service, _hash_answer

    cid = "test-cid-valid-1"
    code = "7KX9M2"
    captcha_service._in_memory_store.set(cid, _hash_answer(code), 300)

    res = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123", "captcha_id": cid, "captcha_answer": "7kx9m2"},
    )
    assert res.status_code == 200
    assert res.get_json()["success"] is True
    assert "access_token" in res.get_json()["data"]


def test_login_with_invalid_captcha_fails(client):
    from app.services.captcha_service import captcha_service, _hash_answer

    cid = "test-cid-invalid-1"
    captcha_service._in_memory_store.set(cid, _hash_answer("ABCDEF"), 300)

    res = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123", "captcha_id": cid, "captcha_answer": "WRONG1"},
    )
    assert res.status_code == 400
    body = res.get_json()
    assert body["success"] is False
    assert body["error_code"] == "INVALID_CAPTCHA"


def test_captcha_single_use_replay_fails(client):
    from app.services.captcha_service import captcha_service, _hash_answer

    cid = "test-cid-replay-1"
    code = "4PQ7XY"
    captcha_service._in_memory_store.set(cid, _hash_answer(code), 300)

    # Penggunaan pertama: sukses
    res1 = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123", "captcha_id": cid, "captcha_answer": code},
    )
    assert res1.status_code == 200

    # Penggunaan kedua (replay attack): harus ditolak
    res2 = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123", "captcha_id": cid, "captcha_answer": code},
    )
    assert res2.status_code == 400
    assert res2.get_json()["error_code"] == "INVALID_CAPTCHA"


def test_login_with_expired_captcha_fails(client):
    from app.services.captcha_service import captcha_service, _hash_answer

    cid = "test-cid-expired-1"
    code = "234567"
    # Set challenge dengan TTL negatif (sudah kedaluwarsa)
    captcha_service._in_memory_store.set(cid, _hash_answer(code), -10)

    res = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "admin123", "captcha_id": cid, "captcha_answer": code},
    )
    assert res.status_code == 400
    body = res.get_json()
    assert body["error_code"] == "INVALID_CAPTCHA"
    assert "kedaluwarsa" in body["message"] or "tidak ditemukan" in body["message"]
