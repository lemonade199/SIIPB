"""Inventaris: CRUD, kode otomatis, tahun perolehan, status manual, foto, QR, alias /items."""
import io

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def test_create_with_purchase_date_and_auto_code(client, auth_headers):
    res = client.post("/api/v1/assets", json={
        "category_id": 1, "location_id": 2, "name": "Laptop Uji", "purchase_date": "2024-01-01",
        "acquisition_cost": 12500000, "acquisition_source": "Hibah", "brand": "Lenovo"}, headers=auth_headers)
    assert res.status_code == 201, res.get_json()
    a = res.get_json()["data"]
    assert a["inventory_code"].startswith("INV-LPT-")
    assert a["purchase_date"] == "2024-01-01" and a["acquisition_source"] == "Hibah"
    upd = client.put(f"/api/v1/assets/{a['id']}", json={"purchase_date": "2023-01-01", "location_id": 3}, headers=auth_headers)
    assert upd.status_code == 200 and upd.get_json()["data"]["purchase_date"] == "2023-01-01"
    hist = client.get(f"/api/v1/assets/{a['id']}/history", headers=auth_headers).get_json()["data"]
    assert {h["event_type"] for h in hist} >= {"CREATED", "LOCATION_CHANGE"}


def test_validation(client, auth_headers):
    res = client.post("/api/v1/assets", json={"name": "X"}, headers=auth_headers)
    assert res.status_code == 400 and "category_id" in res.get_json()["errors"]
    assert client.post("/api/v1/assets", json={"category_id": 1, "name": "Ok", "acquisition_cost": -1}, headers=auth_headers).status_code == 400
    assert client.post("/api/v1/assets", json={"category_id": 1, "name": "Ok", "status": "DIPINJAM"}, headers=auth_headers).status_code == 400


def test_duplicate_code(client, auth_headers, make_asset):
    a = make_asset()
    res = client.post("/api/v1/assets", json={"inventory_code": a["inventory_code"], "category_id": 1, "name": "Dup"}, headers=auth_headers)
    assert res.status_code == 400


def test_manual_status_rules(client, auth_headers, make_asset, make_borrowing):
    a = make_asset()
    res = client.post(f"/api/v1/assets/{a['id']}/status", json={"status": "DALAM_PERBAIKAN", "reason": "Servis"}, headers=auth_headers)
    assert res.status_code == 200 and res.get_json()["data"]["condition"] == "RUSAK_RINGAN"
    res = client.post(f"/api/v1/assets/{a['id']}/status", json={"status": "TERSEDIA"}, headers=auth_headers)
    assert res.get_json()["data"]["condition"] == "BAIK"
    assert client.post(f"/api/v1/assets/{a['id']}/status", json={"status": "DIPINJAM"}, headers=auth_headers).status_code == 400
    b = make_borrowing()
    lent = b["items"][0]["asset_id"]
    assert client.post(f"/api/v1/assets/{lent}/status", json={"status": "RUSAK"}, headers=auth_headers).status_code == 400
    assert client.put(f"/api/v1/assets/{lent}", json={"is_active": False}, headers=auth_headers).status_code == 400


def test_deactivate_and_filter(client, auth_headers, make_asset):
    a = make_asset()
    assert client.put(f"/api/v1/assets/{a['id']}", json={"is_active": False, "reason": "Afkir"}, headers=auth_headers).status_code == 200
    rows = client.get("/api/v1/assets?is_active=false&per_page=100", headers=auth_headers).get_json()["data"]
    assert a["id"] in [r["id"] for r in rows]


def test_photos(client, auth_headers, make_asset):
    a = make_asset()
    url = f"/api/v1/assets/{a['id']}/photos"
    res = client.post(url, data={"files": [(io.BytesIO(PNG), "a.png"), (io.BytesIO(PNG), "b.png")]},
                      headers=auth_headers, content_type="multipart/form-data")
    assert res.status_code == 200, res.get_json()
    photos = res.get_json()["data"]["photos"]
    assert len(photos) == 2 and res.get_json()["data"]["photo_path"] == photos[0]["path"]
    fake = client.post(url, data={"files": [(io.BytesIO(b"<script>"), "x.png")]}, headers=auth_headers, content_type="multipart/form-data")
    assert fake.status_code == 400
    exe = client.post(url, data={"files": [(io.BytesIO(PNG), "x.exe")]}, headers=auth_headers, content_type="multipart/form-data")
    assert exe.status_code == 400
    order = client.put(f"{url}/order", json={"photo_ids": [photos[1]["id"], photos[0]["id"]]}, headers=auth_headers)
    assert order.get_json()["data"]["photo_path"] == photos[1]["path"]
    rm = client.delete(f"{url}/{photos[1]['id']}", headers=auth_headers)
    assert rm.get_json()["data"]["photo_path"] == photos[0]["path"]
    too_many = client.post(url, data={"files": [(io.BytesIO(PNG), f"{i}.png") for i in range(5)]}, headers=auth_headers, content_type="multipart/form-data")
    assert too_many.status_code == 400


def test_qr_and_scan(client, auth_headers, make_asset):
    a = make_asset()
    svg = client.get(f"/api/v1/assets/{a['id']}/qr", headers=auth_headers)
    assert svg.status_code == 200 and svg.mimetype == "image/svg+xml"
    png = client.get(f"/api/v1/assets/{a['id']}/qr?format=png", headers=auth_headers)
    assert png.data.startswith(b"\x89PNG")
    scan = client.get(f"/api/v1/assets/by-code/SIIPB:{a['inventory_code']}", headers=auth_headers)
    assert scan.status_code == 200 and scan.get_json()["data"]["id"] == a["id"]


def test_items_alias(client, auth_headers):
    assets = client.get("/api/v1/assets", headers=auth_headers).get_json()["meta"]["total"]
    items = client.get("/api/v1/items", headers=auth_headers).get_json()["meta"]["total"]
    assert assets == items
    res = client.post("/api/v1/items", json={"category_id": 2, "name": "Proyektor via /items"}, headers=auth_headers)
    assert res.status_code == 201
