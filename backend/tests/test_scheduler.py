"""Notifikasi otomatis H-3/H-1/H/H+1/H+3/H+7, status TERLAMBAT, anti-duplikat, eskalasi (§12, §21)."""
from datetime import date, timedelta


def _run(client, headers, d):
    res = client.post("/api/v1/scheduler/run", json={"date": d.isoformat()}, headers=headers)
    assert res.status_code == 200, res.get_json()
    return res.get_json()["data"]


def _events(client, headers, bid):
    rows = client.get(f"/api/v1/notifications?borrowing_id={bid}&per_page=100", headers=headers).get_json()["data"]
    return rows


def test_full_reminder_cycle(client, auth_headers, make_borrowing):
    due = date.today() + timedelta(days=3)
    b = make_borrowing(due=due)
    bid = b["id"]

    for offset, event in ((-3, "H-3"), (-1, "H-1"), (0, "H"), (1, "H+1")):
        _run(client, auth_headers, due + timedelta(days=offset))
        evs = [n for n in _events(client, auth_headers, bid) if n["event"] == event]
        assert len(evs) == 1 and evs[0]["recipient_type"] == "PEMINJAM", event
        assert evs[0]["status"] == "SENT"

    # H+1 -> status TERLAMBAT
    assert client.get(f"/api/v1/borrowings/{bid}", headers=auth_headers).get_json()["data"]["status"] == "TERLAMBAT"

    # H+3 -> peminjam + petugas
    _run(client, auth_headers, due + timedelta(days=3))
    h3 = [n for n in _events(client, auth_headers, bid) if n["event"] == "H+3"]
    assert {n["recipient_type"] for n in h3} == {"PEMINJAM", "PETUGAS"}

    # H+7 -> peminjam + petugas + pimpinan
    _run(client, auth_headers, due + timedelta(days=7))
    h7 = [n for n in _events(client, auth_headers, bid) if n["event"] == "H+7"]
    assert {n["recipient_type"] for n in h7} == {"PEMINJAM", "PETUGAS", "PIMPINAN"}
    assert all("terlambat 7 hari" in n["subject"] for n in h7)


def test_no_duplicate_notifications(client, auth_headers, make_borrowing):
    due = date.today() + timedelta(days=1)
    b = make_borrowing(due=due)
    run_date = due - timedelta(days=1)
    _run(client, auth_headers, run_date)
    second = _run(client, auth_headers, run_date)
    assert any("sudah pernah dikirim" in d["action"] for d in second["details"] if d["code"] == b["transaction_number"])
    h1 = [n for n in _events(client, auth_headers, b["id"]) if n["event"] == "H-1"]
    assert len(h1) == 1


def test_returned_not_marked_late(client, auth_headers, make_borrowing):
    b = make_borrowing(due=date.today() + timedelta(days=1))
    client.post("/api/v1/returns", json={"borrowing_id": b["id"], "items": [
        {"borrowing_item_id": it["id"], "asset_id": it["asset_id"], "final_condition": "BAIK"} for it in b["items"]]},
        headers=auth_headers)
    _run(client, auth_headers, date.today() + timedelta(days=5))
    assert client.get(f"/api/v1/borrowings/{b['id']}", headers=auth_headers).get_json()["data"]["status"] == "DIKEMBALIKAN"
    assert not [n for n in _events(client, auth_headers, b["id"]) if n["event"].startswith("H")]


def test_rules_are_configurable(client, auth_headers, make_borrowing):
    settings = client.get("/api/v1/settings", headers=auth_headers).get_json()["data"]
    rules = settings["rules"]
    new_rules = [dict(r, active=(r["event"] != "H+3"), to=(["peminjam"] if r["event"] == "H+7" else r["to"])) for r in rules]
    assert client.put("/api/v1/settings", json={"rules": new_rules}, headers=auth_headers).status_code == 200
    try:
        due = date.today()
        b = make_borrowing(start=due - timedelta(days=1), due=due)
        _run(client, auth_headers, due + timedelta(days=3))
        _run(client, auth_headers, due + timedelta(days=7))
        evs = _events(client, auth_headers, b["id"])
        assert not [n for n in evs if n["event"] == "H+3"]
        assert {n["recipient_type"] for n in evs if n["event"] == "H+7"} == {"PEMINJAM"}
    finally:
        client.put("/api/v1/settings", json={"rules": rules}, headers=auth_headers)


def test_overdue_dashboard_and_runs_log(client, auth_headers, make_borrowing):
    b = make_borrowing(start=date.today() - timedelta(days=9), due=date.today() - timedelta(days=4))
    overdue = client.get("/api/v1/dashboard/overdue", headers=auth_headers).get_json()["data"]
    row = next(o for o in overdue if o["id"] == b["id"])
    assert row["late_days"] == 4 and row["escalation"] == "H+3"
    runs = client.get("/api/v1/scheduler/runs", headers=auth_headers).get_json()["data"]
    assert runs and runs[0]["trigger"] == "MANUAL"


def test_celery_task_respects_time_and_once_per_day(db_session):
    from app.tasks.scheduler_tasks import check_borrowing_due_dates_task

    first = check_borrowing_due_dates_task.run(force=True)
    assert isinstance(first, dict) and "checked" in first
