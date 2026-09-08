from flask import Blueprint, g, jsonify, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required, require_roles
from app.modules.suppliers.services import SupplierService

suppliers_bp = Blueprint("suppliers", __name__, url_prefix="/api/suppliers")


@suppliers_bp.get("")
@jwt_required()
@require_roles("OWNER", "ADMIN", "STAFF")
def list_suppliers():
    """Lists suppliers with search, active status filter, and pagination."""
    try:
        page = request.args.get("page", default=1, type=int)
        per_page = request.args.get("per_page", default=20, type=int)
        search = request.args.get("search", default=None, type=str)

        is_active_raw = request.args.get("is_active", default=None, type=str)
        is_active = None
        if is_active_raw is not None:
            is_active = is_active_raw.lower() in ("true", "1", "yes")

        result = SupplierService.list_suppliers(
            page=page,
            per_page=per_page,
            search=search,
            is_active=is_active,
        )
        return jsonify({"status": "success", "data": result}), 200
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching suppliers.", 500)


@suppliers_bp.get("/<int:supplier_id>")
@jwt_required()
@require_roles("OWNER", "ADMIN", "STAFF")
def get_supplier(supplier_id: int):
    """Retrieves a single supplier by ID."""
    try:
        supplier = SupplierService.get_supplier(supplier_id)
        return jsonify({"status": "success", "data": supplier}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching supplier.", 500)


@suppliers_bp.post("")
@jwt_required()
@require_roles("OWNER", "ADMIN")
def create_supplier():
    """Creates a new supplier."""
    try:
        data = request.get_json() or {}
        supplier = SupplierService.create_supplier(data, g.current_user)
        return jsonify({
            "status": "success",
            "message": "Supplier created successfully.",
            "data": supplier,
        }), 201
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while creating supplier.", 500)


@suppliers_bp.patch("/<int:supplier_id>")
@jwt_required()
@require_roles("OWNER", "ADMIN")
def update_supplier(supplier_id: int):
    """Updates supplier attributes."""
    try:
        data = request.get_json() or {}
        supplier = SupplierService.update_supplier(supplier_id, data, g.current_user)
        return jsonify({
            "status": "success",
            "message": "Supplier updated successfully.",
            "data": supplier,
        }), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating supplier.", 500)


@suppliers_bp.patch("/<int:supplier_id>/status")
@jwt_required()
@require_roles("OWNER", "ADMIN")
def set_supplier_status(supplier_id: int):
    """Activates or deactivates a supplier without deletion."""
    try:
        data = request.get_json() or {}
        if "is_active" not in data or not isinstance(data["is_active"], bool):
            return api_error("VALIDATION_ERROR", "Field 'is_active' must be a boolean.", 400)

        supplier = SupplierService.set_supplier_status(supplier_id, data["is_active"], g.current_user)
        return jsonify({
            "status": "success",
            "message": "Supplier status updated successfully.",
            "data": supplier,
        }), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating supplier status.", 500)
