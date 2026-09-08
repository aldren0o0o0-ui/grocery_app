from flask import Blueprint, g, jsonify, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required, require_roles
from app.modules.products.services import ProductService

products_bp = Blueprint("products", __name__, url_prefix="/api/products")


@products_bp.get("")
@jwt_required()
@require_roles("OWNER", "STAFF", "CASHIER")
def list_products():
    try:
        page = request.args.get("page", default=1, type=int)
        per_page = request.args.get("per_page", default=20, type=int)
        search = request.args.get("search", default=None, type=str)
        category_id = request.args.get("category_id", default=None, type=int)
        sort_by = request.args.get("sort_by", default="name", type=str)
        sort_order = request.args.get("sort_order", default="asc", type=str)

        is_active_raw = request.args.get("is_active", default=None, type=str)
        is_active = None
        if is_active_raw is not None:
            is_active = is_active_raw.lower() in ("true", "1", "yes")

        result = ProductService.list_products(
            page=page,
            per_page=per_page,
            search=search,
            category_id=category_id,
            is_active=is_active,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        return jsonify(result), 200
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching products.", 500)


@products_bp.get("/<int:product_id>")
@jwt_required()
@require_roles("OWNER", "STAFF", "CASHIER")
def get_product(product_id: int):
    try:
        product = ProductService.get_product(product_id)
        return jsonify({"product": product}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching product.", 500)


@products_bp.post("")
@jwt_required()
@require_roles("OWNER")
def create_product():
    try:
        data = request.get_json() or {}
        product = ProductService.create_product(data, g.current_user)
        return jsonify({"product": product}), 201
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while creating product.", 500)


@products_bp.patch("/<int:product_id>")
@jwt_required()
@require_roles("OWNER")
def update_product(product_id: int):
    try:
        data = request.get_json() or {}
        product = ProductService.update_product(product_id, data, g.current_user)
        return jsonify({"product": product}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating product.", 500)


@products_bp.patch("/<int:product_id>/status")
@jwt_required()
@require_roles("OWNER")
def set_product_status(product_id: int):
    try:
        data = request.get_json() or {}
        if "is_active" not in data or not isinstance(data["is_active"], bool):
            raise AppError("VALIDATION_ERROR", "Field 'is_active' (boolean) is required.", 400)

        product = ProductService.set_product_status(product_id, data["is_active"], g.current_user)
        return jsonify({"product": product}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating product status.", 500)
