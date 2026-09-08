from datetime import date
from flask import Blueprint, g, jsonify, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required, require_roles
from app.modules.returns.schemas import (
    sale_return_schema,
    sale_return_summary_schema,
)
from app.modules.returns.services import ReturnService

returns_bp = Blueprint("returns", __name__, url_prefix="/api/returns")


def parse_query_date(val: str, field_name: str) -> date:
    try:
        return date.fromisoformat(val.strip())
    except (ValueError, AttributeError):
        raise AppError("VALIDATION_ERROR", f"Invalid date format for '{field_name}'. Expected YYYY-MM-DD.", 400)


@returns_bp.post("")
@jwt_required()
@require_roles("OWNER", "CASHIER")
def create_return():
    """Processes a sales return, records refund, and restores inventory."""
    try:
        data = request.get_json() or {}
        sale_return = ReturnService.create_return(data, g.current_user)
        is_owner = (g.current_user.role.name == "OWNER")
        return jsonify({"return": sale_return_schema(sale_return, is_owner=is_owner)}), 201
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while processing the return.", 500)


@returns_bp.get("")
@jwt_required()
@require_roles("OWNER", "CASHIER")
def list_returns():
    """Returns paginated return history with role-based scoping."""
    try:
        page = request.args.get("page", default=1, type=int)
        per_page = request.args.get("per_page", default=20, type=int)
        search = request.args.get("search", default=None, type=str)
        refund_method = request.args.get("refund_method", default=None, type=str)

        date_from_raw = request.args.get("date_from", default=None, type=str)
        date_to_raw = request.args.get("date_to", default=None, type=str)

        date_from = parse_query_date(date_from_raw, "date_from") if date_from_raw else None
        date_to = parse_query_date(date_to_raw, "date_to") if date_to_raw else None

        # CASHIER can view own processed returns only; OWNER can view all or filter by processed_by
        is_owner = (g.current_user.role.name == "OWNER")
        if not is_owner:
            processed_by = g.current_user.id
        else:
            processed_by = request.args.get("processed_by", default=None, type=int)

        returns, total = ReturnService.list_returns(
            processed_by=processed_by,
            refund_method=refund_method,
            date_from=date_from,
            date_to=date_to,
            search=search,
            page=page,
            per_page=per_page,
        )

        pages = (total + per_page - 1) // per_page if per_page > 0 else 1
        return jsonify({
            "returns": [sale_return_summary_schema(r) for r in returns],
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
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching returns.", 500)


@returns_bp.get("/<int:return_id>")
@jwt_required()
@require_roles("OWNER", "CASHIER")
def get_return_detail(return_id: int):
    """Retrieves full return receipt breakdown with role-based cost price exposure."""
    try:
        sale_return = ReturnService.get_return(return_id)

        # CASHIER may only access own processed returns
        is_owner = (g.current_user.role.name == "OWNER")
        if not is_owner and sale_return.processed_by != g.current_user.id:
            return api_error("FORBIDDEN", "You are not authorized to view returns processed by other users.", 403)

        return jsonify({"return": sale_return_schema(sale_return, is_owner=is_owner)}), 200

    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching return details.", 500)
