"""Tests for Asset endpoints."""
import uuid


def test_list_assets(client, auth_headers):
    res = client.get("/api/v1/assets", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert isinstance(data["data"], list)
    assert "meta" in data


def test_create_and_get_asset(client, auth_headers):
    unique_code = f"AST-TEST-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "inventory_code": unique_code,
        "category_id": 1,
        "location_id": 1,
        "name": "ThinkPad T14 Gen 3 Test",
        "brand": "Lenovo",
        "model": "T14 Gen 3",
        "serial_number": f"SN-{uuid.uuid4().hex[:8]}",
        "status": "TERSEDIA",
        "condition": "BAIK",
    }
    create_res = client.post("/api/v1/assets", json=payload, headers=auth_headers)
    assert create_res.status_code == 201
    created = create_res.get_json()["data"]
    asset_id = created["id"]
    assert created["inventory_code"] == unique_code

    # Get detail
    detail_res = client.get(f"/api/v1/assets/{asset_id}", headers=auth_headers)
    assert detail_res.status_code == 200
    assert detail_res.get_json()["data"]["name"] == "ThinkPad T14 Gen 3 Test"

    # Get history
    history_res = client.get(f"/api/v1/assets/{asset_id}/history", headers=auth_headers)
    assert history_res.status_code == 200
    histories = history_res.get_json()["data"]
    assert len(histories) >= 1
    assert histories[0]["event_type"] == "CREATED"


def test_create_asset_duplicate_code(client, auth_headers):
    unique_code = f"AST-DUP-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "inventory_code": unique_code,
        "category_id": 1,
        "name": "Original Asset Test",
    }
    first_res = client.post("/api/v1/assets", json=payload, headers=auth_headers)
    assert first_res.status_code == 201

    # Try creating with duplicate inventory_code
    duplicate_payload = {
        "inventory_code": unique_code,
        "category_id": 1,
        "name": "Duplicate Asset Test",
    }
    res = client.post("/api/v1/assets", json=duplicate_payload, headers=auth_headers)
    assert res.status_code == 400
    data = res.get_json()
    assert data["success"] is False
    assert "sudah digunakan" in data["message"]

