"""Riwayat notifikasi, tandai terbaca, kirim ulang, template, kegagalan SMTP tercatat."""
from datetime import date, timedelta


def test_inbox_read_and_read_all(client, auth_headers, petugas_headers, make_borrowing):
    due = date.today()
    b = make_borrowing(start=due - timedelta(days=1), due=due)
    client.post("/api/v1/scheduler/run", json={"date": (due + timedelta(days=3)).isoformat()}, headers=auth_headers)
    inbox = client.get("/api/v1/notifications?inbox=1", headers=petugas_headers).get_json()["data"]
    mine = [n for n in inbox if n["borrowing_id"] == b["id"]]
    assert mine and all(n["recipient_type"] == "PETUGAS" for n in mine)
    count = client.get("/api/v1/notifications/unread-count", headers=petugas_headers).get_json()["data"]["unread"]
    assert count >= 1
    assert client.post(f"/api/v1/notifications/{mine[0]['id']}/read", headers=petugas_headers).status_code == 200
    assert client.get("/api/v1/notifications/unread-count", headers=petugas_headers).get_json()["data"]["unread"] == count - 1
    client.post("/api/v1/notifications/read-all", headers=petugas_headers)
    assert client.get("/api/v1/notifications/unread-count", headers=petugas_headers).get_json()["data"]["unread"] == 0


def test_smtp_failure_logged_and_resend(client, auth_headers, make_borrowing):
    client.put("/api/v1/settings", json={"smtp": {"simulate_failure": True}}, headers=auth_headers)
    try:
        b = make_borrowing()
    finally:
        client.put("/api/v1/settings", json={"smtp": {"simulate_failure": False}}, headers=auth_headers)
    n = client.get(f"/api/v1/notifications?borrowing_id={b['id']}", headers=auth_headers).get_json()["data"][0]
    assert n["status"] == "FAILED" and n["deliveries"][0]["status"] == "FAILED"
    assert any("Gagal" in lg["message"] for lg in n["logs"])
    res = client.post(f"/api/v1/notifications/{n['id']}/resend", headers=auth_headers)
    assert res.status_code == 200 and res.get_json()["data"]["status"] == "SENT"
    assert len(res.get_json()["data"]["deliveries"]) == 2
    assert client.post(f"/api/v1/notifications/{n['id']}/resend", headers=auth_headers).status_code == 400


def test_templates_edit(client, auth_headers, petugas_headers):
    tpls = client.get("/api/v1/notifications/templates", headers=auth_headers).get_json()["data"]
    assert {t["code"] for t in tpls} >= {"LOAN_CONFIRMATION", "H_MINUS_3", "H_MINUS_1", "H_DAY", "H_PLUS_1", "H_PLUS_3", "H_PLUS_7", "RETURN_CONFIRMATION"}
    t = next(t for t in tpls if t["code"] == "H_MINUS_1")
    assert client.put(f"/api/v1/notifications/templates/{t['id']}", json={"subject": "X"}, headers=petugas_headers).status_code == 403
    res = client.put(f"/api/v1/notifications/templates/{t['id']}", json={"subject": "[SIIPB] Besok {{kode_transaksi}}"}, headers=auth_headers)
    assert res.status_code == 200 and res.get_json()["data"]["subject"].startswith("[SIIPB] Besok")


def test_render_placeholders():
    from app.services.notification_service import render

    assert render("Halo {{ nama_peminjam }} / {transaction_number} / {{tidak_ada}}", {"nama_peminjam": "Andi", "transaction_number": "PJM-1"}) \
        == "Halo Andi / PJM-1 / {{tidak_ada}}"
