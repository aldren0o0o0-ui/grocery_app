import re
from typing import Any, Dict, Tuple
from app.common.errors import AppError
from app.modules.users.models import User

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ALLOWED_ROLES = {"STAFF", "CASHIER", "OWNER", "ADMIN"}


def validate_create_user_input(data: Dict[str, Any]) -> Tuple[str, str, str, str, str]:
    """Validates and normalizes input data for creating a new user account."""
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    first_name = data.get("first_name")
    if not first_name or not isinstance(first_name, str) or not first_name.strip():
        raise AppError("VALIDATION_ERROR", "First name is required and cannot be empty.", 400)

    last_name = data.get("last_name")
    if not last_name or not isinstance(last_name, str) or not last_name.strip():
        raise AppError("VALIDATION_ERROR", "Last name is required and cannot be empty.", 400)

    email = data.get("email")
    if not email or not isinstance(email, str) or not email.strip():
        raise AppError("VALIDATION_ERROR", "Email is required.", 400)

    clean_email = email.strip().lower()
    if not EMAIL_REGEX.match(clean_email):
        raise AppError("VALIDATION_ERROR", "Invalid email address format.", 400)

    password = data.get("password")
    if not password or not isinstance(password, str) or not password.strip():
        raise AppError("VALIDATION_ERROR", "Password is required.", 400)
    if len(password) < 8:
        raise AppError("PASSWORD_VALIDATION_FAILED", "Password must be at least 8 characters in length.", 400)

    role = data.get("role")
    if not role or not isinstance(role, str) or not role.strip():
        raise AppError("VALIDATION_ERROR", "Role is required.", 400)

    clean_role = role.strip().upper()
    if clean_role not in ALLOWED_ROLES:
        raise AppError("VALIDATION_ERROR", f"Invalid role '{role}'. Allowed roles: OWNER, STAFF, CASHIER.", 400)
    if clean_role == "ADMIN":
        clean_role = "OWNER"

    return clean_role, first_name.strip(), last_name.strip(), clean_email, password


def user_schema(user: User) -> Dict[str, Any]:
    """Serializes a user entity into a safe dictionary, strictly excluding password_hash."""
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role.name if user.role else None,
        "is_active": user.is_active,
    }


def user_detail_schema(user: User) -> Dict[str, Any]:
    """Serializes a user entity with timestamp details."""
    data = user_schema(user)
    data["created_at"] = user.created_at.isoformat() if user.created_at else None
    data["updated_at"] = user.updated_at.isoformat() if user.updated_at else None
    return data
