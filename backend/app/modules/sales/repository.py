from datetime import date, datetime, time
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from app.extensions import db
from app.modules.returns.models import SaleReturn, SaleReturnItem
from app.modules.sales.models import Payment, Sale, SaleItem


class SalesRepository:
    """Repository handling all database queries for Sales, SaleItems, and Payments."""

    @staticmethod
    def get_by_id(sale_id: int) -> Optional[Sale]:
        """Loads a Sale with items, products, cashier, payments, and returns."""
        query = (
            select(Sale)
            .options(
                joinedload(Sale.cashier),
                selectinload(Sale.items).joinedload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.return_items),
                selectinload(Sale.payments),
                selectinload(Sale.returns).selectinload(SaleReturn.items),
            )
            .filter_by(id=sale_id)
        )
        return db.session.execute(query).scalar_one_or_none()

    @staticmethod
    def get_by_invoice_number(invoice_number: str) -> Optional[Sale]:
        query = (
            select(Sale)
            .options(
                joinedload(Sale.cashier),
                selectinload(Sale.items).joinedload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.return_items),
                selectinload(Sale.payments),
                selectinload(Sale.returns).selectinload(SaleReturn.items),
            )
            .filter(Sale.invoice_number == invoice_number.strip())
        )
        return db.session.execute(query).scalar_one_or_none()

    @staticmethod
    def count_today_sales(sale_date: date) -> int:
        """Counts sales created on a specific date for invoice number sequencing."""
        start = datetime.combine(sale_date, time.min)
        end = datetime.combine(sale_date, time.max)
        query = select(func.count(Sale.id)).filter(
            Sale.created_at >= start,
            Sale.created_at <= end,
        )
        return db.session.execute(query).scalar_one()

    @staticmethod
    def list_sales(
        cashier_id: Optional[int] = None,
        status: Optional[str] = None,
        payment_method: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Sale], int]:
        """Lists sales matching filters with pagination."""
        query = (
            select(Sale)
            .options(
                joinedload(Sale.cashier),
                selectinload(Sale.items).joinedload(SaleItem.product),
                selectinload(Sale.items).selectinload(SaleItem.return_items),
                selectinload(Sale.payments),
                selectinload(Sale.returns).selectinload(SaleReturn.items),
            )
        )
        count_query = select(func.count(Sale.id))

        if cashier_id is not None:
            query = query.filter(Sale.cashier_id == cashier_id)
            count_query = count_query.filter(Sale.cashier_id == cashier_id)

        if status:
            query = query.filter(Sale.status == status.strip().upper())
            count_query = count_query.filter(Sale.status == status.strip().upper())

        if date_from:
            start_dt = datetime.combine(date_from, time.min)
            query = query.filter(Sale.created_at >= start_dt)
            count_query = count_query.filter(Sale.created_at >= start_dt)

        if date_to:
            end_dt = datetime.combine(date_to, time.max)
            query = query.filter(Sale.created_at <= end_dt)
            count_query = count_query.filter(Sale.created_at <= end_dt)

        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(Sale.invoice_number.ilike(search_term))
            count_query = count_query.filter(Sale.invoice_number.ilike(search_term))

        if payment_method:
            clean_pm = payment_method.strip().upper()
            query = query.join(Sale.payments).filter(Payment.payment_method == clean_pm)
            count_query = count_query.join(Sale.payments).filter(Payment.payment_method == clean_pm)

        total = db.session.execute(count_query).scalar_one()

        offset = (page - 1) * per_page
        query = query.order_by(Sale.created_at.desc(), Sale.id.desc()).offset(offset).limit(per_page)

        items = list(db.session.execute(query).scalars().all())
        return items, total

    @staticmethod
    def save(sale: Sale, commit: bool = True) -> Sale:
        db.session.add(sale)
        if commit:
            db.session.commit()
        return sale
