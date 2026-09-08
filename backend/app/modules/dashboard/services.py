from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any, Dict, Tuple
from zoneinfo import ZoneInfo
from flask import current_app

from app.modules.dashboard.repository import DashboardRepository
from app.modules.dashboard.schemas import (
    serialize_cashier_overview,
    serialize_owner_overview,
    serialize_staff_overview,
)
from app.modules.users.models import User


class DashboardService:
    """Service layer for aggregating and orchestrating dashboard data according to role."""

    @staticmethod
    def get_business_timezone() -> ZoneInfo:
        tz_name = current_app.config.get("BUSINESS_TIMEZONE", "Asia/Manila")
        try:
            return ZoneInfo(tz_name)
        except Exception:
            return ZoneInfo("Asia/Manila")

    @staticmethod
    def get_day_bounds(target_date: date, tz: ZoneInfo) -> Tuple[datetime, datetime]:
        """Convert a local calendar date into start and end timezone-aware datetimes."""
        start_dt = datetime.combine(target_date, time.min, tzinfo=tz)
        end_dt = datetime.combine(target_date, time.max, tzinfo=tz)
        return start_dt, end_dt

    @classmethod
    def get_overview(cls, actor: User, target_date: date = None) -> Dict[str, Any]:
        """Dispatch overview generation based on actor's authenticated role."""
        tz = cls.get_business_timezone()
        tz_str = tz.key if hasattr(tz, "key") and tz.key else "Asia/Manila"

        if target_date is None:
            now_local = datetime.now(tz)
            business_date = now_local.date()
        else:
            business_date = target_date

        start_dt, end_dt = cls.get_day_bounds(business_date, tz)

        role_name = actor.role.name if actor.role else "STAFF"

        if role_name == "OWNER":
            return cls._get_owner_overview(business_date, start_dt, end_dt, tz, tz_str)
        elif role_name == "CASHIER":
            return cls._get_cashier_overview(actor, business_date, start_dt, end_dt, tz_str)
        else:  # STAFF
            return cls._get_staff_overview(business_date, tz_str)

    @classmethod
    def _get_owner_overview(
        cls,
        business_date: date,
        start_dt: datetime,
        end_dt: datetime,
        tz: ZoneInfo,
        tz_str: str,
    ) -> Dict[str, Any]:
        # 1. Sales & Refunds
        sales_kpis = DashboardRepository.get_sales_kpis(start_dt, end_dt)
        refund_kpis = DashboardRepository.get_refund_kpis(start_dt, end_dt)

        gross_revenue = sales_kpis["gross_revenue_after_discount"]
        refund_total = refund_kpis["refund_total"]
        net_sales = gross_revenue - refund_total

        # 2. COGS & Profit
        cogs_kpis = DashboardRepository.get_cogs_kpis(start_dt, end_dt)
        net_cogs = cogs_kpis["net_cogs"]
        estimated_gross_profit = net_sales - net_cogs

        # 3. Operating Expenses
        operating_expenses = DashboardRepository.get_operating_expenses(business_date)
        estimated_net_profit = estimated_gross_profit - operating_expenses

        # 4. Inventory
        inventory_kpis = DashboardRepository.get_inventory_kpis()
        inventory_alerts = DashboardRepository.get_inventory_alerts(limit=5)

        # 5. 7-Day Trend (ending today)
        trend_start_date = business_date - timedelta(days=6)
        trend_start_dt = datetime.combine(trend_start_date, time.min, tzinfo=tz)
        trend_raw = DashboardRepository.get_sales_trend(trend_start_dt, end_dt, tz_name=tz_str)

        sales_by_day = trend_raw["sales_by_day"]
        refunds_by_day = trend_raw["refunds_by_day"]

        trend = []
        for i in range(7):
            day = trend_start_date + timedelta(days=i)
            day_sales = sales_by_day.get(day, {})
            day_gross = day_sales.get("gross_sales", Decimal("0.00"))
            day_revenue = day_sales.get("revenue", Decimal("0.00"))
            day_refund = refunds_by_day.get(day, Decimal("0.00"))
            day_net = day_revenue - day_refund
            trend.append({
                "date": day.isoformat(),
                "gross_sales": day_gross,
                "refunds": day_refund,
                "net_sales": day_net,
            })

        # 6. Top Products & Expense Breakdown
        top_products = DashboardRepository.get_top_products(start_dt, end_dt, limit=5)
        expense_breakdown = DashboardRepository.get_expense_breakdown(business_date, business_date)

        # 7. Recent Activities
        recent_sales = DashboardRepository.get_recent_sales(limit=5)
        recent_returns = DashboardRepository.get_recent_returns(limit=5)
        recent_expenses = DashboardRepository.get_recent_expenses(limit=5)

        raw_data = {
            "business_date": business_date,
            "timezone": tz_str,
            "sales": sales_kpis,
            "refunds": refund_kpis,
            "net_sales": net_sales,
            "cogs": cogs_kpis,
            "estimated_gross_profit": estimated_gross_profit,
            "operating_expenses": operating_expenses,
            "estimated_net_profit": estimated_net_profit,
            "inventory": inventory_kpis,
            "trend": trend,
            "top_products": top_products,
            "expense_breakdown": expense_breakdown,
            "inventory_alerts": inventory_alerts,
            "recent_sales": recent_sales,
            "recent_returns": recent_returns,
            "recent_expenses": recent_expenses,
        }

        return serialize_owner_overview(raw_data)

    @classmethod
    def _get_staff_overview(cls, business_date: date, tz_str: str) -> Dict[str, Any]:
        inventory_kpis = DashboardRepository.get_inventory_kpis()
        inventory_alerts = DashboardRepository.get_inventory_alerts(limit=5)
        recent_expenses = DashboardRepository.get_recent_expenses(limit=5)

        raw_data = {
            "business_date": business_date,
            "timezone": tz_str,
            "inventory": inventory_kpis,
            "inventory_alerts": inventory_alerts,
            "recent_expenses": recent_expenses,
        }

        return serialize_staff_overview(raw_data)

    @classmethod
    def _get_cashier_overview(
        cls,
        actor: User,
        business_date: date,
        start_dt: datetime,
        end_dt: datetime,
        tz_str: str,
    ) -> Dict[str, Any]:
        sales_kpis = DashboardRepository.get_sales_kpis(start_dt, end_dt, cashier_id=actor.id)
        refund_kpis = DashboardRepository.get_refund_kpis(start_dt, end_dt, cashier_id=actor.id)

        gross_revenue = sales_kpis["gross_revenue_after_discount"]
        refund_total = refund_kpis["refund_total"]
        net_sales = gross_revenue - refund_total

        recent_sales = DashboardRepository.get_recent_sales(limit=5, cashier_id=actor.id)

        raw_data = {
            "business_date": business_date,
            "timezone": tz_str,
            "sales": sales_kpis,
            "refunds": refund_kpis,
            "net_sales": net_sales,
            "recent_sales": recent_sales,
        }

        return serialize_cashier_overview(raw_data)
