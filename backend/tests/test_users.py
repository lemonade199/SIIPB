"""Kelola pengguna, role & permission."""


def test_permissions_and_roles(client, auth_headers):
    perms = client.get("/api/v1/permissions", headers=auth_headers).get_json()["data"]
    assert len(perms) == 16
    roles = {r["code"]: r for r in client.get("/api/v1/roles", headers=auth_headers).get_json()["data"]}
    assert set(roles) >= {"ADMIN", "SARPRAS", "PIMPINAN"}
    assert len(roles["ADMIN"]["permissions"]) == 16
    assert "inventory.manage" not in roles["PIMPINAN"]["permissions"]


def test_user_crud_and_deactivate(client, auth_headers):
    res = client.post("/api/v1/users", json={
        "username": "staf.baru", "email": "staf.baru@contoh.id", "full_name": "Staf Baru",
        "password": "Password123", "role_id": 3, "phone": "0812-3456-7890"}, headers=auth_headers)
    assert res.status_code == 201
    uid = res.get_json()["data"]["id"]
    dup = client.post("/api/v1/users", json={
        "username": "staf.baru", "email": "lain@contoh.id", "full_name": "Orang Lain", "password": "Password123", "role_id": 3}, headers=auth_headers)
    assert dup.status_code == 400 and "username" in dup.get_json()["errors"]
    login = client.post("/api/v1/auth/login", json={"username": "staf.baru", "password": "Password123"})
    h = {"Authorization": f"Bearer {login.get_json()['data']['access_token']}"}
    assert client.get("/api/v1/dashboard/summary", headers=h).status_code == 200
    # nonaktifkan -> token langsung ditolak
    assert client.put(f"/api/v1/users/{uid}", json={"is_active": False}, headers=auth_headers).status_code == 200
    assert client.get("/api/v1/dashboard/summary", headers=h).status_code == 401
    assert client.post("/api/v1/auth/login", json={"username": "staf.baru", "password": "Password123"}).status_code == 401


def test_cannot_remove_last_admin(client, auth_headers):
    me = client.get("/api/v1/auth/me", headers=auth_headers).get_json()["data"]
    res = client.put(f"/api/v1/users/{me['id']}", json={"is_active": False}, headers=auth_headers)
    assert res.status_code == 400
    res = client.put(f"/api/v1/users/{me['id']}", json={"role_id": 2}, headers=auth_headers)
    assert res.status_code == 400


def test_role_permission_change_applies_immediately(client, auth_headers, pimpinan_headers):
    roles = {r["code"]: r for r in client.get("/api/v1/roles", headers=auth_headers).get_json()["data"]}
    pim = roles["PIMPINAN"]
    assert client.get("/api/v1/audit-logs", headers=pimpinan_headers).status_code == 403
    client.put(f"/api/v1/roles/{pim['id']}", json={"permissions": pim["permissions"] + ["audit.view"]}, headers=auth_headers)
    assert client.get("/api/v1/audit-logs", headers=pimpinan_headers).status_code == 200
    client.put(f"/api/v1/roles/{pim['id']}", json={"permissions": pim["permissions"]}, headers=auth_headers)
    assert client.get("/api/v1/audit-logs", headers=pimpinan_headers).status_code == 403


def test_custom_role_lifecycle(client, auth_headers):
    res = client.post("/api/v1/roles", json={"code": "gudang", "name": "Petugas Gudang", "permissions": ["inventory.view"]}, headers=auth_headers)
    assert res.status_code == 201 and res.get_json()["data"]["code"] == "GUDANG"
    rid = res.get_json()["data"]["id"]
    bad = client.put(f"/api/v1/roles/{rid}", json={"permissions": ["tidak.ada"]}, headers=auth_headers)
    assert bad.status_code == 400
    assert client.delete(f"/api/v1/roles/{rid}", headers=auth_headers).status_code == 200
    sys_role = client.get("/api/v1/roles", headers=auth_headers).get_json()["data"][0]
    assert client.delete(f"/api/v1/roles/{sys_role['id']}", headers=auth_headers).status_code == 400


def test_permission_catalog_contract(client, auth_headers):
    res = client.get("/api/v1/permissions", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert len(data) == 16
    for item in data:
        assert "code" in item and "name" in item and "module" in item and "description" in item
        assert isinstance(item["code"], str)
        assert len(item["code"]) > 0


def test_role_with_empty_permissions(client, auth_headers):
    res = client.post(
        "/api/v1/roles",
        json={"code": "tamu", "name": "Pengunjung Tamu", "permissions": []},
        headers=auth_headers,
    )
    assert res.status_code == 201
    role_data = res.get_json()["data"]
    rid = role_data["id"]
    assert role_data["permissions"] == []

    get_res = client.get(f"/api/v1/roles/{rid}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.get_json()["data"]["permissions"] == []

    u_res = client.post(
        "/api/v1/users",
        json={
            "username": "tamu.user",
            "email": "tamu@contoh.id",
            "full_name": "Tamu User",
            "password": "Password123",
            "role_id": rid,
        },
        headers=auth_headers,
    )
    assert u_res.status_code == 201
    uid = u_res.get_json()["data"]["id"]

    # Login user tamu -> tidak punya akses ke audit logs atau assets
    tamu_login = client.post("/api/v1/auth/login", json={"username": "tamu.user", "password": "Password123"})
    tamu_headers = {"Authorization": f"Bearer {tamu_login.get_json()['data']['access_token']}"}
    assert client.get("/api/v1/audit-logs", headers=tamu_headers).status_code == 403
    assert client.get("/api/v1/assets", headers=tamu_headers).status_code == 403

    # Beri akses lihat inventaris
    client.put(f"/api/v1/roles/{rid}", json={"permissions": ["inventory.view"]}, headers=auth_headers)
    assert client.get("/api/v1/assets", headers=tamu_headers).status_code == 200
    assert client.get("/api/v1/audit-logs", headers=tamu_headers).status_code == 403

    # Reassign user role ke role lain sebelum menghapus role tamu
    client.put(f"/api/v1/users/{uid}", json={"role_id": 3}, headers=auth_headers)
    assert client.delete(f"/api/v1/roles/{rid}", headers=auth_headers).status_code == 200


def test_user_and_profile_phone_validation(client, auth_headers):
    bad = client.post("/api/v1/users", json={"username": "telp.salah", "email": "telp.salah@contoh.id", "full_name": "Telp Salah",
                                             "password": "Password123", "role_id": 3, "phone": "12345"}, headers=auth_headers)
    assert bad.status_code == 400 and "phone" in bad.get_json()["errors"]
    me = client.put("/api/v1/auth/me", json={"phone": "+62 812 0000 1111"}, headers=auth_headers)
    assert me.status_code == 200 and me.get_json()["data"]["phone"] == "081200001111"
    assert client.put("/api/v1/auth/me", json={"phone": "bukan-nomor"}, headers=auth_headers).status_code == 400
