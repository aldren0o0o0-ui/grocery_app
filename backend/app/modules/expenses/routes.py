from datetime import date
from flask import Blueprint, g, jsonify, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required, require_roles
from app.modules.expenses.schemas import (
    expense_category_schema,
    expense_schema,
    expense_summary_schema,
)
from app.modules.expenses.services import ExpenseCategoryService, ExpenseService

expense_categories_bp = Blueprint("expense_categories", __name__, url_prefix="/api/expense-categories")
expenses_bp = Blueprint("expenses", __name__, url_prefix="/api/expenses")


def parse_query_date(val: str, field_name: str) -> date:
    try:
        return date.fromisoformat(val.strip())
    except (ValueError, AttributeError):
        raise AppError("VALIDATION_ERROR", f"Invalid date format for '{field_name}'. Expected YYYY-MM-DD.", 400)


# ==============================================================================
# EXPENSE CATEGORIES ENDPOINTS
# ==============================================================================

@expense_categories_bp.get("")
@jwt_required()
@require_roles("OWNER", "STAFF")
def list_expense_categories():
    try:
        search = request.args.get("search", default=None, type=str)
        is_active_raw = request.args.get("is_active", default=None, type=str)

        is_active = None
        if is_active_raw is not None:
            is_active = is_active_raw.strip().lower() in ("true", "1", "yes")

        categories = ExpenseCategoryService.list_categories(is_active=is_active, search=search)
        return jsonify({"categories": [expense_category_schema(c) for c in categories]}), 200
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while listing expense categories.", 500)


@expense_categories_bp.get("/<int:category_id>")
@jwt_required()
@require_roles("OWNER", "STAFF")
def get_expense_category(category_id: int):
    try:
        category = ExpenseCategoryService.get_category(category_id)
        return jsonify({"category": expense_category_schema(category)}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while retrieving expense category.", 500)


@expense_categories_bp.post("")
@jwt_required()
@require_roles("OWNER")
def create_expense_category():
    try:
        data = request.get_json() or {}
        category = ExpenseCategoryService.create_category(data, g.current_user)
        return jsonify({"category": expense_category_schema(category)}), 201
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while creating expense category.", 500)


@expense_categories_bp.patch("/<int:category_id>")
@jwt_required()
@require_roles("OWNER")
def update_expense_category(category_id: int):
    try:
        data = request.get_json() or {}
        category = ExpenseCategoryService.update_category(category_id, data, g.current_user)
        return jsonify({"category": expense_category_schema(category)}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating expense category.", 500)


@expense_categories_bp.patch("/<int:category_id>/status")
@jwt_required()
@require_roles("OWNER")
def set_expense_category_status(category_id: int):
    try:
        data = request.get_json() or {}
        if "is_active" not in data or not isinstance(data["is_active"], bool):
            raise AppError("VALIDATION_ERROR", "Field 'is_active' (boolean) is required.", 400)

        category = ExpenseCategoryService.set_status(category_id, data["is_active"], g.current_user)
        return jsonify({"category": expense_category_schema(category)}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while changing category status.", 500)


# ==============================================================================
# EXPENSES ENDPOINTS
# ==============================================================================

@expenses_bp.get("")
@jwt_required()
@require_roles("OWNER", "STAFF")
def list_expenses():
    try:
        page = request.args.get("page", default=1, type=int)
        per_page = request.args.get("per_page", default=20, type=int)
        search = request.args.get("search", default=None, type=str)
        category_id = request.args.get("category_id", default=None, type=int)
        created_by = request.args.get("created_by", default=None, type=int)

        date_from_raw = request.args.get("date_from", default=None, type=str)
        date_to_raw = request.args.get("date_to", default=None, type=str)

        date_from = parse_query_date(date_from_raw, "date_from") if date_from_raw else None
        date_to = parse_query_date(date_to_raw, "date_to") if date_to_raw else None

        expenses, total = ExpenseService.list_expenses(
            category_id=category_id,
            date_from=date_from,
            date_to=date_to,
            created_by=created_by,
            search=search,
            page=page,
            per_page=per_page,
        )

        pages = (total + per_page - 1) // per_page if per_page > 0 else 1
        return jsonify({
            "expenses": [expense_summary_schema(e) for e in expenses],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages,
            },
        }), 200

    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while listing expenses.", 500)


@expenses_bp.get("/<int:expense_id>")
@jwt_required()
@require_roles("OWNER", "STAFF")
def get_expense(expense_id: int):
    try:
        expense = ExpenseService.get_expense(expense_id)
        return jsonify({"expense": expense_schema(expense)}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while retrieving expense.", 500)


@expenses_bp.post("")
@jwt_required()
@require_roles("OWNER", "STAFF")
def create_expense():
    try:
        data = request.get_json() or {}
        expense = ExpenseService.create_expense(data, g.current_user)
        return jsonify({"expense": expense_schema(expense)}), 201
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while recording expense.", 500)


@expenses_bp.patch("/<int:expense_id>")
@jwt_required()
@require_roles("OWNER")
def update_expense(expense_id: int):
    try:
        data = request.get_json() or {}
        expense = ExpenseService.update_expense(expense_id, data, g.current_user)
        return jsonify({"expense": expense_schema(expense)}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating expense.", 500)
