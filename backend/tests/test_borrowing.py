"""Tests for Borrowing endpoints."""
from datetime import date, timedelta
import uuid


def test_checkout_borrowing_workflow(client, auth_headers):
    # 1. Create a fresh available asset
    unique_code = f"AST-LOAN-{uuid.uuid4().hex[:6].upper()}"
    asset_res = client.post(
        "/api/v1/assets",
        json={
            "inventory_code": unique_code,
            "category_id": 1,
            "name": "Projector Epson EB-X500",
            "status": "TERSEDIA",
            "condition": "BAIK",
        },
        headers=auth_headers,
    )
    assert asset_res.status_code == 201
    asset_id = asset_res.get_json()["data"]["id"]

    today = date.today()
    due_date = today + timedelta(days=7)

    # 2. Checkout borrowing
    checkout_payload = {
        "borrower_id": 1,
        "start_date": today.isoformat(),
        "due_date": due_date.isoformat(),
        "purpose": "Presentasi Kurikulum",
        "asset_ids": [asset_id],
    }
    borrow_res = client.post("/api/v1/borrowings", json=checkout_payload, headers=auth_headers)
    assert borrow_res.status_code == 201
    borrowing_data = borrow_res.get_json()["data"]
    assert borrowing_data["status"] == "AKTIF"
    assert len(borrowing_data["items"]) == 1
    assert borrowing_data["items"][0]["asset_id"] == asset_id

    # 3. Check asset status is now DIPINJAM
    asset_check = client.get(f"/api/v1/assets/{asset_id}", headers=auth_headers)
    assert asset_check.get_json()["data"]["status"] == "DIPINJAM"

    # 4. Attempt to borrow the same asset again while it's DIPINJAM must fail
    fail_res = client.post("/api/v1/borrowings", json=checkout_payload, headers=auth_headers)
    assert fail_res.status_code == 400
    assert "tidak tersedia untuk dipinjam" in fail_res.get_json()["message"]


def test_checkout_invalid_dates(client, auth_headers):
    today = date.today()
    past_due_date = today - timedelta(days=2)

    payload = {
        "borrower_id": 1,
        "start_date": today.isoformat(),
        "due_date": past_due_date.isoformat(),
        "asset_ids": [1],
    }
    res = client.post("/api/v1/borrowings", json=payload, headers=auth_headers)
    assert res.status_code == 400
    assert res.get_json()["error_code"] == "VALIDATION_ERROR"
