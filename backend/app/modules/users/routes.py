from flask import Blueprint, g, jsonify, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required, require_roles
from app.modules.auth.schemas import validate_change_password_input
from app.modules.users.schemas import (
    user_detail_schema,
    user_schema,
    validate_create_user_input,
)
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


@users_bp.get("")
@jwt_required()
@require_roles("OWNER")
def list_users():
    """Lists team users with optional role, status, and search filters (Owner only)."""
    try:
        role = request.args.get("role")
        is_active_arg = request.args.get("is_active")
        search = request.args.get("search")

        is_active = None
        if is_active_arg is not None:
            val = is_active_arg.strip().lower()
            if val in ("true", "1"):
                is_active = True
            elif val in ("false", "0"):
                is_active = False

        users = UserService.list_users(role_name=role, is_active=is_active, search=search)
        return jsonify({"users": [user_detail_schema(u) for u in users]}), 200
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while retrieving users.", 500)


@users_bp.post("")
@jwt_required()
@require_roles("OWNER")
def create_user():
    """Provisions a new user account (Staff, Cashier, or Owner) by an authorized Owner."""
    try:
        data = request.get_json() or {}
        role, first_name, last_name, email, password = validate_create_user_input(data)

        actor = g.current_user
        new_user = UserService.create_user(
            role_name=role,
            first_name=first_name,
            last_name=last_name,
            email=email,
            password=password,
            actor=actor,
        )

        return (
            jsonify(
                {
                    "message": f"{new_user.role.name} account created successfully.",
                    "user": user_detail_schema(new_user),
                }
            ),
            201,
        )
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while creating user.", 500)


@users_bp.patch("/<int:user_id>/status")
@jwt_required()
@require_roles("OWNER")
def toggle_user_status(user_id: int):
    """Activates or deactivates a user account (prevents self-deactivation)."""
    try:
        data = request.get_json() or {}
        if "is_active" not in data or not isinstance(data["is_active"], bool):
            return api_error("VALIDATION_ERROR", "Field 'is_active' (boolean) is required.", 400)

        is_active = data["is_active"]
        actor = g.current_user

        updated_user = UserService.set_user_status(user_id=user_id, is_active=is_active, actor=actor)
        return (
            jsonify(
                {
                    "message": f"User status successfully updated to {'Active' if is_active else 'Inactive'}.",
                    "user": user_detail_schema(updated_user),
                }
            ),
            200,
        )
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while updating user status.", 500)
