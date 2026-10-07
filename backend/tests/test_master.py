"""Master data: kategori, lokasi, unit kerja, peminjam."""


def test_lists(client, auth_headers):
    for path in ("organizational-units", "categories", "locations", "borrowers"):
        res = client.get(f"/api/v1/{path}", headers=auth_headers)
        assert res.status_code == 200 and len(res.get_json()["data"]) >= 1


def test_category_crud_and_delete_rules(client, auth_headers, make_asset):
    res = client.post("/api/v1/categories", json={"code": "TST", "name": "Kategori Tes"}, headers=auth_headers)
    assert res.status_code == 201
    cid = res.get_json()["data"]["id"]
    assert client.post("/api/v1/categories", json={"code": "TST", "name": "Duplikat"}, headers=auth_headers).status_code == 400
    assert client.put(f"/api/v1/categories/{cid}", json={"name": "Kategori Tes 2"}, headers=auth_headers).get_json()["data"]["name"] == "Kategori Tes 2"
    make_asset(category_id=cid)
    used = client.delete(f"/api/v1/categories/{cid}", headers=auth_headers)
    assert used.status_code == 400 and "nonaktifkan" in used.get_json()["message"]
    assert client.put(f"/api/v1/categories/{cid}", json={"is_active": False}, headers=auth_headers).status_code == 200
    active = [c["id"] for c in client.get("/api/v1/categories", headers=auth_headers).get_json()["data"]]
    every = [c["id"] for c in client.get("/api/v1/categories?all=1", headers=auth_headers).get_json()["data"]]
    assert cid not in active and cid in every
    res = client.post("/api/v1/categories", json={"code": "HPS", "name": "Hapus Saya"}, headers=auth_headers)
    assert client.delete(f"/api/v1/categories/{res.get_json()['data']['id']}", headers=auth_headers).status_code == 200


def test_location_and_unit_update(client, auth_headers):
    loc = client.post("/api/v1/locations", json={"code": "LAB-1", "name": "Lab 1", "description": "Gedung B"}, headers=auth_headers).get_json()["data"]
    assert client.put(f"/api/v1/locations/{loc['id']}", json={"name": "Lab Komputer 1"}, headers=auth_headers).status_code == 200
    unit = client.post("/api/v1/organizational-units", json={"code": "PERPUS", "name": "Perpustakaan"}, headers=auth_headers).get_json()["data"]
    assert client.put(f"/api/v1/organizational-units/{unit['id']}", json={"is_active": False}, headers=auth_headers).status_code == 200


def test_borrower_crud(client, auth_headers, petugas_headers, pimpinan_headers):
    res = client.post("/api/v1/borrowers", json={"name": "Peminjam Uji", "identity_number": "NIP-UJI-1", "email": "uji@contoh.id", "unit_id": 1},
                      headers=petugas_headers)
    assert res.status_code == 201
    bid = res.get_json()["data"]["id"]
    assert client.post("/api/v1/borrowers", json={"name": "Lain", "identity_number": "NIP-UJI-1"}, headers=petugas_headers).status_code == 400
    assert client.post("/api/v1/borrowers", json={"name": "X", "email": "bukan-email"}, headers=petugas_headers).status_code == 400
    assert client.post("/api/v1/borrowers", json={"name": "Lain"}, headers=pimpinan_headers).status_code == 403
    assert client.put(f"/api/v1/borrowers/{bid}", json={"phone": "0811"}, headers=petugas_headers).get_json()["data"]["phone"] == "0811"
    assert client.delete(f"/api/v1/borrowers/{bid}", headers=petugas_headers).status_code == 200
