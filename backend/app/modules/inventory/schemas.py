from decimal import Decimal, InvalidOperation
from typing import Any, Dict
from app.common.errors import AppError
from app.modules.inventory.models import StockMovement
from app.modules.products.models import Product

VALID_DIRECTIONS = {"IN", "OUT"}
VALID_REASONS = {"PHYSICAL_COUNT", "DAMAGED", "EXPIRED", "CORRECTION", "OTHER"}


def parse_quantity_decimal(value: Any, field_name: str = "quantity") -> Decimal:
    """Parses and validates positive decimal quantity for inventory transactions."""
    try:
        dec = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise AppError("INVALID_QUANTITY", f"Field '{field_name}' must be a valid numeric quantity.", 400)

    if dec <= Decimal("0.000"):
        raise AppError("INVALID_QUANTITY", f"Field '{field_name}' must be greater than zero.", 400)

    return dec


def validate_adjustment_input(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validates and normalizes manual stock adjustment payloads."""
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    # Validate product_id
    product_id = data.get("product_id")
    if product_id is None or not isinstance(product_id, int) or product_id <= 0:
        raise AppError("VALIDATION_ERROR", "Valid positive integer 'product_id' is required.", 400)

    # Validate direction
    direction_raw = data.get("direction")
    if not direction_raw or not isinstance(direction_raw, str):
        raise AppError("INVALID_ADJUSTMENT_DIRECTION", "Direction must be 'IN' or 'OUT'.", 400)
    direction = direction_raw.strip().upper()
    if direction not in VALID_DIRECTIONS:
        raise AppError("INVALID_ADJUSTMENT_DIRECTION", f"Invalid direction '{direction}'. Must be 'IN' or 'OUT'.", 400)

    # Validate quantity
    quantity_raw = data.get("quantity")
    if quantity_raw is None:
        raise AppError("INVALID_QUANTITY", "Quantity is required.", 400)
    quantity = parse_quantity_decimal(quantity_raw, "quantity")

    # Validate reason
    reason_raw = data.get("reason")
    if not reason_raw or not isinstance(reason_raw, str):
        raise AppError(
            "INVALID_ADJUSTMENT_REASON",
            f"Reason is required. Valid reasons: {', '.join(sorted(VALID_REASONS))}.",
            400,
        )
    reason = reason_raw.strip().upper()
    if reason not in VALID_REASONS:
        raise AppError(
            "INVALID_ADJUSTMENT_REASON",
            f"Invalid adjustment reason '{reason}'. Valid options: {', '.join(sorted(VALID_REASONS))}.",
            400,
        )

    # Validate remarks
    remarks_raw = data.get("remarks")
    remarks = remarks_raw.strip() if isinstance(remarks_raw, str) and remarks_raw.strip() else None

    return {
        "product_id": product_id,
        "direction": direction,
        "quantity": quantity,
        "reason": reason,
        "remarks": remarks,
    }


def inventory_item_schema(product: Product) -> Dict[str, Any]:
    """Serializes a Product entity with inventory metrics."""
    is_out_of_stock = product.stock_quantity == Decimal("0.000")
    is_low_stock = (
        product.reorder_level > Decimal("0.000")
        and product.stock_quantity <= product.reorder_level
        and product.stock_quantity > Decimal("0.000")
    )

    return {
        "product": {
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "barcode": product.barcode,
            "unit": product.unit,
            "cost_price": f"{product.cost_price:.2f}",
            "selling_price": f"{product.selling_price:.2f}",
            "category": (
                {
                    "id": product.category.id,
                    "name": product.category.name,
                }
                if product.category
                else None
            ),
        },
        "stock_quantity": f"{product.stock_quantity:.3f}",
        "reorder_level": f"{product.reorder_level:.3f}",
        "is_low_stock": is_low_stock,
        "is_out_of_stock": is_out_of_stock,
        "is_active": product.is_active,
    }


def stock_movement_schema(movement: StockMovement) -> Dict[str, Any]:
    """Serializes an immutable StockMovement ledger entry."""
    creator_info = None
    if movement.creator:
        creator_info = {
            "id": movement.creator.id,
            "email": movement.creator.email,
            "name": f"{movement.creator.first_name} {movement.creator.last_name}".strip(),
        }

    return {
        "id": movement.id,
        "product_id": movement.product_id,
        "movement_type": movement.movement_type,
        "quantity": f"{movement.quantity:.3f}",
        "quantity_before": f"{movement.quantity_before:.3f}",
        "quantity_after": f"{movement.quantity_after:.3f}",
        "reference_type": movement.reference_type,
        "reference_id": movement.reference_id,
        "remarks": movement.remarks,
        "created_by": creator_info,
        "created_at": movement.created_at.isoformat() if movement.created_at else None,
    }
