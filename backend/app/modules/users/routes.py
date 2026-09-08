from flask import Blueprint, g, jsonify, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required
from app.modules.auth.schemas import validate_change_password_input
from app.modules.users.schemas import user_schema
from app.modules.users.services import UserService

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.get("/me")
@jwt_required()
def get_me():
    """Returns the authenticated user's profile."""
    current_user = g.current_user
    return jsonify({"user": user_schema(current_user)}), 200


@users_bp.patch("/me/password")
@jwt_required()
def change_password():
    """Allows authenticated user to update their password upon providing their current password."""
    try:
        data = request.get_json() or {}
        current_password, new_password = validate_change_password_input(data)

        current_user = g.current_user
        UserService.change_password(current_user, current_password, new_password)

        return jsonify({"message": "Password updated successfully."}), 200
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating password.", 500)
