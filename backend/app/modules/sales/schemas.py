from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Tuple

from app.common.errors import AppError
from app.modules.products.models import Product
from app.modules.sales.models import Sale, SaleItem


ALLOWED_PAYMENT_METHODS = {"CASH", "GCASH", "CARD"}


def parse_money_decimal(val: Any, field_name: str, code: str = "VALIDATION_ERROR") -> Decimal:
    """Parses money input with maximum 2 decimal places precision."""
    if val is None:
        raise AppError(code, f"Field '{field_name}' is required.", 400)
    try:
        dec = Decimal(str(val).strip())
    except (InvalidOperation, TypeError, ValueError):
        raise AppError(code, f"Invalid numeric format for '{field_name}'.", 400)

    if dec.as_tuple().exponent < -2:
        raise AppError(code, f"'{field_name}' exceeds maximum 2 decimal places.", 400)

    return dec


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


def validate_checkout_input(data: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Decimal, Dict[str, Any]]:
    """Validates and normalizes checkout request body.

    Merges duplicate product IDs in cart into single line items with accumulated quantity.
    Returns: (normalized_items, discount, payment_info)
    """
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    items_raw = data.get("items")
    if not items_raw or not isinstance(items_raw, list) or len(items_raw) == 0:
        raise AppError("SALE_EMPTY", "Cannot checkout an empty cart.", 400)

    # Accumulate quantities per product_id to normalize cart
    merged_items: Dict[int, Decimal] = {}
    for itm in items_raw:
        if not isinstance(itm, dict):
            raise AppError("VALIDATION_ERROR", "Each cart item must be an object.", 400)

        product_id = itm.get("product_id")
        if not product_id or not isinstance(product_id, int) or product_id <= 0:
            raise AppError("VALIDATION_ERROR", "Invalid or missing 'product_id' in cart items.", 400)

        qty = parse_quantity_decimal(itm.get("quantity"), "quantity")
        if qty <= Decimal("0"):
            raise AppError("INVALID_QUANTITY", "Item quantity must be greater than zero.", 400)

        merged_items[product_id] = merged_items.get(product_id, Decimal("0.000")) + qty

    normalized_items = [
        {"product_id": pid, "quantity": qty}
        for pid, qty in merged_items.items()
    ]

    # Validate discount
    raw_discount = data.get("discount", "0.00")
    if raw_discount is None or str(raw_discount).strip() == "":
        discount = Decimal("0.00")
    else:
        discount = parse_money_decimal(raw_discount, "discount", code="INVALID_DISCOUNT")
        if discount < Decimal("0.00"):
            raise AppError("INVALID_DISCOUNT", "Discount cannot be negative.", 400)

    # Validate payment object
    payment_raw = data.get("payment")
    if not payment_raw or not isinstance(payment_raw, dict):
        raise AppError("VALIDATION_ERROR", "Payment information is required.", 400)

    raw_method = payment_raw.get("method")
    if not raw_method or not isinstance(raw_method, str):
        raise AppError("INVALID_PAYMENT_METHOD", "Payment method is required.", 400)

    method = raw_method.strip().upper()
    if method not in ALLOWED_PAYMENT_METHODS:
        raise AppError(
            "INVALID_PAYMENT_METHOD",
            f"Invalid payment method '{method}'. Allowed methods: {', '.join(sorted(ALLOWED_PAYMENT_METHODS))}.",
            400,
        )

    amount_paid = parse_money_decimal(payment_raw.get("amount_paid"), "amount_paid", code="VALIDATION_ERROR")
    if amount_paid < Decimal("0.00"):
        raise AppError("VALIDATION_ERROR", "Amount paid cannot be negative.", 400)

    payment_info = {
        "method": method,
        "amount_paid": amount_paid,
    }

    return normalized_items, discount, payment_info


def sale_item_schema(item: SaleItem, is_owner: bool = False) -> Dict[str, Any]:
    """Serializes a SaleItem with role-sensitive cost price exposure and return tracking."""
    returned_qty = sum((ri.quantity for ri in item.return_items), Decimal("0.000")) if item.return_items else Decimal("0.000")
    returnable_qty = max(Decimal("0.000"), item.quantity - returned_qty)

    res = {
        "id": item.id,
        "product_id": item.product_id,
        "product_name": item.product.name if item.product else None,
        "product_sku": item.product.sku if item.product else None,
        "product_barcode": item.product.barcode if item.product else None,
        "product_unit": item.product.unit if item.product else "pcs",
        "quantity": f"{item.quantity:.3f}",
        "returned_quantity": f"{returned_qty:.3f}",
        "returnable_quantity": f"{returnable_qty:.3f}",
        "unit_price": f"{item.unit_price:.2f}",
        "subtotal": f"{item.subtotal:.2f}",
    }
    if is_owner:
        res["cost_price"] = f"{item.cost_price:.2f}"
    return res


def sale_schema(sale: Sale, is_owner: bool = False) -> Dict[str, Any]:
    """Full serialization of Sale entity with items, payment details, and return status."""
    payments_data = []
    if sale.payments:
        for p in sale.payments:
            payments_data.append({
                "id": p.id,
                "payment_method": p.payment_method,
                "amount_paid": f"{p.amount_paid:.2f}",
                "change_amount": f"{p.change_amount:.2f}",
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })

    cashier_info = None
    if sale.cashier:
        cashier_info = {
            "id": sale.cashier.id,
            "name": f"{sale.cashier.first_name} {sale.cashier.last_name}".strip(),
            "email": sale.cashier.email,
        }

    returns_data = []
    total_refunded = Decimal("0.00")
    if sale.returns:
        for ret in sale.returns:
            total_refunded += ret.refund_amount
            returns_data.append({
                "id": ret.id,
                "return_number": ret.return_number,
                "refund_method": ret.refund_method,
                "refund_amount": f"{ret.refund_amount:.2f}",
                "reason": ret.reason,
                "created_at": ret.created_at.isoformat() if ret.created_at else None,
            })

    total_sold_qty = sum((it.quantity for it in sale.items), Decimal("0.000")) if sale.items else Decimal("0.000")
    total_returned_qty = sum((
        sum((ri.quantity for ri in r.items), Decimal("0.000")) for r in sale.returns
    ), Decimal("0.000")) if sale.returns else Decimal("0.000")

    if sale.status == "RETURNED" or (total_sold_qty > Decimal("0.000") and total_returned_qty >= total_sold_qty):
        return_state = "FULL"
    elif total_returned_qty > Decimal("0.000"):
        return_state = "PARTIAL"
    else:
        return_state = "NONE"

    return {
        "id": sale.id,
        "invoice_number": sale.invoice_number,
        "status": sale.status,
        "return_state": return_state,
        "subtotal": f"{sale.subtotal:.2f}",
        "discount": f"{sale.discount:.2f}",
        "total": f"{sale.total:.2f}",
        "total_refunded": f"{total_refunded:.2f}",
        "cashier": cashier_info,
        "items": [sale_item_schema(it, is_owner=is_owner) for it in (sale.items or [])],
        "payments": payments_data,
        "returns": returns_data,
        "created_at": sale.created_at.isoformat() if sale.created_at else None,
        "updated_at": sale.updated_at.isoformat() if sale.updated_at else None,
    }


def sale_summary_schema(sale: Sale) -> Dict[str, Any]:
    """Concise representation of Sale for list view."""
    cashier_name = f"{sale.cashier.first_name} {sale.cashier.last_name}".strip() if sale.cashier else "Unknown"
    payment_method = sale.payments[0].payment_method if sale.payments else "N/A"

    total_sold_qty = sum((it.quantity for it in sale.items), Decimal("0.000")) if sale.items else Decimal("0.000")
    total_returned_qty = sum((
        sum((ri.quantity for ri in r.items), Decimal("0.000")) for r in sale.returns
    ), Decimal("0.000")) if sale.returns else Decimal("0.000")

    if sale.status == "RETURNED" or (total_sold_qty > Decimal("0.000") and total_returned_qty >= total_sold_qty):
        return_state = "FULL"
    elif total_returned_qty > Decimal("0.000"):
        return_state = "PARTIAL"
    else:
        return_state = "NONE"

    return {
        "id": sale.id,
        "invoice_number": sale.invoice_number,
        "status": sale.status,
        "return_state": return_state,
        "cashier_id": sale.cashier_id,
        "cashier_name": cashier_name,
        "total": f"{sale.total:.2f}",
        "item_count": len(sale.items) if sale.items else 0,
        "payment_method": payment_method,
        "created_at": sale.created_at.isoformat() if sale.created_at else None,
    }


def pos_product_schema(product: Product) -> Dict[str, Any]:
    """Lightweight representation of product for POS catalog lookup."""
    return {
        "id": product.id,
        "name": product.name,
        "sku": product.sku,
        "barcode": product.barcode,
        "unit": product.unit,
        "selling_price": f"{product.selling_price:.2f}",
        "stock_quantity": f"{product.stock_quantity:.3f}",
        "is_active": product.is_active,
        "category_id": product.category_id,
        "category_name": product.category.name if product.category else None,
    }
