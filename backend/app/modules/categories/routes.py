from flask import Blueprint, g, jsonify, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required, require_roles
from app.modules.categories.services import CategoryService

categories_bp = Blueprint("categories", __name__, url_prefix="/api/categories")


@categories_bp.get("")
@jwt_required()
@require_roles("OWNER", "STAFF", "CASHIER")
def list_categories():
    try:
        page = request.args.get("page", default=1, type=int)
        per_page = request.args.get("per_page", default=20, type=int)
        search = request.args.get("search", default=None, type=str)
        is_active_raw = request.args.get("is_active", default=None, type=str)

        is_active = None
        if is_active_raw is not None:
            is_active = is_active_raw.lower() in ("true", "1", "yes")

        result = CategoryService.list_categories(page=page, per_page=per_page, search=search, is_active=is_active)
        return jsonify(result), 200
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching categories.", 500)


@categories_bp.get("/<int:category_id>")
@jwt_required()
@require_roles("OWNER", "STAFF", "CASHIER")
def get_category(category_id: int):
    try:
        category = CategoryService.get_category(category_id)
        return jsonify({"category": category}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching category.", 500)


@categories_bp.post("")
@jwt_required()
@require_roles("OWNER")
def create_category():
    try:
        data = request.get_json() or {}
        category = CategoryService.create_category(data, g.current_user)
        return jsonify({"category": category}), 201
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while creating category.", 500)


@categories_bp.patch("/<int:category_id>")
@jwt_required()
@require_roles("OWNER")
def update_category(category_id: int):
    try:
        data = request.get_json() or {}
        category = CategoryService.update_category(category_id, data, g.current_user)
        return jsonify({"category": category}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating category.", 500)


@categories_bp.patch("/<int:category_id>/status")
@jwt_required()
@require_roles("OWNER")
def set_category_status(category_id: int):
    try:
        data = request.get_json() or {}
        if "is_active" not in data or not isinstance(data["is_active"], bool):
            raise AppError("VALIDATION_ERROR", "Field 'is_active' (boolean) is required.", 400)

        category = CategoryService.set_category_status(category_id, data["is_active"], g.current_user)
        return jsonify({"category": category}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating category status.", 500)
