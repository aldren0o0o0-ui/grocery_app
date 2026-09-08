from typing import Any, Dict, Tuple
from app.common.errors import AppError


def validate_login_input(data: Dict[str, Any]) -> Tuple[str, str]:
    """Validates login payload structure."""
    if not data or not isinstance(data, dict):
        raise AppError("INVALID_INPUT", "Request body must be a valid JSON object.", 400)

    email = data.get("email")
    password = data.get("password")

    if not email or not isinstance(email, str) or not email.strip():
        raise AppError("INVALID_INPUT", "Email is required.", 400)

    if not password or not isinstance(password, str):
        raise AppError("INVALID_INPUT", "Password is required.", 400)

    return email.strip(), password


def validate_change_password_input(data: Dict[str, Any]) -> Tuple[str, str]:
    """Validates password update payload structure."""
    if not data or not isinstance(data, dict):
        raise AppError("INVALID_INPUT", "Request body must be a valid JSON object.", 400)

    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not current_password or not isinstance(current_password, str):
        raise AppError("INVALID_INPUT", "Current password is required.", 400)

    if not new_password or not isinstance(new_password, str):
        raise AppError("INVALID_INPUT", "New password is required.", 400)

    return current_password, new_password
