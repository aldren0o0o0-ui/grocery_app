from flask import Blueprint, g, jsonify, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required, require_roles
from app.modules.purchasing.schemas import (
    purchase_item_schema,
    purchase_schema,
    validate_add_item_input,
    validate_create_purchase_input,
    validate_purchase_date,
    validate_update_item_input,
)
from app.modules.purchasing.services import PurchaseService

purchasing_bp = Blueprint("purchasing", __name__, url_prefix="/api/purchases")


@purchasing_bp.get("")
@jwt_required()
@require_roles("OWNER", "STAFF")
def list_purchases():
    """Lists purchases with filters, search, and pagination."""
    try:
        status = request.args.get("status")
        supplier_id_raw = request.args.get("supplier_id")
        supplier_id = None
        if supplier_id_raw:
            try:
                supplier_id = int(supplier_id_raw)
            except (ValueError, TypeError):
                raise AppError("VALIDATION_ERROR", "supplier_id must be an integer.", 400)

        start_date_raw = request.args.get("start_date")
        start_date = validate_purchase_date(start_date_raw) if start_date_raw else None

        end_date_raw = request.args.get("end_date")
        end_date = validate_purchase_date(end_date_raw) if end_date_raw else None

        search = request.args.get("search")

        try:
            page = max(1, int(request.args.get("page", 1)))
            per_page = min(100, max(1, int(request.args.get("per_page", 20))))
        except (ValueError, TypeError):
            page = 1
            per_page = 20

        items, total = PurchaseService.list_purchases(
            status=status,
            supplier_id=supplier_id,
            start_date=start_date,
            end_date=end_date,
            search=search,
            page=page,
            per_page=per_page,
        )

        pages = (total + per_page - 1) // per_page if per_page > 0 else 1

        return (
            jsonify({
                "status": "success",
                "data": {
                    "items": [purchase_schema(p, include_items=False) for p in items],
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": total,
                        "pages": pages,
                    },
                },
            }),
            200,
        )
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching purchases.", 500)


@purchasing_bp.get("/<int:purchase_id>")
@jwt_required()
@require_roles("OWNER", "STAFF")
def get_purchase(purchase_id: int):
    """Retrieves full purchase details including line items."""
    try:
        purchase = PurchaseService.get_purchase(purchase_id)
        return jsonify({"status": "success", "data": purchase_schema(purchase, include_items=True)}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching purchase.", 500)


@purchasing_bp.post("")
@jwt_required()
@require_roles("OWNER", "STAFF")
def create_purchase():
    """Creates a new purchase in DRAFT status."""
    try:
        data = request.get_json(silent=True)
        if data is None:
            raise AppError("VALIDATION_ERROR", "Request body must be valid JSON.", 400)

        supplier_id, p_date, ref, items_data = validate_create_purchase_input(data)
        purchase = PurchaseService.create_purchase(
            supplier_id=supplier_id,
            purchase_date=p_date,
            reference_number=ref,
            items_data=items_data,
            creator=g.current_user,
        )
        return jsonify({"status": "success", "data": purchase_schema(purchase, include_items=True)}), 201
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while creating purchase.", 500)


@purchasing_bp.post("/<int:purchase_id>/items")
@jwt_required()
@require_roles("OWNER", "STAFF")
def add_line_item(purchase_id: int):
    """Adds a single line item to a DRAFT purchase."""
    try:
        data = request.get_json(silent=True)
        if data is None:
            raise AppError("VALIDATION_ERROR", "Request body must be valid JSON.", 400)

        product_id, qty, unit_cost = validate_add_item_input(data)
        item = PurchaseService.add_line_item(
            purchase_id=purchase_id,
            product_id=product_id,
            quantity=qty,
            unit_cost=unit_cost,
            actor=g.current_user,
        )
        return jsonify({"status": "success", "data": purchase_item_schema(item)}), 201
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while adding purchase item.", 500)


@purchasing_bp.patch("/<int:purchase_id>/items/<int:item_id>")
@jwt_required()
@require_roles("OWNER", "STAFF")
def update_line_item(purchase_id: int, item_id: int):
    """Updates quantity or unit cost of a line item in a DRAFT purchase."""
    try:
        data = request.get_json(silent=True)
        if data is None:
            raise AppError("VALIDATION_ERROR", "Request body must be valid JSON.", 400)

        qty, unit_cost = validate_update_item_input(data)
        item = PurchaseService.update_line_item(
            purchase_id=purchase_id,
            item_id=item_id,
            quantity=qty,
            unit_cost=unit_cost,
            actor=g.current_user,
        )
        return jsonify({"status": "success", "data": purchase_item_schema(item)}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating purchase item.", 500)


@purchasing_bp.delete("/<int:purchase_id>/items/<int:item_id>")
@jwt_required()
@require_roles("OWNER", "STAFF")
def remove_line_item(purchase_id: int, item_id: int):
    """Removes a line item from a DRAFT purchase."""
    try:
        PurchaseService.remove_line_item(purchase_id=purchase_id, item_id=item_id, actor=g.current_user)
        return jsonify({"status": "success", "message": "Item removed successfully."}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while removing purchase item.", 500)


@purchasing_bp.post("/<int:purchase_id>/receive")
@jwt_required()
@require_roles("OWNER", "STAFF")
def receive_purchase(purchase_id: int):
    """Atomically receives a purchase, updating stock and cost price."""
    try:
        purchase = PurchaseService.receive_purchase(purchase_id=purchase_id, actor=g.current_user)
        return jsonify({"status": "success", "data": purchase_schema(purchase, include_items=True)}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while receiving purchase.", 500)


@purchasing_bp.post("/<int:purchase_id>/cancel")
@jwt_required()
@require_roles("OWNER", "STAFF")
def cancel_purchase(purchase_id: int):
    """Cancels a DRAFT purchase."""
    try:
        purchase = PurchaseService.cancel_purchase(purchase_id=purchase_id, actor=g.current_user)
        return jsonify({"status": "success", "data": purchase_schema(purchase, include_items=True)}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while cancelling purchase.", 500)


@purchasing_bp.delete("/<int:purchase_id>")
@jwt_required()
@require_roles("OWNER")
def delete_purchase(purchase_id: int):
    """Deletes a DRAFT purchase (OWNER only)."""
    try:
        PurchaseService.delete_purchase(purchase_id=purchase_id, actor=g.current_user)
        return jsonify({"status": "success", "message": "Purchase deleted successfully."}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while deleting purchase.", 500)
