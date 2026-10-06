"""Concurrent checkout test verifying transaction isolation and row-level locking."""
import concurrent.futures
from datetime import date, timedelta
import uuid
import pytest

from app.database import SessionLocal
from app.models import Asset, AssetStatus
from app.services.borrowing_service import checkout_borrowing


def test_concurrent_checkout_prevents_double_lending():
    """Verify that when two concurrent transactions attempt to checkout the exact same asset,
    one succeeds and the other fails safely due to SELECT ... FOR UPDATE row locking.
    """
    unique_code = f"AST-LOCK-{uuid.uuid4().hex[:6].upper()}"

    # 1. Create a test asset with status TERSEDIA
    with SessionLocal() as session:
        asset = Asset(
            inventory_code=unique_code,
            category_id=1,
            name="Concurrent Concurrency Target Laptop",
            status=AssetStatus.TERSEDIA.value,
            condition="BAIK",
            is_active=True,
        )
        session.add(asset)
        session.commit()
        asset_id = asset.id

    today = date.today()
    due_date = today + timedelta(days=5)

    def attempt_checkout(thread_id: int):
        with SessionLocal() as session:
            try:
                res = checkout_borrowing(
                    session=session,
                    borrower_id=1,
                    handled_by=1,
                    start_date=today,
                    due_date=due_date,
                    asset_ids=[asset_id],
                    purpose=f"Test concurrent checkout from thread {thread_id}",
                )
                return {"success": True, "borrowing_id": res.id, "thread_id": thread_id}
            except Exception as e:
                return {"success": False, "error": str(e), "thread_id": thread_id}

    # 2. Launch 2 threads concurrently attempting to checkout the exact same asset
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(attempt_checkout, 1)
        future2 = executor.submit(attempt_checkout, 2)
        results = [future1.result(), future2.result()]

    successes = [r for r in results if r["success"]]
    failures = [r for r in results if not r["success"]]

    # 3. Assertions: Exactly one transaction must succeed, and exactly one must fail
    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}: {results}"
    assert len(failures) == 1, f"Expected exactly 1 failure, got {len(failures)}: {results}"

    # Verify the failure message mentions availability or status
    error_msg = failures[0]["error"]
    assert "tidak tersedia untuk dipinjam" in error_msg or "Deadlock" in error_msg

    # 4. Verify final asset state in database is DIPINJAM
    with SessionLocal() as session:
        final_asset = session.get(Asset, asset_id)
        assert final_asset.status == AssetStatus.DIPINJAM.value
