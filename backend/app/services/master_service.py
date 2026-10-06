"""Master data service: Organizational Units, Categories, Locations, Borrowers."""
from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Borrower, Category, Location, OrganizationalUnit
from app.services.audit_service import record_audit


# ---- Organizational Units ----
def get_units(session: Session, active_only: bool = True) -> list[OrganizationalUnit]:
    query = select(OrganizationalUnit)
    if active_only:
        query = query.where(OrganizationalUnit.is_active.is_(True))
    return list(session.scalars(query.order_by(OrganizationalUnit.name)).all())


def create_unit(session: Session, data: dict[str, Any], user_id: int) -> OrganizationalUnit:
    unit = OrganizationalUnit(**data)
    session.add(unit)
    session.flush()
    record_audit(session, "CREATE", "unit", "organizational_unit", unit.id, user_id, new_data=data)
    session.commit()
    return unit


# ---- Categories ----
def get_categories(session: Session, active_only: bool = True) -> list[Category]:
    query = select(Category).where(Category.deleted_at.is_(None))
    if active_only:
        query = query.where(Category.is_active.is_(True))
    return list(session.scalars(query.order_by(Category.name)).all())


def create_category(session: Session, data: dict[str, Any], user_id: int) -> Category:
    cat = Category(**data)
    session.add(cat)
    session.flush()
    record_audit(session, "CREATE", "category", "category", cat.id, user_id, new_data=data)
    session.commit()
    return cat


# ---- Locations ----
def get_locations(session: Session, active_only: bool = True) -> list[Location]:
    query = select(Location).where(Location.deleted_at.is_(None))
    if active_only:
        query = query.where(Location.is_active.is_(True))
    return list(session.scalars(query.order_by(Location.name)).all())


def create_location(session: Session, data: dict[str, Any], user_id: int) -> Location:
    loc = Location(**data)
    session.add(loc)
    session.flush()
    record_audit(session, "CREATE", "location", "location", loc.id, user_id, new_data=data)
    session.commit()
    return loc


# ---- Borrowers (Peminjam TANPA AKUN) ----
def get_borrowers(
    session: Session,
    search: str | None = None,
    unit_id: int | None = None,
    active_only: bool = True,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Borrower], int]:
    query = select(Borrower).where(Borrower.deleted_at.is_(None))

    if active_only:
        query = query.where(Borrower.is_active.is_(True))
    if unit_id:
        query = query.where(Borrower.unit_id == unit_id)
    if search:
        query = query.where(
            Borrower.name.ilike(f"%{search}%")
            | Borrower.identity_number.ilike(f"%{search}%")
            | Borrower.email.ilike(f"%{search}%")
        )

    # Count total
    total = len(session.scalars(query).all())

    # Paginate
    items = list(
        session.scalars(
            query.order_by(Borrower.name.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
    )

    return items, total


def create_borrower(session: Session, data: dict[str, Any], user_id: int) -> Borrower:
    borrower = Borrower(**data)
    session.add(borrower)
    session.flush()
    record_audit(session, "CREATE", "borrower", "borrower", borrower.id, user_id, new_data=data)
    session.commit()
    return borrower


def update_borrower(session: Session, borrower_id: int, data: dict[str, Any], user_id: int) -> Borrower:
    borrower = session.get(Borrower, borrower_id)
    if not borrower or borrower.deleted_at is not None:
        raise ValueError("Peminjam tidak ditemukan")

    old_data = {"name": borrower.name, "email": borrower.email, "phone": borrower.phone, "is_active": borrower.is_active}
    for k, v in data.items():
        setattr(borrower, k, v)

    record_audit(session, "UPDATE", "borrower", "borrower", borrower.id, user_id, old_data=old_data, new_data=data)
    session.commit()
    return borrower


def delete_borrower(session: Session, borrower_id: int, user_id: int) -> bool:
    borrower = session.get(Borrower, borrower_id)
    if not borrower or borrower.deleted_at is not None:
        raise ValueError("Peminjam tidak ditemukan")

    borrower.deleted_at = datetime.now()
    borrower.is_active = False
    record_audit(session, "DELETE", "borrower", "borrower", borrower.id, user_id)
    session.commit()
    return True
