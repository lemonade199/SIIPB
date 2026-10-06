"""Tests for Master Data and Dashboard APIs."""
import uuid


def test_master_endpoints(client, auth_headers):
    # 1. Units
    units_res = client.get("/api/v1/organizational-units", headers=auth_headers)
    assert units_res.status_code == 200
    assert len(units_res.get_json()["data"]) >= 1

    # 2. Categories
    cat_res = client.get("/api/v1/categories", headers=auth_headers)
    assert cat_res.status_code == 200
    assert len(cat_res.get_json()["data"]) >= 1

    # 3. Locations
    loc_res = client.get("/api/v1/locations", headers=auth_headers)
    assert loc_res.status_code == 200
    assert len(loc_res.get_json()["data"]) >= 1

    # 4. Borrowers
    bor_res = client.get("/api/v1/borrowers", headers=auth_headers)
    assert bor_res.status_code == 200
    assert len(bor_res.get_json()["data"]) >= 1


def test_create_and_manage_borrower(client, auth_headers):
    unique_id = uuid.uuid4().hex[:6]
    payload = {
        "name": f"Peminjam Test {unique_id}",
        "identity_number": f"ID-{unique_id}",
        "email": f"peminjam_{unique_id}@example.com",
        "phone": "08123456789",
        "position": "Guru Produktif",
        "unit_id": 1,
    }
    create_res = client.post("/api/v1/borrowers", json=payload, headers=auth_headers)
    assert create_res.status_code == 201
    created_id = create_res.get_json()["data"]["id"]

    # Update borrower
    upd_res = client.put(f"/api/v1/borrowers/{created_id}", json={"position": "Kepala Lab"}, headers=auth_headers)
    assert upd_res.status_code == 200

    # Delete borrower (soft delete)
    del_res = client.delete(f"/api/v1/borrowers/{created_id}", headers=auth_headers)
    assert del_res.status_code == 200


def test_dashboard_summary(client, auth_headers):
    res = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert "assets" in data
    assert "borrowings" in data
    assert "incidents" in data
    assert data["assets"]["total"] >= 1
