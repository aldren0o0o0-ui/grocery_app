from datetime import datetime
from flask import Blueprint, g, jsonify, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required, require_roles
from app.modules.inventory.schemas import validate_adjustment_input
from app.modules.inventory.services import InventoryService

inventory_bp = Blueprint("inventory", __name__, url_prefix="/api/inventory")


@inventory_bp.get("")
@jwt_required()
@require_roles("OWNER", "STAFF", "CASHIER")
def list_inventory():
    """Lists current inventory stock balances with filters and pagination."""
    try:
        page = request.args.get("page", default=1, type=int)
        per_page = request.args.get("per_page", default=10, type=int)
        search = request.args.get("search", default=None, type=str)
        category_id = request.args.get("category_id", default=None, type=int)
        stock_status = request.args.get("stock_status", default="ALL", type=str)

        is_active_raw = request.args.get("is_active", default=None, type=str)
        is_active = None
        if is_active_raw is not None:
            is_active = is_active_raw.lower() in ("true", "1", "yes")

        result = InventoryService.list_inventory(
            page=page,
            per_page=per_page,
            search=search,
            category_id=category_id,
            is_active=is_active,
            stock_status=stock_status,
        )
        return jsonify({"status": "success", "data": result}), 200
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching inventory.", 500)


@inventory_bp.get("/<int:product_id>")
@jwt_required()
@require_roles("OWNER", "STAFF", "CASHIER")
def get_product_stock(product_id: int):
    """Retrieves current stock balance and reorder levels for a specific product."""
    try:
        data = InventoryService.get_product_stock(product_id)
        return jsonify({"status": "success", "data": data}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching product stock.", 500)


@inventory_bp.get("/<int:product_id>/movements")
@jwt_required()
@require_roles("OWNER", "STAFF", "CASHIER")
def list_product_movements(product_id: int):
    """Retrieves paginated immutable stock movement ledger records for a product."""
    try:
        page = request.args.get("page", default=1, type=int)
        per_page = request.args.get("per_page", default=20, type=int)
        movement_type = request.args.get("movement_type", default=None, type=str)

        date_from_str = request.args.get("date_from", default=None, type=str)
        date_to_str = request.args.get("date_to", default=None, type=str)

        date_from = None
        if date_from_str:
            try:
                date_from = datetime.fromisoformat(date_from_str)
            except ValueError:
                return api_error("VALIDATION_ERROR", "Field 'date_from' must be a valid ISO datetime.", 400)

        date_to = None
        if date_to_str:
            try:
                date_to = datetime.fromisoformat(date_to_str)
            except ValueError:
                return api_error("VALIDATION_ERROR", "Field 'date_to' must be a valid ISO datetime.", 400)

        result = InventoryService.list_movements(
            product_id=product_id,
            page=page,
            per_page=per_page,
            movement_type=movement_type,
            date_from=date_from,
            date_to=date_to,
        )
        return jsonify({"status": "success", "data": result}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching stock movements.", 500)


@inventory_bp.get("/low-stock")
@jwt_required()
@require_roles("OWNER", "STAFF", "CASHIER")
def list_low_stock():
    """Lists products that have reached or dropped below their reorder level."""
    try:
        include_out_of_stock_raw = request.args.get("include_out_of_stock", default="true", type=str)
        include_out_of_stock = include_out_of_stock_raw.lower() in ("true", "1", "yes")

        items = InventoryService.list_low_stock(include_out_of_stock=include_out_of_stock)
        return jsonify({"status": "success", "data": {"items": items, "count": len(items)}}), 200
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching low stock items.", 500)


@inventory_bp.post("/adjustments")
@jwt_required()
@require_roles("OWNER")
def adjust_stock():
    """Performs an authorized manual stock adjustment (IN or OUT)."""
    try:
        raw_data = request.get_json() or {}
        validated = validate_adjustment_input(raw_data)

        movement = InventoryService.adjust_stock(
            product_id=validated["product_id"],
            direction=validated["direction"],
            quantity=validated["quantity"],
            actor=g.current_user,
            reason=validated["reason"],
            remarks=validated.get("remarks"),
        )
        return jsonify({
            "status": "success",
            "message": "Stock adjusted successfully.",
            "data": movement,
        }), 201
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while adjusting stock.", 500)
