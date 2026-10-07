"""Dua checkout bersamaan atas barang yang sama: tepat satu berhasil (SELECT ... FOR UPDATE)."""
import concurrent.futures
from datetime import date, timedelta

from app.database import SessionLocal
from app.models import Asset, AssetStatus
from app.services.borrowing_service import BorrowingError, create_borrowing


def test_concurrent_checkout_prevents_double_lending(make_asset):
    asset_id = make_asset()["id"]
    today = date.today()

    def attempt(i: int):
        with SessionLocal() as session:
            try:
                b, _ = create_borrowing(session, {
                    "borrower_id": 1, "start_date": today, "due_date": today + timedelta(days=5),
                    "asset_ids": [asset_id], "purpose": f"thread {i}"}, user_id=1, checkout=True)
                return True, b.id
            except BorrowingError as e:
                return False, str(e)
            except Exception as e:  # deadlock dll. juga dianggap gagal aman
                return False, repr(e)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(attempt, range(4)))
    assert sum(1 for ok, _ in results if ok) == 1, results
    with SessionLocal() as session:
        assert session.get(Asset, asset_id).status == AssetStatus.DIPINJAM.value
