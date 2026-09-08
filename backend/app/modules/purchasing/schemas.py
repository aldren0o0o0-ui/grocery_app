from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

from app.common.errors import AppError
from app.modules.purchasing.models import Purchase, PurchaseItem


def parse_positive_decimal(
    val: Any, field_name: str, max_decimals: int = 3, allow_zero: bool = False
) -> Decimal:
    """Parses and validates a positive decimal value with max decimal places."""
    if val is None or val == "":
        raise AppError("VALIDATION_ERROR", f"{field_name} is required.", 400)

    try:
        dec = Decimal(str(val).strip())
    except (InvalidOperation, ValueError, TypeError):
        raise AppError("VALIDATION_ERROR", f"Invalid numeric format for {field_name}.", 400)

    if allow_zero:
        if dec < Decimal("0"):
            raise AppError("VALIDATION_ERROR", f"{field_name} must be greater than or equal to 0.", 400)
    else:
        if dec <= Decimal("0"):
            raise AppError("VALIDATION_ERROR", f"{field_name} must be greater than 0.", 400)

    # Check decimal places
    parts = str(dec).split(".")
    if len(parts) == 2 and len(parts[1]) > max_decimals:
        raise AppError(
            "VALIDATION_ERROR",
            f"{field_name} can have at most {max_decimals} decimal places.",
            400,
        )

    return dec


def validate_purchase_date(val: Any) -> date:
    """Parses and validates purchase date string (YYYY-MM-DD)."""
    if not val:
        return date.today()

    if isinstance(val, date):
        return val

    try:
        return datetime.strptime(str(val).strip(), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise AppError("VALIDATION_ERROR", "Invalid purchase_date format. Expected YYYY-MM-DD.", 400)


def validate_create_purchase_input(data: Dict[str, Any]) -> Tuple[int, date, Optional[str], List[Dict[str, Any]]]:
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    supplier_id = data.get("supplier_id")
    if supplier_id is None:
        raise AppError("VALIDATION_ERROR", "supplier_id is required.", 400)
    try:
        supplier_id = int(supplier_id)
        if supplier_id <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise AppError("VALIDATION_ERROR", "supplier_id must be a positive integer.", 400)

    p_date = validate_purchase_date(data.get("purchase_date"))

    reference_number = data.get("reference_number")
    if reference_number is not None:
        if not isinstance(reference_number, str) or not reference_number.strip():
            raise AppError("VALIDATION_ERROR", "reference_number cannot be empty if provided.", 400)
        reference_number = reference_number.strip().upper()

    raw_items = data.get("items", [])
    if not isinstance(raw_items, list):
        raise AppError("VALIDATION_ERROR", "items must be a list.", 400)

    validated_items = []
    seen_products = set()
    for idx, itm in enumerate(raw_items):
        if not isinstance(itm, dict):
            raise AppError("VALIDATION_ERROR", f"Item at index {idx} must be a JSON object.", 400)

        p_id = itm.get("product_id")
        if p_id is None:
            raise AppError("VALIDATION_ERROR", f"product_id is required for item at index {idx}.", 400)
        try:
            p_id = int(p_id)
            if p_id <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            raise AppError("VALIDATION_ERROR", f"product_id must be a positive integer at index {idx}.", 400)

        if p_id in seen_products:
            raise AppError(
                "DUPLICATE_PRODUCT_IN_PURCHASE",
                f"Duplicate product_id {p_id} in purchase line items.",
                400,
            )
        seen_products.add(p_id)

        qty = parse_positive_decimal(itm.get("quantity"), f"items[{idx}].quantity", max_decimals=3, allow_zero=False)
        unit_cost = parse_positive_decimal(itm.get("unit_cost"), f"items[{idx}].unit_cost", max_decimals=2, allow_zero=True)

        validated_items.append({
            "product_id": p_id,
            "quantity": qty,
            "unit_cost": unit_cost,
        })

    return supplier_id, p_date, reference_number, validated_items


def validate_add_item_input(data: Dict[str, Any]) -> Tuple[int, Decimal, Decimal]:
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    p_id = data.get("product_id")
    if p_id is None:
        raise AppError("VALIDATION_ERROR", "product_id is required.", 400)
    try:
        p_id = int(p_id)
        if p_id <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise AppError("VALIDATION_ERROR", "product_id must be a positive integer.", 400)

    qty = parse_positive_decimal(data.get("quantity"), "quantity", max_decimals=3, allow_zero=False)
    unit_cost = parse_positive_decimal(data.get("unit_cost"), "unit_cost", max_decimals=2, allow_zero=True)

    return p_id, qty, unit_cost


def validate_update_item_input(data: Dict[str, Any]) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    qty = None
    if "quantity" in data:
        qty = parse_positive_decimal(data.get("quantity"), "quantity", max_decimals=3, allow_zero=False)

    unit_cost = None
    if "unit_cost" in data:
        unit_cost = parse_positive_decimal(data.get("unit_cost"), "unit_cost", max_decimals=2, allow_zero=True)

    if qty is None and unit_cost is None:
        raise AppError("VALIDATION_ERROR", "At least one of 'quantity' or 'unit_cost' must be provided.", 400)

    return qty, unit_cost


def purchase_item_schema(item: PurchaseItem) -> Dict[str, Any]:
    prod = item.product
    return {
        "id": item.id,
        "purchase_id": item.purchase_id,
        "product_id": item.product_id,
        "product": {
            "id": prod.id,
            "name": prod.name,
            "sku": prod.sku,
            "unit": prod.unit,
            "cost_price": f"{prod.cost_price:.2f}" if prod.cost_price is not None else "0.00",
            "selling_price": f"{prod.selling_price:.2f}" if prod.selling_price is not None else "0.00",
            "stock_quantity": f"{prod.stock_quantity:.3f}" if prod.stock_quantity is not None else "0.000",
        } if prod else None,
        "quantity": f"{item.quantity:.3f}",
        "unit_cost": f"{item.unit_cost:.2f}",
        "subtotal": f"{item.subtotal:.2f}",
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def purchase_schema(purchase: Purchase, include_items: bool = True) -> Dict[str, Any]:
    sup = purchase.supplier
    creator = purchase.creator

    res = {
        "id": purchase.id,
        "supplier_id": purchase.supplier_id,
        "supplier": {
            "id": sup.id,
            "name": sup.name,
            "contact_person": sup.contact_person,
            "phone": sup.phone,
            "email": sup.email,
            "is_active": sup.is_active,
        } if sup else None,
        "reference_number": purchase.reference_number,
        "purchase_date": purchase.purchase_date.strftime("%Y-%m-%d") if purchase.purchase_date else None,
        "status": purchase.status,
        "total_amount": f"{purchase.total_amount:.2f}",
        "created_by": purchase.created_by,
        "creator": {
            "id": creator.id,
            "first_name": creator.first_name,
            "last_name": creator.last_name,
            "email": creator.email,
        } if creator else None,
        "item_count": len(purchase.items) if purchase.items is not None else 0,
        "created_at": purchase.created_at.isoformat() if purchase.created_at else None,
        "updated_at": purchase.updated_at.isoformat() if purchase.updated_at else None,
    }

    if include_items:
        res["items"] = [purchase_item_schema(item) for item in (purchase.items or [])]

    return res
