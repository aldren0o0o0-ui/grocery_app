from typing import List, Optional, Tuple
from sqlalchemy import func, or_, select

from app.extensions import db
from app.modules.purchasing.models import Purchase
from app.modules.suppliers.models import Supplier


class SupplierRepository:
    """Repository handling persistence queries and counting for the Supplier domain."""

    @staticmethod
    def _purchase_count_subquery():
        """Scalar subquery returning the total count of purchases for each supplier."""
        return (
            select(func.count(Purchase.id))
            .filter(Purchase.supplier_id == Supplier.id)
            .scalar_subquery()
        )

    @staticmethod
    def get_by_id(supplier_id: int) -> Optional[Tuple[Supplier, int]]:
        """Retrieves a supplier by ID with its aggregate purchase count."""
        purchase_count_subq = SupplierRepository._purchase_count_subquery()
        stmt = (
            select(Supplier, purchase_count_subq.label("purchase_count"))
            .filter(Supplier.id == supplier_id)
        )
        row = db.session.execute(stmt).first()
        if not row:
            return None
        supplier, purchase_count = row
        return supplier, purchase_count or 0

    @staticmethod
    def find_by_name(name: str) -> Optional[Supplier]:
        """Finds a supplier by exact case-insensitive trimmed name."""
        clean_name = name.strip()
        stmt = select(Supplier).filter(func.lower(Supplier.name) == func.lower(clean_name))
        return db.session.execute(stmt).scalar_one_or_none()

    @staticmethod
    def find_name_conflict(name: str, exclude_id: Optional[int] = None) -> Optional[Supplier]:
        """Checks for another supplier with the same case-insensitive name."""
        clean_name = name.strip()
        stmt = select(Supplier).filter(func.lower(Supplier.name) == func.lower(clean_name))
        if exclude_id is not None:
            stmt = stmt.filter(Supplier.id != exclude_id)
        return db.session.execute(stmt).scalar_one_or_none()

    @staticmethod
    def list_suppliers(
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[Tuple[Supplier, int]], int, int]:
        """Queries suppliers with search and active status filters, returning (items, total, pages)."""
        purchase_count_subq = SupplierRepository._purchase_count_subquery()
        stmt = select(Supplier, purchase_count_subq.label("purchase_count"))

        if search:
            pattern = f"%{search.strip()}%"
            stmt = stmt.filter(
                or_(
                    Supplier.name.ilike(pattern),
                    Supplier.contact_person.ilike(pattern),
                    Supplier.phone.ilike(pattern),
                    Supplier.email.ilike(pattern),
                )
            )

        if is_active is not None:
            stmt = stmt.filter(Supplier.is_active == is_active)

        # Count total records
        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.session.execute(count_stmt).scalar() or 0
        pages = (total + per_page - 1) // per_page if per_page > 0 else 1

        stmt = stmt.order_by(Supplier.name.asc(), Supplier.id.asc())
        stmt = stmt.offset((page - 1) * per_page).limit(per_page)

        rows = db.session.execute(stmt).all()
        items = [(supplier, count or 0) for supplier, count in rows]
        return items, total, pages

    @staticmethod
    def create(supplier: Supplier) -> Supplier:
        """Adds a supplier entity to the session without committing."""
        db.session.add(supplier)
        return supplier
