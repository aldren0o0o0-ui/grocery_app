from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Tuple

from app.common.errors import AppError
from app.modules.returns.models import SaleReturn, SaleReturnItem

ALLOWED_REFUND_METHODS = {"CASH", "GCASH", "CARD"}


def parse_quantity_decimal(val: Any, field_name: str = "quantity") -> Decimal:
    """Parses stock quantity with maximum 3 decimal places precision."""
    if val is None:
        raise AppError("INVALID_QUANTITY", f"Field '{field_name}' is required.", 400)
    try:
        dec = Decimal(str(val).strip())
    except (InvalidOperation, TypeError, ValueError):
        raise AppError("INVALID_QUANTITY", f"Invalid numeric format for '{field_name}'.", 400)

    if dec.as_tuple().exponent < -3:
        raise AppError("INVALID_QUANTITY", f"'{field_name}' exceeds maximum 3 decimal places.", 400)

    return dec


def validate_return_input(data: Dict[str, Any]) -> Tuple[int, str, str, List[Dict[str, Any]]]:
    """Validates and normalizes return request payload.

    Merges duplicate sale_item_id lines by accumulating requested quantity.
    Returns: (sale_id, reason, refund_method, normalized_items)
    """
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    sale_id = data.get("sale_id")
    if not sale_id or not isinstance(sale_id, int) or sale_id <= 0:
        raise AppError("VALIDATION_ERROR", "Valid 'sale_id' is required.", 400)

    raw_reason = data.get("reason")
    if not raw_reason or not isinstance(raw_reason, str) or not raw_reason.strip():
        raise AppError("VALIDATION_ERROR", "A non-empty 'reason' is required for returns.", 400)
    reason = raw_reason.strip()

    raw_method = data.get("refund_method")
    if not raw_method or not isinstance(raw_method, str):
        raise AppError("INVALID_REFUND_METHOD", "Field 'refund_method' is required.", 400)

    refund_method = raw_method.strip().upper()
    if refund_method not in ALLOWED_REFUND_METHODS:
        raise AppError(
            "INVALID_REFUND_METHOD",
            f"Invalid refund method '{refund_method}'. Allowed: {', '.join(sorted(ALLOWED_REFUND_METHODS))}.",
            400,
        )

    items_raw = data.get("items")
    if not items_raw or not isinstance(items_raw, list) or len(items_raw) == 0:
        raise AppError("RETURN_EMPTY", "Cannot process an empty return. Please specify items.", 400)

    # Normalize duplicate sale_item_ids
    merged_items: Dict[int, Decimal] = {}
    for itm in items_raw:
        if not isinstance(itm, dict):
            raise AppError("VALIDATION_ERROR", "Each return item must be an object.", 400)

        sale_item_id = itm.get("sale_item_id")
        if not sale_item_id or not isinstance(sale_item_id, int) or sale_item_id <= 0:
            raise AppError("VALIDATION_ERROR", "Valid 'sale_item_id' is required for each item.", 400)

        qty = parse_quantity_decimal(itm.get("quantity"), "quantity")
        if qty <= Decimal("0"):
            raise AppError("INVALID_QUANTITY", "Return item quantity must be greater than zero.", 400)

        merged_items[sale_item_id] = merged_items.get(sale_item_id, Decimal("0.000")) + qty

    normalized_items = [
        {"sale_item_id": sid, "quantity": qty}
        for sid, qty in merged_items.items()
    ]

    return sale_id, reason, refund_method, normalized_items


def sale_return_item_schema(item: SaleReturnItem, is_owner: bool = False) -> Dict[str, Any]:
    res = {
        "id": item.id,
        "sale_item_id": item.sale_item_id,
        "product_id": item.product_id,
        "product_name": item.product.name if item.product else None,
        "product_sku": item.product.sku if item.product else None,
        "product_unit": item.product.unit if item.product else "pcs",
        "quantity": f"{item.quantity:.3f}",
        "unit_price": f"{item.unit_price:.2f}",
        "refund_subtotal": f"{item.refund_subtotal:.2f}",
    }
    if is_owner and item.product:
        res["cost_price"] = f"{item.product.cost_price:.2f}"
    return res


def sale_return_schema(sale_return: SaleReturn, is_owner: bool = False) -> Dict[str, Any]:
    processor_info = None
    if sale_return.processor:
        processor_info = {
            "id": sale_return.processor.id,
            "name": f"{sale_return.processor.first_name} {sale_return.processor.last_name}".strip(),
            "email": sale_return.processor.email,
        }

    return {
        "id": sale_return.id,
        "return_number": sale_return.return_number,
        "sale_id": sale_return.sale_id,
        "original_invoice_number": sale_return.sale.invoice_number if sale_return.sale else None,
        "refund_method": sale_return.refund_method,
        "refund_amount": f"{sale_return.refund_amount:.2f}",
        "reason": sale_return.reason,
        "status": sale_return.status,
        "processor": processor_info,
        "items": [sale_return_item_schema(it, is_owner=is_owner) for it in (sale_return.items or [])],
        "created_at": sale_return.created_at.isoformat() if sale_return.created_at else None,
        "updated_at": sale_return.updated_at.isoformat() if sale_return.updated_at else None,
    }


def sale_return_summary_schema(sale_return: SaleReturn) -> Dict[str, Any]:
    processor_name = (
        f"{sale_return.processor.first_name} {sale_return.processor.last_name}".strip()
        if sale_return.processor
        else "Unknown"
    )
    return {
        "id": sale_return.id,
        "return_number": sale_return.return_number,
        "sale_id": sale_return.sale_id,
        "original_invoice_number": sale_return.sale.invoice_number if sale_return.sale else None,
        "processor_name": processor_name,
        "refund_amount": f"{sale_return.refund_amount:.2f}",
        "refund_method": sale_return.refund_method,
        "item_count": len(sale_return.items) if sale_return.items else 0,
        "created_at": sale_return.created_at.isoformat() if sale_return.created_at else None,
    }
