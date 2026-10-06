"""Tests for Return processing and incident reporting."""
from datetime import date, timedelta
import uuid


def test_return_condition_baik(client, auth_headers):
    # 1. Create asset & borrow
    unique_code = f"AST-RET-{uuid.uuid4().hex[:6].upper()}"
    asset_res = client.post(
        "/api/v1/assets",
        json={"inventory_code": unique_code, "category_id": 1, "name": "Monitor Dell 24 inch", "status": "TERSEDIA"},
        headers=auth_headers,
    )
    asset_id = asset_res.get_json()["data"]["id"]

    today = date.today()
    borrow_res = client.post(
        "/api/v1/borrowings",
        json={
            "borrower_id": 1,
            "start_date": today.isoformat(),
            "due_date": (today + timedelta(days=3)).isoformat(),
            "asset_ids": [asset_id],
        },
        headers=auth_headers,
    )
    b_data = borrow_res.get_json()["data"]
    borrowing_id = b_data["id"]
    borrowing_item_id = b_data["items"][0]["id"]

    # 2. Process return with condition BAIK
    return_payload = {
        "borrowing_id": borrowing_id,
        "items": [
            {
                "borrowing_item_id": borrowing_item_id,
                "asset_id": asset_id,
                "final_condition": "BAIK",
                "completeness": "Lengkap",
                "notes": "Barang kembali mulus",
            }
        ],
    }
    ret_res = client.post("/api/v1/returns", json=return_payload, headers=auth_headers)
    assert ret_res.status_code == 201

    # 3. Verify asset status restored to TERSEDIA
    asset_check = client.get(f"/api/v1/assets/{asset_id}", headers=auth_headers)
    assert asset_check.get_json()["data"]["status"] == "TERSEDIA"

    # 4. Verify borrowing status is DIKEMBALIKAN
    borrowing_check = client.get(f"/api/v1/borrowings/{borrowing_id}", headers=auth_headers)
    assert borrowing_check.get_json()["data"]["status"] == "DIKEMBALIKAN"


def test_return_condition_rusak_and_repair_lifecycle(client, auth_headers):
    # 1. Create asset & borrow
    unique_code = f"AST-DMG-{uuid.uuid4().hex[:6].upper()}"
    asset_res = client.post(
        "/api/v1/assets",
        json={"inventory_code": unique_code, "category_id": 1, "name": "Laptop HP Pavilion", "status": "TERSEDIA"},
        headers=auth_headers,
    )
    asset_id = asset_res.get_json()["data"]["id"]

    today = date.today()
    borrow_res = client.post(
        "/api/v1/borrowings",
        json={
            "borrower_id": 1,
            "start_date": today.isoformat(),
            "due_date": (today + timedelta(days=2)).isoformat(),
            "asset_ids": [asset_id],
        },
        headers=auth_headers,
    )
    b_data = borrow_res.get_json()["data"]
    borrowing_id = b_data["id"]
    borrowing_item_id = b_data["items"][0]["id"]

    # 2. Process return with condition RUSAK
    return_payload = {
        "borrowing_id": borrowing_id,
        "items": [
            {
                "borrowing_item_id": borrowing_item_id,
                "asset_id": asset_id,
                "final_condition": "RUSAK",
                "damage": {
                    "severity": "SEDANG",
                    "description": "Engsel laptop retak saat pemakaian",
                    "repair_cost": 250000,
                },
            }
        ],
    }
    ret_res = client.post("/api/v1/returns", json=return_payload, headers=auth_headers)
    assert ret_res.status_code == 201
    ret_data = ret_res.get_json()["data"]
    damage_report = ret_data["items"][0]["damage_report"]
    assert damage_report is not None
    assert damage_report["repair_status"] == "DILAPORKAN"
    damage_report_id = damage_report["id"]

    # 3. Check asset status is RUSAK
    asset_check = client.get(f"/api/v1/assets/{asset_id}", headers=auth_headers)
    assert asset_check.get_json()["data"]["status"] == "RUSAK"

    # 4. Progress repair status to SELESAI
    repair_update_res = client.put(
        f"/api/v1/damage-reports/{damage_report_id}/repair-status",
        json={"repair_status": "SELESAI", "action_taken": "Engsel diganti baru"},
        headers=auth_headers,
    )
    assert repair_update_res.status_code == 200

    # 5. Asset status should automatically revert to TERSEDIA
    asset_restored = client.get(f"/api/v1/assets/{asset_id}", headers=auth_headers)
    assert asset_restored.get_json()["data"]["status"] == "TERSEDIA"
