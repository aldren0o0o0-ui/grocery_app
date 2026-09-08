from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import case, cast, desc, func, select, Numeric
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.modules.expenses.models import Expense, ExpenseCategory
from app.modules.products.models import Product
from app.modules.returns.models import SaleReturn, SaleReturnItem
from app.modules.sales.models import Sale, SaleItem, SaleStatus
from app.modules.users.models import User


class DashboardRepository:
    """Read-only aggregation repository for operational dashboard and KPIs."""

    @staticmethod
    def get_sales_kpis(
        start_dt: datetime,
        end_dt: datetime,
        cashier_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Aggregate sales metrics in period: gross sales, total discounts, gross revenue after discounts, transaction count."""
        query = select(
            func.coalesce(func.sum(Sale.subtotal), Decimal("0.00")).label("gross_sales"),
            func.coalesce(func.sum(Sale.discount), Decimal("0.00")).label("discount_total"),
            func.coalesce(func.sum(Sale.total), Decimal("0.00")).label("gross_revenue_after_discount"),
            func.count(Sale.id).label("transaction_count"),
        ).where(
            Sale.created_at >= start_dt,
            Sale.created_at <= end_dt,
            Sale.status.in_([SaleStatus.COMPLETED.value, SaleStatus.RETURNED.value]),
        )

        if cashier_id is not None:
            query = query.where(Sale.cashier_id == cashier_id)

        row = db.session.execute(query).one()
        return {
            "gross_sales": Decimal(str(row.gross_sales or "0.00")),
            "discount_total": Decimal(str(row.discount_total or "0.00")),
            "gross_revenue_after_discount": Decimal(str(row.gross_revenue_after_discount or "0.00")),
            "transaction_count": int(row.transaction_count or 0),
        }

    @staticmethod
    def get_refund_kpis(
        start_dt: datetime,
        end_dt: datetime,
        cashier_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Aggregate refund totals in period for completed returns."""
        query = select(
            func.coalesce(func.sum(SaleReturn.refund_amount), Decimal("0.00")).label("refund_total"),
            func.count(SaleReturn.id).label("return_count"),
        ).where(
            SaleReturn.created_at >= start_dt,
            SaleReturn.created_at <= end_dt,
            SaleReturn.status == "COMPLETED",
        )

        if cashier_id is not None:
            query = query.where(SaleReturn.processed_by == cashier_id)

        row = db.session.execute(query).one()
        return {
            "refund_total": Decimal(str(row.refund_total or "0.00")),
            "return_count": int(row.return_count or 0),
        }

    @staticmethod
    def get_cogs_kpis(start_dt: datetime, end_dt: datetime) -> Dict[str, Decimal]:
        """Compute sold COGS, returned COGS, and net COGS using historical SaleItem.cost_price snapshots."""
        sold_cogs_query = (
            select(
                func.coalesce(
                    func.sum(SaleItem.quantity * SaleItem.cost_price),
                    Decimal("0.00"),
                )
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(
                Sale.created_at >= start_dt,
                Sale.created_at <= end_dt,
                Sale.status.in_([SaleStatus.COMPLETED.value, SaleStatus.RETURNED.value]),
            )
        )
        sold_cogs = db.session.execute(sold_cogs_query).scalar() or Decimal("0.00")
        sold_cogs = Decimal(str(sold_cogs))

        returned_cogs_query = (
            select(
                func.coalesce(
                    func.sum(SaleReturnItem.quantity * SaleItem.cost_price),
                    Decimal("0.00"),
                )
            )
            .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
            .join(SaleItem, SaleReturnItem.sale_item_id == SaleItem.id)
            .where(
                SaleReturn.created_at >= start_dt,
                SaleReturn.created_at <= end_dt,
                SaleReturn.status == "COMPLETED",
            )
        )
        returned_cogs = db.session.execute(returned_cogs_query).scalar() or Decimal("0.00")
        returned_cogs = Decimal(str(returned_cogs))

        net_cogs = sold_cogs - returned_cogs

        return {
            "sold_cogs": sold_cogs,
            "returned_cogs": returned_cogs,
            "net_cogs": net_cogs,
        }

    @staticmethod
    def get_operating_expenses(target_date: date) -> Decimal:
        """Aggregate expenses by business expense_date."""
        query = select(
            func.coalesce(func.sum(Expense.amount), Decimal("0.00"))
        ).where(Expense.expense_date == target_date)
        res = db.session.execute(query).scalar() or Decimal("0.00")
        return Decimal(str(res))

    @staticmethod
    def get_inventory_kpis() -> Dict[str, int]:
        """Compute active, low-stock, and out-of-stock product counts."""
        query = select(
            func.count(Product.id).filter(Product.is_active.is_(True)).label("active_products"),
            func.count(Product.id)
            .filter(
                Product.is_active.is_(True),
                Product.reorder_level > 0,
                Product.stock_quantity > 0,
                Product.stock_quantity <= Product.reorder_level,
            )
            .label("low_stock"),
            func.count(Product.id)
            .filter(Product.is_active.is_(True), Product.stock_quantity <= 0)
            .label("out_of_stock"),
        )
        row = db.session.execute(query).one()
        return {
            "active_products": int(row.active_products or 0),
            "low_stock": int(row.low_stock or 0),
            "out_of_stock": int(row.out_of_stock or 0),
        }

    @staticmethod
    def get_sales_trend(
        start_dt: datetime,
        end_dt: datetime,
        tz_name: str = "Asia/Manila",
    ) -> Dict[str, Dict[date, Decimal]]:
        """Query sales and refunds grouped by local calendar day."""
        sale_day = func.date(func.timezone(tz_name, Sale.created_at))
        sales_query = (
            select(
                sale_day.label("day"),
                func.coalesce(func.sum(Sale.subtotal), Decimal("0.00")).label("gross_sales"),
                func.coalesce(func.sum(Sale.total), Decimal("0.00")).label("revenue"),
            )
            .where(
                Sale.created_at >= start_dt,
                Sale.created_at <= end_dt,
                Sale.status.in_([SaleStatus.COMPLETED.value, SaleStatus.RETURNED.value]),
            )
            .group_by(sale_day)
        )
        sales_rows = db.session.execute(sales_query).all()
        sales_by_day = {
            row.day: {
                "gross_sales": Decimal(str(row.gross_sales or "0.00")),
                "revenue": Decimal(str(row.revenue or "0.00")),
            }
            for row in sales_rows
        }

        return_day = func.date(func.timezone(tz_name, SaleReturn.created_at))
        refunds_query = (
            select(
                return_day.label("day"),
                func.coalesce(func.sum(SaleReturn.refund_amount), Decimal("0.00")).label("refunds"),
            )
            .where(
                SaleReturn.created_at >= start_dt,
                SaleReturn.created_at <= end_dt,
                SaleReturn.status == "COMPLETED",
            )
            .group_by(return_day)
        )
        refund_rows = db.session.execute(refunds_query).all()
        refunds_by_day = {
            row.day: Decimal(str(row.refunds or "0.00")) for row in refund_rows
        }

        return {
            "sales_by_day": sales_by_day,
            "refunds_by_day": refunds_by_day,
        }

    @staticmethod
    def get_top_products(
        start_dt: datetime,
        end_dt: datetime,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """Compute top products ranked by return-adjusted net quantity sold within period."""
        sales_subq = (
            select(
                SaleItem.product_id,
                func.sum(SaleItem.quantity).label("sold_qty"),
                func.sum(SaleItem.subtotal).label("sold_subtotal"),
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(
                Sale.created_at >= start_dt,
                Sale.created_at <= end_dt,
                Sale.status.in_([SaleStatus.COMPLETED.value, SaleStatus.RETURNED.value]),
            )
            .group_by(SaleItem.product_id)
            .subquery()
        )

        returns_subq = (
            select(
                SaleReturnItem.product_id,
                func.sum(SaleReturnItem.quantity).label("returned_qty"),
                func.sum(SaleReturnItem.refund_subtotal).label("refunded_subtotal"),
            )
            .join(SaleReturn, SaleReturnItem.sale_return_id == SaleReturn.id)
            .where(
                SaleReturn.created_at >= start_dt,
                SaleReturn.created_at <= end_dt,
                SaleReturn.status == "COMPLETED",
            )
            .group_by(SaleReturnItem.product_id)
            .subquery()
        )

        net_qty = (
            func.coalesce(sales_subq.c.sold_qty, Decimal("0.000"))
            - func.coalesce(returns_subq.c.returned_qty, Decimal("0.000"))
        ).label("net_quantity_sold")

        net_sales = (
            func.coalesce(sales_subq.c.sold_subtotal, Decimal("0.00"))
            - func.coalesce(returns_subq.c.refunded_subtotal, Decimal("0.00"))
        ).label("net_sales")

        query = (
            select(
                Product.id,
                Product.name,
                Product.sku,
                Product.unit,
                net_qty,
                net_sales,
            )
            .outerjoin(sales_subq, Product.id == sales_subq.c.product_id)
            .outerjoin(returns_subq, Product.id == returns_subq.c.product_id)
            .where(net_qty > 0)
            .order_by(desc(net_qty), desc(net_sales))
            .limit(limit)
        )

        rows = db.session.execute(query).all()
        return [
            {
                "product_id": row.id,
                "name": row.name,
                "sku": row.sku,
                "unit": row.unit,
                "net_quantity_sold": Decimal(str(row.net_quantity_sold)),
                "net_sales": Decimal(str(row.net_sales)),
            }
            for row in rows
        ]

    @staticmethod
    def get_expense_breakdown(
        start_date: date,
        end_date: date,
    ) -> List[Dict[str, Any]]:
        """Compute category-grouped expenses within date boundaries."""
        query = (
            select(
                ExpenseCategory.name.label("category"),
                func.coalesce(func.sum(Expense.amount), Decimal("0.00")).label("amount"),
            )
            .join(ExpenseCategory, Expense.category_id == ExpenseCategory.id)
            .where(Expense.expense_date >= start_date, Expense.expense_date <= end_date)
            .group_by(ExpenseCategory.id, ExpenseCategory.name)
            .having(func.sum(Expense.amount) > 0)
            .order_by(desc(func.sum(Expense.amount)))
        )
        rows = db.session.execute(query).all()
        total = sum((Decimal(str(r.amount)) for r in rows), Decimal("0.00"))

        result = []
        for r in rows:
            amt = Decimal(str(r.amount))
            pct = (amt / total * Decimal("100.0")).quantize(Decimal("0.1")) if total > Decimal("0.00") else Decimal("0.0")
            result.append({
                "category": r.category,
                "amount": amt,
                "percentage": str(pct),
            })
        return result

    @staticmethod
    def get_inventory_alerts(limit: int = 5) -> List[Dict[str, Any]]:
        """Return top critical inventory alerts (out of stock first, then lowest relative stock to reorder level)."""
        severity_rank = case(
            (Product.stock_quantity <= 0, 1),
            else_=2,
        ).label("severity")

        # Ratio of stock to reorder level (null-safe)
        stock_ratio = (
            Product.stock_quantity / func.nullif(Product.reorder_level, Decimal("0.000"))
        ).label("stock_ratio")

        query = (
            select(
                Product.id,
                Product.name,
                Product.sku,
                Product.unit,
                Product.stock_quantity,
                Product.reorder_level,
                severity_rank,
            )
            .where(
                Product.is_active.is_(True),
                (Product.stock_quantity <= 0)
                | (
                    (Product.reorder_level > 0)
                    & (Product.stock_quantity <= Product.reorder_level)
                ),
            )
            .order_by(severity_rank.asc(), stock_ratio.asc(), Product.stock_quantity.asc())
            .limit(limit)
        )

        rows = db.session.execute(query).all()
        alerts = []
        for r in rows:
            status = "OUT_OF_STOCK" if r.stock_quantity <= 0 else "LOW_STOCK"
            alerts.append({
                "id": r.id,
                "name": r.name,
                "sku": r.sku,
                "unit": r.unit,
                "stock_quantity": Decimal(str(r.stock_quantity)),
                "reorder_level": Decimal(str(r.reorder_level)),
                "status": status,
            })
        return alerts

    @staticmethod
    def get_recent_sales(limit: int = 5, cashier_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Return recent sales transactions with items count and cashier name."""
        items_subq = (
            select(
                SaleItem.sale_id,
                func.count(SaleItem.id).label("item_count"),
            )
            .group_by(SaleItem.sale_id)
            .subquery()
        )

        query = (
            select(
                Sale.id,
                Sale.invoice_number,
                Sale.total,
                Sale.status,
                Sale.created_at,
                User.first_name,
                User.last_name,
                func.coalesce(items_subq.c.item_count, 0).label("item_count"),
            )
            .join(User, Sale.cashier_id == User.id)
            .outerjoin(items_subq, Sale.id == items_subq.c.sale_id)
            .order_by(desc(Sale.created_at), desc(Sale.id))
            .limit(limit)
        )

        if cashier_id is not None:
            query = query.where(Sale.cashier_id == cashier_id)

        rows = db.session.execute(query).all()
        return [
            {
                "id": r.id,
                "invoice_number": r.invoice_number,
                "total": Decimal(str(r.total)),
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "cashier": f"{r.first_name} {r.last_name}",
                "item_count": int(r.item_count),
            }
            for r in rows
        ]

    @staticmethod
    def get_recent_returns(limit: int = 5, cashier_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Return recent sales returns."""
        query = (
            select(
                SaleReturn.id,
                SaleReturn.return_number,
                SaleReturn.refund_amount,
                SaleReturn.created_at,
                Sale.invoice_number,
                User.first_name,
                User.last_name,
            )
            .join(Sale, SaleReturn.sale_id == Sale.id)
            .join(User, SaleReturn.processed_by == User.id)
            .order_by(desc(SaleReturn.created_at), desc(SaleReturn.id))
            .limit(limit)
        )

        if cashier_id is not None:
            query = query.where(SaleReturn.processed_by == cashier_id)

        rows = db.session.execute(query).all()
        return [
            {
                "id": r.id,
                "return_number": r.return_number,
                "invoice_number": r.invoice_number,
                "refund_amount": Decimal(str(r.refund_amount)),
                "processed_by": f"{r.first_name} {r.last_name}",
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    @staticmethod
    def get_recent_expenses(limit: int = 5) -> List[Dict[str, Any]]:
        """Return recent operating expenses."""
        query = (
            select(
                Expense.id,
                Expense.amount,
                Expense.expense_date,
                Expense.description,
                ExpenseCategory.name.label("category_name"),
                User.first_name,
                User.last_name,
            )
            .join(ExpenseCategory, Expense.category_id == ExpenseCategory.id)
            .join(User, Expense.created_by == User.id)
            .order_by(desc(Expense.expense_date), desc(Expense.created_at), desc(Expense.id))
            .limit(limit)
        )

        rows = db.session.execute(query).all()
        return [
            {
                "id": r.id,
                "category": r.category_name,
                "amount": Decimal(str(r.amount)),
                "expense_date": r.expense_date.isoformat(),
                "recorded_by": f"{r.first_name} {r.last_name}",
                "description": r.description or "",
            }
            for r in rows
        ]
