from datetime import date, datetime, time
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from app.extensions import db
from app.modules.returns.models import SaleReturn, SaleReturnItem
from app.modules.sales.models import Sale, SaleItem


class ReturnRepository:
    """Repository handling database queries for SaleReturn and SaleReturnItem entities."""

    @staticmethod
    def get_by_id(return_id: int) -> Optional[SaleReturn]:
        """Loads a SaleReturn with processor, sale, and items (with products and original sale items)."""
        query = (
            select(SaleReturn)
            .options(
                joinedload(SaleReturn.processor),
                joinedload(SaleReturn.sale),
                selectinload(SaleReturn.items).joinedload(SaleReturnItem.product),
                selectinload(SaleReturn.items).joinedload(SaleReturnItem.sale_item),
            )
            .filter_by(id=return_id)
        )
        return db.session.execute(query).scalar_one_or_none()

    @staticmethod
    def get_by_return_number(return_number: str) -> Optional[SaleReturn]:
        query = (
            select(SaleReturn)
            .options(
                joinedload(SaleReturn.processor),
                joinedload(SaleReturn.sale),
                selectinload(SaleReturn.items).joinedload(SaleReturnItem.product),
                selectinload(SaleReturn.items).joinedload(SaleReturnItem.sale_item),
            )
            .filter(SaleReturn.return_number == return_number.strip())
        )
        return db.session.execute(query).scalar_one_or_none()

    @staticmethod
    def get_sale_for_update(sale_id: int) -> Optional[Sale]:
        """Acquires a PostgreSQL row-level lock on the target Sale."""
        query = (
            select(Sale)
            .options(
                selectinload(Sale.cashier),
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.return_items),
                selectinload(Sale.returns).selectinload(SaleReturn.items),
            )
            .filter_by(id=sale_id)
            .with_for_update(of=Sale)
        )
        return db.session.execute(query).scalar_one_or_none()

    @staticmethod
    def get_sale_returned_quantities(sale_id: int) -> Dict[int, Decimal]:
        """Returns map of {sale_item_id: cumulative_returned_quantity} for the given sale."""
        query = (
            select(
                SaleReturnItem.sale_item_id,
                func.coalesce(func.sum(SaleReturnItem.quantity), Decimal("0.000")),
            )
            .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
            .filter(SaleReturn.sale_id == sale_id)
            .group_by(SaleReturnItem.sale_item_id)
        )
        rows = db.session.execute(query).all()
        return {item_id: Decimal(str(qty)) for item_id, qty in rows}

    @staticmethod
    def list_returns(
        processed_by: Optional[int] = None,
        refund_method: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[SaleReturn], int]:
        """Lists returns matching filters with pagination."""
        query = (
            select(SaleReturn)
            .options(
                joinedload(SaleReturn.processor),
                joinedload(SaleReturn.sale),
                selectinload(SaleReturn.items).joinedload(SaleReturnItem.product),
            )
        )
        count_query = select(func.count(SaleReturn.id))

        if processed_by is not None:
            query = query.filter(SaleReturn.processed_by == processed_by)
            count_query = count_query.filter(SaleReturn.processed_by == processed_by)

        if refund_method and refund_method != "ALL":
            clean_rm = refund_method.strip().upper()
            query = query.filter(SaleReturn.refund_method == clean_rm)
            count_query = count_query.filter(SaleReturn.refund_method == clean_rm)

        if date_from:
            start_dt = datetime.combine(date_from, time.min)
            query = query.filter(SaleReturn.created_at >= start_dt)
            count_query = count_query.filter(SaleReturn.created_at >= start_dt)

        if date_to:
            end_dt = datetime.combine(date_to, time.max)
            query = query.filter(SaleReturn.created_at <= end_dt)
            count_query = count_query.filter(SaleReturn.created_at <= end_dt)

        if search:
            search_term = f"%{search.strip()}%"
            # Matches return_number or original invoice_number
            query = query.join(SaleReturn.sale).filter(
                (SaleReturn.return_number.ilike(search_term))
                | (Sale.invoice_number.ilike(search_term))
            )
            count_query = count_query.join(SaleReturn.sale).filter(
                (SaleReturn.return_number.ilike(search_term))
                | (Sale.invoice_number.ilike(search_term))
            )

        total = db.session.execute(count_query).scalar_one()

        offset = (page - 1) * per_page
        query = query.order_by(SaleReturn.created_at.desc(), SaleReturn.id.desc()).offset(offset).limit(per_page)

        items = list(db.session.execute(query).scalars().all())
        return items, total

    @staticmethod
    def save(sale_return: SaleReturn, commit: bool = False) -> SaleReturn:
        db.session.add(sale_return)
        if commit:
            db.session.commit()
        return sale_return
