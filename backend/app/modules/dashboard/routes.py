from datetime import date
from flask import Blueprint, g, jsonify, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required, require_roles
from app.modules.dashboard.services import DashboardService

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@dashboard_bp.get("/overview")
@jwt_required()
@require_roles("OWNER", "STAFF", "CASHIER")
def get_dashboard_overview():
    """Return role-aware operational dashboard and KPIs."""
    try:
        date_str = request.args.get("date", type=str)
        target_date = None
        if date_str:
            try:
                target_date = date.fromisoformat(date_str.strip())
            except ValueError:
                return api_error("VALIDATION_ERROR", "Invalid date format. Expected YYYY-MM-DD.", 400)

        overview = DashboardService.get_overview(actor=g.current_user, target_date=target_date)
        return jsonify(overview), 200
    except AppError as ae:
        return api_error(ae.code, ae.message, ae.status_code)
    except Exception as e:
        return api_error("INTERNAL_ERROR", "Failed to retrieve dashboard overview.", 500)
