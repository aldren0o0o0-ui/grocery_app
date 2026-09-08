from decimal import Decimal, InvalidOperation
from typing import Any, Dict
from app.common.errors import AppError
from app.modules.products.models import Product


def parse_decimal(value: Any, field_name: str, min_value: Decimal = Decimal("0")) -> Decimal:
    try:
        dec = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise AppError("VALIDATION_ERROR", f"Field '{field_name}' must be a valid number.", 400)

    if dec < min_value:
        raise AppError("VALIDATION_ERROR", f"Field '{field_name}' cannot be negative.", 400)

    return dec


def validate_product_input(data: Dict[str, Any], is_update: bool = False) -> Dict[str, Any]:
    """Validates and normalizes product payload, strictly rejecting stock mutations."""
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    # Invariant: stock_quantity cannot be edited through product CRUD
    if "stock_quantity" in data:
        raise AppError(
            "VALIDATION_ERROR",
            "Field 'stock_quantity' cannot be modified directly through product management.",
            400,
        )

    for forbidden_field in ("id", "created_at", "updated_at"):
        if forbidden_field in data:
            raise AppError("VALIDATION_ERROR", f"Field '{forbidden_field}' cannot be modified.", 400)

    clean_data: Dict[str, Any] = {}

    # Category ID
    if not is_update or "category_id" in data:
        cat_id = data.get("category_id")
        if cat_id is None or not isinstance(cat_id, int):
            raise AppError("VALIDATION_ERROR", "Valid integer 'category_id' is required.", 400)
        clean_data["category_id"] = cat_id

    # Name
    if not is_update or "name" in data:
        name = data.get("name")
        if not name or not isinstance(name, str) or not name.strip():
            raise AppError("VALIDATION_ERROR", "Product name is required and cannot be empty.", 400)
        clean_data["name"] = name.strip()

    # SKU
    if not is_update or "sku" in data:
        sku = data.get("sku")
        if not sku or not isinstance(sku, str) or not sku.strip():
            raise AppError("VALIDATION_ERROR", "Product SKU is required and cannot be empty.", 400)
        clean_data["sku"] = sku.strip().upper()

    # Barcode
    if "barcode" in data:
        barcode = data.get("barcode")
        if barcode is None or (isinstance(barcode, str) and not barcode.strip()):
            clean_data["barcode"] = None
        elif isinstance(barcode, str):
            clean_data["barcode"] = barcode.strip()
        else:
            raise AppError("VALIDATION_ERROR", "Barcode must be a string.", 400)

    # Description
    if "description" in data:
        desc = data.get("description")
        clean_data["description"] = desc.strip() if isinstance(desc, str) and desc.strip() else None

    # Unit
    if not is_update or "unit" in data:
        unit = data.get("unit", "pcs")
        if not unit or not isinstance(unit, str) or not unit.strip():
            raise AppError("VALIDATION_ERROR", "Unit is required and cannot be empty.", 400)
        clean_data["unit"] = unit.strip()

    # Cost Price
    if not is_update or "cost_price" in data:
        cost = data.get("cost_price", "0.00")
        clean_data["cost_price"] = parse_decimal(cost, "cost_price")

    # Selling Price
    if not is_update or "selling_price" in data:
        price = data.get("selling_price", "0.00")
        clean_data["selling_price"] = parse_decimal(price, "selling_price")

    # Reorder Level
    if not is_update or "reorder_level" in data:
        reorder = data.get("reorder_level", "0.000")
        clean_data["reorder_level"] = parse_decimal(reorder, "reorder_level")

    return clean_data


def product_schema(product: Product) -> Dict[str, Any]:
    """Serializes a Product entity into a safe dictionary format."""
    return {
        "id": product.id,
        "name": product.name,
        "sku": product.sku,
        "barcode": product.barcode,
        "description": product.description,
        "unit": product.unit,
        "cost_price": f"{product.cost_price:.2f}",
        "selling_price": f"{product.selling_price:.2f}",
        "stock_quantity": f"{product.stock_quantity:.3f}",
        "reorder_level": f"{product.reorder_level:.3f}",
        "is_active": product.is_active,
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "updated_at": product.updated_at.isoformat() if product.updated_at else None,
        "category": (
            {
                "id": product.category.id,
                "name": product.category.name,
            }
            if product.category
            else None
        ),
    }
