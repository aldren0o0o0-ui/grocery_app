from decimal import Decimal
from typing import Any, Dict, List


def format_money(val: Any) -> str:
    """Safely format a money value as a 2-decimal string."""
    if val is None:
        return "0.00"
    if isinstance(val, Decimal):
        return f"{val:.2f}"
    try:
        d = Decimal(str(val))
        return f"{d:.2f}"
    except Exception:
        return "0.00"


def format_qty(val: Any) -> str:
    """Safely format a quantity value as a 3-decimal string."""
    if val is None:
        return "0.000"
    if isinstance(val, Decimal):
        return f"{val:.3f}"
    try:
        d = Decimal(str(val))
        return f"{d:.3f}"
    except Exception:
        return "0.000"


def serialize_owner_overview(data: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize full operational and financial dashboard for OWNER."""
    return {
        "period": {
            "date": data["business_date"].isoformat(),
            "timezone": data["timezone"],
        },
        "sales": {
            "gross_sales": format_money(data["sales"]["gross_sales"]),
            "discount_total": format_money(data["sales"]["discount_total"]),
            "refunds": format_money(data["refunds"]["refund_total"]),
            "net_sales": format_money(data["net_sales"]),
            "transactions": int(data["sales"]["transaction_count"]),
        },
        "profit": {
            "sold_cogs": format_money(data["cogs"]["sold_cogs"]),
            "returned_cogs": format_money(data["cogs"]["returned_cogs"]),
            "net_cogs": format_money(data["cogs"]["net_cogs"]),
            "estimated_gross_profit": format_money(data["estimated_gross_profit"]),
            "operating_expenses": format_money(data["operating_expenses"]),
            "estimated_net_profit": format_money(data["estimated_net_profit"]),
        },
        "inventory": {
            "active_products": int(data["inventory"]["active_products"]),
            "low_stock": int(data["inventory"]["low_stock"]),
            "out_of_stock": int(data["inventory"]["out_of_stock"]),
        },
        "trend": [
            {
                "date": item["date"],
                "gross_sales": format_money(item["gross_sales"]),
                "refunds": format_money(item["refunds"]),
                "net_sales": format_money(item["net_sales"]),
            }
            for item in data.get("trend", [])
        ],
        "top_products": [
            {
                "product_id": p["product_id"],
                "name": p["name"],
                "sku": p["sku"],
                "unit": p["unit"],
                "net_quantity_sold": format_qty(p["net_quantity_sold"]),
                "net_sales": format_money(p["net_sales"]),
            }
            for p in data.get("top_products", [])
        ],
        "expense_breakdown": [
            {
                "category": exp["category"],
                "amount": format_money(exp["amount"]),
                "percentage": str(exp["percentage"]),
            }
            for exp in data.get("expense_breakdown", [])
        ],
        "inventory_alerts": [
            {
                "id": alert["id"],
                "name": alert["name"],
                "sku": alert["sku"],
                "unit": alert["unit"],
                "stock_quantity": format_qty(alert["stock_quantity"]),
                "reorder_level": format_qty(alert["reorder_level"]),
                "status": alert["status"],
            }
            for alert in data.get("inventory_alerts", [])
        ],
        "recent_sales": [
            {
                "id": s["id"],
                "invoice_number": s["invoice_number"],
                "total": format_money(s["total"]),
                "status": s["status"],
                "created_at": s["created_at"],
                "cashier": s["cashier"],
                "item_count": s["item_count"],
            }
            for s in data.get("recent_sales", [])
        ],
        "recent_returns": [
            {
                "id": r["id"],
                "return_number": r["return_number"],
                "invoice_number": r["invoice_number"],
                "refund_amount": format_money(r["refund_amount"]),
                "processed_by": r["processed_by"],
                "created_at": r["created_at"],
            }
            for r in data.get("recent_returns", [])
        ],
        "recent_expenses": [
            {
                "id": e["id"],
                "category": e["category"],
                "amount": format_money(e["amount"]),
                "expense_date": e["expense_date"],
                "recorded_by": e["recorded_by"],
                "description": e["description"],
            }
            for e in data.get("recent_expenses", [])
        ],
    }


def serialize_staff_overview(data: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize operational dashboard for STAFF. Strictly omits profit, margins, and sales totals."""
    return {
        "period": {
            "date": data["business_date"].isoformat(),
            "timezone": data["timezone"],
        },
        "inventory": {
            "active_products": int(data["inventory"]["active_products"]),
            "low_stock": int(data["inventory"]["low_stock"]),
            "out_of_stock": int(data["inventory"]["out_of_stock"]),
        },
        "inventory_alerts": [
            {
                "id": alert["id"],
                "name": alert["name"],
                "sku": alert["sku"],
                "unit": alert["unit"],
                "stock_quantity": format_qty(alert["stock_quantity"]),
                "reorder_level": format_qty(alert["reorder_level"]),
                "status": alert["status"],
            }
            for alert in data.get("inventory_alerts", [])
        ],
        "recent_expenses": [
            {
                "id": e["id"],
                "category": e["category"],
                "amount": format_money(e["amount"]),
                "expense_date": e["expense_date"],
                "recorded_by": e["recorded_by"],
                "description": e["description"],
            }
            for e in data.get("recent_expenses", [])
        ],
    }


def serialize_cashier_overview(data: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize POS-focused dashboard for CASHIER. Strictly personal metrics and recent transactions."""
    return {
        "period": {
            "date": data["business_date"].isoformat(),
            "timezone": data["timezone"],
        },
        "cashier_sales": {
            "today_sales": format_money(data["net_sales"]),
            "transactions": int(data["sales"]["transaction_count"]),
        },
        "recent_sales": [
            {
                "id": s["id"],
                "invoice_number": s["invoice_number"],
                "total": format_money(s["total"]),
                "status": s["status"],
                "created_at": s["created_at"],
                "cashier": s["cashier"],
                "item_count": s["item_count"],
            }
            for s in data.get("recent_sales", [])
        ],
    }
