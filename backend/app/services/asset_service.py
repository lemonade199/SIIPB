"""Asset and Inventory Management Service."""
from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Asset, AssetHistory, AssetStatus
from app.services.audit_service import record_audit


def get_assets(
    session: Session,
    search: str | None = None,
    category_id: int | None = None,
    location_id: int | None = None,
    status: str | None = None,
    condition: str | None = None,
    is_active: bool | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Asset], int]:
    """Retrieve filtered, paginated asset list."""
    query = select(Asset).where(Asset.deleted_at.is_(None))

    if search:
        query = query.where(
            Asset.name.ilike(f"%{search}%")
            | Asset.inventory_code.ilike(f"%{search}%")
            | Asset.serial_number.ilike(f"%{search}%")
            | Asset.brand.ilike(f"%{search}%")
        )
    if category_id:
        query = query.where(Asset.category_id == category_id)
    if location_id:
        query = query.where(Asset.location_id == location_id)
    if status:
        query = query.where(Asset.status == status.upper())
    if condition:
        query = query.where(Asset.condition == condition.upper())
    if is_active is not None:
        query = query.where(Asset.is_active.is_(is_active))

    total = len(session.scalars(query).all())

    items = list(
        session.scalars(
            query.order_by(Asset.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
    )

    return items, total


def get_asset_by_id(session: Session, asset_id: int) -> Asset | None:
    asset = session.get(Asset, asset_id)
    if asset and asset.deleted_at is None:
        return asset
    return None


def get_asset_by_code(session: Session, inventory_code: str) -> Asset | None:
    query = select(Asset).where(
        Asset.inventory_code == inventory_code,
        Asset.deleted_at.is_(None),
    )
    return session.scalars(query).first()


def create_asset(session: Session, data: dict[str, Any], user_id: int) -> Asset:
    # Check duplicate inventory_code
    existing = get_asset_by_code(session, data["inventory_code"])
    if existing:
        raise ValueError(f"Kode inventaris '{data['inventory_code']}' sudah digunakan")

    asset = Asset(**data)
    session.add(asset)
    session.flush()

    # Append to asset_history
    history = AssetHistory(
        asset_id=asset.id,
        changed_by=user_id,
        event_type="CREATED",
        new_status=asset.status,
        new_location_id=asset.location_id,
        new_condition=asset.condition,
        reason="Pendaftaran barang baru ke inventaris",
        new_data=data,
    )
    session.add(history)

    record_audit(session, "CREATE", "asset", "asset", asset.id, user_id, new_data=data)
    session.commit()
    return asset


def update_asset(session: Session, asset_id: int, data: dict[str, Any], user_id: int) -> Asset:
    asset = get_asset_by_id(session, asset_id)
    if not asset:
        raise ValueError("Aset tidak ditemukan")

    reason = data.pop("reason", None) or "Pembaruan informasi aset"
    old_status = asset.status
    old_loc = asset.location_id
    old_cond = asset.condition

    old_snapshot = {
        "name": asset.name,
        "status": asset.status,
        "location_id": asset.location_id,
        "condition": asset.condition,
    }

    for k, v in data.items():
        setattr(asset, k, v)

    # If status, location, or condition changed, append history
    if (
        asset.status != old_status
        or asset.location_id != old_loc
        or asset.condition != old_cond
    ):
        history = AssetHistory(
            asset_id=asset.id,
            changed_by=user_id,
            event_type="STATUS_CHANGED",
            old_status=old_status,
            new_status=asset.status,
            old_location_id=old_loc,
            new_location_id=asset.location_id,
            old_condition=old_cond,
            new_condition=asset.condition,
            reason=reason,
        )
        session.add(history)

    record_audit(session, "UPDATE", "asset", "asset", asset.id, user_id, old_data=old_snapshot, new_data=data)
    session.commit()
    return asset


def delete_asset(session: Session, asset_id: int, user_id: int) -> bool:
    asset = get_asset_by_id(session, asset_id)
    if not asset:
        raise ValueError("Aset tidak ditemukan")

    if asset.status == AssetStatus.DIPINJAM:
        raise ValueError("Barang sedang dipinjam dan tidak dapat dinonaktifkan")

    asset.deleted_at = datetime.now()
    asset.is_active = False
    asset.status = AssetStatus.NONAKTIF.value

    history = AssetHistory(
        asset_id=asset.id,
        changed_by=user_id,
        event_type="DEACTIVATED",
        new_status=AssetStatus.NONAKTIF.value,
        reason="Penonaktifan / soft delete barang",
    )
    session.add(history)

    record_audit(session, "DELETE", "asset", "asset", asset.id, user_id)
    session.commit()
    return True


def get_asset_history(session: Session, asset_id: int) -> list[AssetHistory]:
    query = (
        select(AssetHistory)
        .where(AssetHistory.asset_id == asset_id)
        .order_by(AssetHistory.created_at.desc())
    )
    return list(session.scalars(query).all())
