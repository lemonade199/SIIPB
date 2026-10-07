"""Peminjaman oleh petugas: draf, checkout, validasi ketersediaan, notifikasi konfirmasi (§20)."""
from datetime import date, timedelta


def test_checkout_direct_sends_confirmation(client, auth_headers, make_borrowing):
    b = make_borrowing(n_items=2)
    assert b["status"] == "AKTIF" and b["transaction_number"].startswith(f"PJM-{date.today().year}-")
    assert b["checked_out_at"] and len(b["items"]) == 2
    for it in b["items"]:
        assert client.get(f"/api/v1/assets/{it['asset_id']}", headers=auth_headers).get_json()["data"]["status"] == "DIPINJAM"
    notifs = client.get(f"/api/v1/notifications?borrowing_id={b['id']}", headers=auth_headers).get_json()["data"]
    assert len(notifs) == 1
    n = notifs[0]
    assert n["event"] == "CHECKOUT" and n["status"] == "SENT" and n["recipient_type"] == "PEMINJAM"
    assert b["transaction_number"] in n["subject"]
    for it in b["items"]:
        assert it["inventory_code"] in n["body"]  # email memuat nama/kode barang
    assert "{{" not in n["body"]


def test_unavailable_asset_rejected_atomically(client, auth_headers, make_borrowing, make_asset):
    b = make_borrowing()
    free = make_asset()
    res = client.post("/api/v1/borrowings", json={
        "borrower_id": 1, "start_date": date.today().isoformat(), "due_date": (date.today() + timedelta(days=3)).isoformat(),
        "asset_ids": [free["id"], b["items"][0]["asset_id"]]}, headers=auth_headers)
    assert res.status_code == 400 and "tidak tersedia" in res.get_json()["message"]
    # tidak ada perubahan parsial
    assert client.get(f"/api/v1/assets/{free['id']}", headers=auth_headers).get_json()["data"]["status"] == "TERSEDIA"


def test_invalid_dates(client, auth_headers):
    res = client.post("/api/v1/borrowings", json={
        "borrower_id": 1, "start_date": date.today().isoformat(),
        "due_date": (date.today() - timedelta(days=2)).isoformat(), "asset_ids": [1]}, headers=auth_headers)
    assert res.status_code == 400 and res.get_json()["error_code"] == "VALIDATION_ERROR"


def test_borrower_without_email_rejected(client, auth_headers, make_asset):
    bor = client.post("/api/v1/borrowers", json={"name": "Tanpa Email"}, headers=auth_headers).get_json()["data"]
    a = make_asset()
    res = client.post("/api/v1/borrowings", json={
        "borrower_id": bor["id"], "start_date": date.today().isoformat(),
        "due_date": (date.today() + timedelta(days=2)).isoformat(), "asset_ids": [a["id"]]}, headers=auth_headers)
    assert res.status_code == 400 and "email" in res.get_json()["message"]


def test_draft_edit_checkout_flow(client, auth_headers, make_borrowing, make_asset):
    d = make_borrowing(checkout=False)
    assert d["status"] == "DRAF" and d["checked_out_at"] is None
    aid = d["items"][0]["asset_id"]
    assert client.get(f"/api/v1/assets/{aid}", headers=auth_headers).get_json()["data"]["status"] == "TERSEDIA"
    assert client.get(f"/api/v1/notifications?borrowing_id={d['id']}", headers=auth_headers).get_json()["meta"]["total"] == 0
    extra = make_asset()
    upd = client.put(f"/api/v1/borrowings/{d['id']}", json={
        "borrower_id": 2, "start_date": d["start_date"], "due_date": d["due_date"], "purpose": "Diubah",
        "asset_ids": [aid, extra["id"]]}, headers=auth_headers)
    assert upd.status_code == 200 and len(upd.get_json()["data"]["items"]) == 2
    co = client.post(f"/api/v1/borrowings/{d['id']}/checkout", headers=auth_headers)
    assert co.status_code == 200 and co.get_json()["data"]["status"] == "AKTIF"
    assert client.post(f"/api/v1/borrowings/{d['id']}/checkout", headers=auth_headers).status_code == 400
    assert client.put(f"/api/v1/borrowings/{d['id']}", json=upd.get_json()["data"] | {"asset_ids": [aid]}, headers=auth_headers).status_code == 400


def test_cancel_draft(client, auth_headers, make_borrowing):
    d = make_borrowing(checkout=False)
    assert client.post(f"/api/v1/borrowings/{d['id']}/cancel", json={}, headers=auth_headers).status_code == 400
    res = client.post(f"/api/v1/borrowings/{d['id']}/cancel", json={"reason": "Batal kegiatan"}, headers=auth_headers)
    assert res.status_code == 200 and res.get_json()["data"]["status"] == "DIBATALKAN"
    assert res.get_json()["data"]["cancel_reason"] == "Batal kegiatan"


def test_checkout_past_due_marks_late(client, make_borrowing):
    b = make_borrowing(start=date.today() - timedelta(days=10), due=date.today() - timedelta(days=2))
    assert b["status"] == "TERLAMBAT" and b["late_days"] == 2


def test_list_filters(client, auth_headers, make_borrowing):
    b = make_borrowing()
    res = client.get(f"/api/v1/borrowings?search={b['transaction_number']}", headers=auth_headers).get_json()
    assert res["meta"]["total"] == 1
    res = client.get("/api/v1/borrowings?status=DRAF", headers=auth_headers).get_json()["data"]
    assert all(x["status"] == "DRAF" for x in res)
