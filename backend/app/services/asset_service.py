"""Inventaris: CRUD barang, status manual, aktif/nonaktif, foto (item_photos), riwayat."""
from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Asset, AssetCondition, AssetHistory, AssetPhoto, AssetStatus, Category
from app.services.audit_service import record_audit

MAX_PHOTOS = 5
MANUAL_STATUSES = {
    AssetStatus.TERSEDIA.value,
    AssetStatus.RUSAK.value,
    AssetStatus.RUSAK_BERAT.value,
    AssetStatus.DALAM_PERBAIKAN.value,
    AssetStatus.HILANG.value,
}


class AssetError(ValueError):
    def __init__(self, message: str, errors: dict[str, str] | None = None, status: int = 400):
        super().__init__(message)
        self.errors = errors or {}
        self.status = status


def json_safe(data: dict[str, Any]) -> dict[str, Any]:
    def conv(v):
        if isinstance(v, (date, datetime)):
            return v.isoformat()
        if isinstance(v, Decimal):
            return float(v)
        return v
    return json.loads(json.dumps({k: conv(v) for k, v in data.items()}, default=str))


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
    query = select(Asset).where(Asset.deleted_at.is_(None))
    if search:
        like = f"%{search}%"
        query = query.where(
            Asset.name.ilike(like) | Asset.inventory_code.ilike(like) | Asset.serial_number.ilike(like) | Asset.brand.ilike(like)
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
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = list(session.scalars(query.order_by(Asset.id.desc()).offset((page - 1) * per_page).limit(per_page)).all())
    return items, total


def get_asset_by_id(session: Session, asset_id: int) -> Asset | None:
    asset = session.get(Asset, asset_id)
    return asset if asset and asset.deleted_at is None else None


def get_asset_by_code(session: Session, inventory_code: str) -> Asset | None:
    return session.scalars(select(Asset).where(Asset.inventory_code == inventory_code)).first()


def generate_inventory_code(session: Session, category_id: int) -> str:
    cat = session.get(Category, category_id)
    base = (cat.code if cat else "GEN").upper()
    base = base[4:] if base.startswith("CAT-") else base
    prefix = f"INV-{base}-"
    codes = session.scalars(select(Asset.inventory_code).where(Asset.inventory_code.like(f"{prefix}%"))).all()
    n = max((int(c[len(prefix):]) for c in codes if c[len(prefix):].isdigit()), default=0) + 1
    return f"{prefix}{n:04d}"


def create_asset(session: Session, data: dict[str, Any], user_id: int) -> Asset:
    data = dict(data)
    if not session.get(Category, data["category_id"]):
        raise AssetError("Kategori tidak ditemukan", {"category_id": "Pilih kategori."})
    code = (data.get("inventory_code") or "").strip() or generate_inventory_code(session, data["category_id"])
    if get_asset_by_code(session, code):
        raise AssetError(f"Kode inventaris '{code}' sudah digunakan", {"inventory_code": "Kode sudah digunakan."})
    data["inventory_code"] = code
    status = data.get("status") or AssetStatus.TERSEDIA.value
    if status not in MANUAL_STATUSES:
        raise AssetError("Status awal tidak valid", {"status": "Status awal tidak valid."})
    asset = Asset(**data)
    session.add(asset)
    session.flush()
    session.add(AssetHistory(
        asset_id=asset.id, changed_by=user_id, event_type="CREATED",
        new_status=asset.status, new_location_id=asset.location_id, new_condition=asset.condition,
        reason="Pendaftaran barang baru ke inventaris", new_data=json_safe(data),
    ))
    record_audit(session, "CREATE", "asset", "asset", asset.id, user_id, new_data=json_safe(data))
    session.commit()
    return asset


def update_asset(session: Session, asset_id: int, data: dict[str, Any], user_id: int) -> Asset:
    asset = get_asset_by_id(session, asset_id)
    if not asset:
        raise AssetError("Aset tidak ditemukan", status=404)
    data = dict(data)
    reason = data.pop("reason", None) or "Pembaruan informasi aset"
    if "is_active" in data and data["is_active"] is False and asset.status == AssetStatus.DIPINJAM.value:
        raise AssetError("Barang yang sedang dipinjam tidak dapat dinonaktifkan")
    if "category_id" in data and not session.get(Category, data["category_id"]):
        raise AssetError("Kategori tidak ditemukan", {"category_id": "Pilih kategori."})

    old = {"status": asset.status, "location_id": asset.location_id, "condition": asset.condition, "is_active": asset.is_active}
    old_snapshot = json_safe({k: getattr(asset, k) for k in data if hasattr(asset, k)})
    for k, v in data.items():
        setattr(asset, k, v)

    if asset.is_active != old["is_active"]:
        session.add(AssetHistory(
            asset_id=asset.id, changed_by=user_id,
            event_type="ACTIVATED" if asset.is_active else "DEACTIVATED",
            old_status=asset.status, new_status=asset.status, reason=reason,
        ))
    if asset.location_id != old["location_id"] or asset.condition != old["condition"]:
        session.add(AssetHistory(
            asset_id=asset.id, changed_by=user_id,
            event_type="LOCATION_CHANGE" if asset.location_id != old["location_id"] else "CONDITION_CHANGE",
            old_status=old["status"], new_status=asset.status,
            old_location_id=old["location_id"], new_location_id=asset.location_id,
            old_condition=old["condition"], new_condition=asset.condition, reason=reason,
        ))
    record_audit(session, "UPDATE", "asset", "asset", asset.id, user_id, old_data=old_snapshot, new_data=json_safe(data))
    session.commit()
    return asset


def change_status(session: Session, asset_id: int, status: str, note: str, user_id: int) -> Asset:
    """Ubah status manual (mis. selesai diperbaiki -> TERSEDIA). DIPINJAM hanya lewat checkout."""
    asset = session.get(Asset, asset_id, with_for_update=True)
    if not asset or asset.deleted_at is not None:
        raise AssetError("Aset tidak ditemukan", status=404)
    if asset.status == AssetStatus.DIPINJAM.value:
        raise AssetError("Barang sedang dipinjam. Status berubah melalui pencatatan pengembalian.")
    if status not in MANUAL_STATUSES:
        raise AssetError("Status DIPINJAM hanya diberikan melalui checkout peminjaman.", {"status": "Status tidak valid."})
    old_status, old_cond = asset.status, asset.condition
    asset.status = status
    if status == AssetStatus.TERSEDIA.value:
        asset.condition = AssetCondition.BAIK.value
    elif status == AssetStatus.RUSAK_BERAT.value:
        asset.condition = AssetCondition.RUSAK_BERAT.value
    elif status in (AssetStatus.RUSAK.value, AssetStatus.DALAM_PERBAIKAN.value) and asset.condition == AssetCondition.BAIK.value:
        asset.condition = AssetCondition.RUSAK_RINGAN.value
    session.add(AssetHistory(
        asset_id=asset.id, changed_by=user_id, event_type="STATUS_CHANGED",
        old_status=old_status, new_status=status, old_condition=old_cond, new_condition=asset.condition,
        reason=note or "Perubahan status manual",
    ))
    record_audit(session, "STATUS_CHANGE", "asset", "asset", asset.id, user_id,
                 old_data={"status": old_status}, new_data={"status": status, "note": note})
    session.commit()
    return asset


def delete_asset(session: Session, asset_id: int, user_id: int) -> bool:
    asset = get_asset_by_id(session, asset_id)
    if not asset:
        raise AssetError("Aset tidak ditemukan", status=404)
    if asset.status == AssetStatus.DIPINJAM.value:
        raise AssetError("Barang sedang dipinjam dan tidak dapat dinonaktifkan")
    asset.is_active = False
    session.add(AssetHistory(asset_id=asset.id, changed_by=user_id, event_type="DEACTIVATED",
                             old_status=asset.status, new_status=asset.status, reason="Penonaktifan barang"))
    record_audit(session, "DEACTIVATE", "asset", "asset", asset.id, user_id)
    session.commit()
    return True


def get_asset_history(session: Session, asset_id: int) -> list[AssetHistory]:
    q = select(AssetHistory).where(AssetHistory.asset_id == asset_id).order_by(AssetHistory.created_at.desc(), AssetHistory.id.desc())
    return list(session.scalars(q).all())


# ---------------------------------------------------------------- foto
def _sync_primary(asset: Asset) -> None:
    asset.photo_path = asset.photos[0].path if asset.photos else None


def add_photos(session: Session, asset: Asset, paths: list[str], user_id: int, primary: bool = False) -> Asset:
    if len(asset.photos) + len(paths) > MAX_PHOTOS:
        raise AssetError(f"Maksimal {MAX_PHOTOS} foto per barang")
    if primary:
        for p in asset.photos:
            p.sort_order += len(paths)
        start = 0
    else:
        start = (max((p.sort_order for p in asset.photos), default=-1) + 1)
    for i, path in enumerate(paths):
        asset.photos.append(AssetPhoto(path=path, sort_order=start + i))
    session.flush()
    session.refresh(asset)
    _sync_primary(asset)
    record_audit(session, "PHOTO_ADD", "asset", "asset", asset.id, user_id, new_data={"photos": paths})
    session.commit()
    return asset


def remove_photo(session: Session, asset: Asset, photo_id: int, user_id: int) -> Asset:
    photo = next((p for p in asset.photos if p.id == photo_id), None)
    if not photo:
        raise AssetError("Foto tidak ditemukan", status=404)
    asset.photos.remove(photo)
    session.flush()
    for i, p in enumerate(asset.photos):
        p.sort_order = i
    _sync_primary(asset)
    record_audit(session, "PHOTO_DELETE", "asset", "asset", asset.id, user_id, old_data={"photo": photo.path})
    session.commit()
    return asset


def reorder_photos(session: Session, asset: Asset, photo_ids: list[int], user_id: int) -> Asset:
    current = {p.id: p for p in asset.photos}
    if set(photo_ids) != set(current):
        raise AssetError("Urutan foto tidak valid")
    for i, pid in enumerate(photo_ids):
        current[pid].sort_order = i
    session.flush()
    session.refresh(asset)
    _sync_primary(asset)
    session.commit()
    return asset
