"""Pengembalian: kondisi akhir, kerusakan/kehilangan, status barang, konfirmasi email."""
from datetime import date, timedelta


def _items(b, cond, **extra):
    return [{"borrowing_item_id": it["id"], "asset_id": it["asset_id"], "final_condition": cond, "completeness": "Lengkap", **extra}
            for it in b["items"]]


def test_return_good(client, auth_headers, make_borrowing):
    b = make_borrowing()
    res = client.post("/api/v1/returns", json={"borrowing_id": b["id"], "items": _items(b, "BAIK")}, headers=auth_headers)
    assert res.status_code == 201, res.get_json()
    r = res.get_json()["data"]
    assert r["late_days"] == 0
    detail = client.get(f"/api/v1/borrowings/{b['id']}", headers=auth_headers).get_json()["data"]
    assert detail["status"] == "DIKEMBALIKAN" and detail["returned_at"]
    asset = client.get(f"/api/v1/assets/{b['items'][0]['asset_id']}", headers=auth_headers).get_json()["data"]
    assert asset["status"] == "TERSEDIA"
    notifs = client.get(f"/api/v1/notifications?borrowing_id={b['id']}&event=PENGEMBALIAN", headers=auth_headers).get_json()["data"]
    assert len(notifs) == 1 and notifs[0]["status"] == "SENT"
    # tidak bisa dikembalikan dua kali
    again = client.post("/api/v1/returns", json={"borrowing_id": b["id"], "items": _items(b, "BAIK")}, headers=auth_headers)
    assert again.status_code == 400


def test_return_damaged_heavy_and_repair(client, auth_headers, make_borrowing):
    b = make_borrowing()
    res = client.post("/api/v1/returns", json={"borrowing_id": b["id"], "items": _items(
        b, "RUSAK", damage={"severity": "BERAT", "description": "Layar pecah"})}, headers=auth_headers)
    assert res.status_code == 201
    item = res.get_json()["data"]["items"][0]
    assert item["asset_status_after"] == "RUSAK_BERAT" and item["damage_report"]["severity"] == "BERAT"
    asset = client.get(f"/api/v1/assets/{item['asset_id']}", headers=auth_headers).get_json()["data"]
    assert asset["status"] == "RUSAK_BERAT" and asset["condition"] == "RUSAK_BERAT"
    # barang rusak berat tidak bisa dipinjam
    bad = client.post("/api/v1/borrowings", json={"borrower_id": 1, "start_date": date.today().isoformat(),
                                                  "due_date": date.today().isoformat(), "asset_ids": [item["asset_id"]]}, headers=auth_headers)
    assert bad.status_code == 400
    rep = client.put(f"/api/v1/damage-reports/{item['damage_report']['id']}/repair-status",
                     json={"repair_status": "SELESAI", "action_taken": "Ganti layar"}, headers=auth_headers)
    assert rep.status_code == 200
    assert client.get(f"/api/v1/assets/{item['asset_id']}", headers=auth_headers).get_json()["data"]["status"] == "TERSEDIA"


def test_return_in_repair_and_lost(client, auth_headers, make_borrowing):
    b = make_borrowing(n_items=2)
    i1, i2 = b["items"]
    res = client.post("/api/v1/returns", json={"borrowing_id": b["id"], "items": [
        {"borrowing_item_id": i1["id"], "asset_id": i1["asset_id"], "final_condition": "RUSAK", "asset_status": "DALAM_PERBAIKAN",
         "completeness": "Tidak lengkap: charger", "damage": {"severity": "SEDANG", "description": "Engsel longgar"}},
        {"borrowing_item_id": i2["id"], "asset_id": i2["asset_id"], "final_condition": "HILANG", "loss": {"description": "Hilang di lokasi kegiatan"}},
    ]}, headers=auth_headers)
    assert res.status_code == 201, res.get_json()
    assets = {a: client.get(f"/api/v1/assets/{a}", headers=auth_headers).get_json()["data"]["status"] for a in (i1["asset_id"], i2["asset_id"])}
    assert assets == {i1["asset_id"]: "DALAM_PERBAIKAN", i2["asset_id"]: "HILANG"}
    losses = client.get("/api/v1/loss-reports", headers=auth_headers).get_json()["data"]
    assert any(l["inventory_code"] == i2["inventory_code"] for l in losses)


def test_damage_requires_description(client, auth_headers, make_borrowing):
    b = make_borrowing()
    res = client.post("/api/v1/returns", json={"borrowing_id": b["id"], "items": _items(b, "RUSAK", damage={"severity": "RINGAN", "description": ""})},
                      headers=auth_headers)
    assert res.status_code == 400


def test_late_return_with_date(client, auth_headers, make_borrowing):
    b = make_borrowing(start=date.today() - timedelta(days=10), due=date.today() - timedelta(days=5))
    ret_date = (date.today() - timedelta(days=1)).isoformat()
    res = client.post("/api/v1/returns", json={"borrowing_id": b["id"], "returned_date": ret_date, "items": _items(b, "BAIK")}, headers=auth_headers)
    assert res.status_code == 201
    assert res.get_json()["data"]["returned_at"].startswith(ret_date) and res.get_json()["data"]["late_days"] == 4
    future = make_borrowing()
    res = client.post("/api/v1/returns", json={"borrowing_id": future["id"], "returned_date": (date.today() + timedelta(days=1)).isoformat(),
                                                "items": _items(future, "BAIK")}, headers=auth_headers)
    assert res.status_code == 400
