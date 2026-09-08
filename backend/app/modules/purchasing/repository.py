from datetime import date
from typing import List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.modules.purchasing.models import Purchase, PurchaseItem
from app.modules.suppliers.models import Supplier


class PurchaseRepository:
    """Authoritative data access layer for Purchasing domain."""

    @classmethod
    def get_by_id(cls, purchase_id: int, with_items: bool = True) -> Optional[Purchase]:
        stmt = select(Purchase).filter_by(id=purchase_id)
        if with_items:
            stmt = stmt.options(
                selectinload(Purchase.items).selectinload(PurchaseItem.product),
                selectinload(Purchase.supplier),
                selectinload(Purchase.creator),
            )
        return db.session.execute(stmt).scalar_one_or_none()

    @classmethod
    def get_for_update(cls, purchase_id: int) -> Optional[Purchase]:
        """Locks the purchase row with SELECT FOR UPDATE to serialize state transitions."""
        stmt = (
            select(Purchase)
            .filter_by(id=purchase_id)
            .with_for_update()
            .options(
                selectinload(Purchase.items).selectinload(PurchaseItem.product),
                selectinload(Purchase.supplier),
            )
        )
        return db.session.execute(stmt).scalar_one_or_none()

    @classmethod
    def get_by_reference_number(cls, reference_number: str) -> Optional[Purchase]:
        stmt = select(Purchase).filter(
            func.lower(Purchase.reference_number) == reference_number.strip().lower()
        )
        return db.session.execute(stmt).scalar_one_or_none()

    @classmethod
    def count_today_purchases(cls, p_date: date) -> int:
        stmt = select(func.count(Purchase.id)).filter(Purchase.purchase_date == p_date)
        return db.session.execute(stmt).scalar_one() or 0

    @classmethod
    def list_purchases(
        cls,
        status: Optional[str] = None,
        supplier_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Purchase], int]:
        stmt = select(Purchase).options(
            selectinload(Purchase.supplier),
            selectinload(Purchase.creator),
            selectinload(Purchase.items),
        )

        if status:
            stmt = stmt.filter(Purchase.status == status.strip().upper())
        if supplier_id:
            stmt = stmt.filter(Purchase.supplier_id == supplier_id)
        if start_date:
            stmt = stmt.filter(Purchase.purchase_date >= start_date)
        if end_date:
            stmt = stmt.filter(Purchase.purchase_date <= end_date)
        if search:
            s = f"%{search.strip().lower()}%"
            stmt = stmt.outerjoin(Supplier, Purchase.supplier_id == Supplier.id).filter(
                or_(
                    func.lower(Purchase.reference_number).like(s),
                    func.lower(Supplier.name).like(s),
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.session.execute(count_stmt).scalar_one() or 0

        # Paginate (order by purchase_date desc, id desc)
        stmt = stmt.order_by(Purchase.purchase_date.desc(), Purchase.id.desc())
        stmt = stmt.offset((page - 1) * per_page).limit(per_page)
        items = db.session.execute(stmt).scalars().all()

        return items, total

    @classmethod
    def save(cls, purchase: Purchase, commit: bool = True) -> Purchase:
        db.session.add(purchase)
        if commit:
            db.session.commit()
        else:
            db.session.flush()
        return purchase

    @classmethod
    def delete(cls, purchase: Purchase, commit: bool = True) -> None:
        db.session.delete(purchase)
        if commit:
            db.session.commit()
        else:
            db.session.flush()

    @classmethod
    def get_item(cls, purchase_id: int, item_id: int) -> Optional[PurchaseItem]:
        stmt = select(PurchaseItem).filter_by(id=item_id, purchase_id=purchase_id).options(
            selectinload(PurchaseItem.product)
        )
        return db.session.execute(stmt).scalar_one_or_none()

    @classmethod
    def get_item_by_product(cls, purchase_id: int, product_id: int) -> Optional[PurchaseItem]:
        stmt = select(PurchaseItem).filter_by(purchase_id=purchase_id, product_id=product_id)
        return db.session.execute(stmt).scalar_one_or_none()

    @classmethod
    def add_item(cls, item: PurchaseItem, commit: bool = True) -> PurchaseItem:
        db.session.add(item)
        if commit:
            db.session.commit()
        else:
            db.session.flush()
        return item

    @classmethod
    def remove_item(cls, item: PurchaseItem, commit: bool = True) -> None:
        db.session.delete(item)
        if commit:
            db.session.commit()
        else:
            db.session.flush()
