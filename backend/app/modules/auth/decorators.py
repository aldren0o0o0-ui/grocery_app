from functools import wraps
from typing import Callable, Any
from flask import g, request

from app.common.errors import AppError, api_error
from app.modules.auth.tokens import decode_token
from app.modules.users.repository import UserRepository


def jwt_required(optional: bool = False) -> Callable:
    """Decorator to enforce and extract a valid Bearer access token."""
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                if optional:
                    g.current_user = None
                    return fn(*args, **kwargs)
                return api_error("UNAUTHORIZED", "Authorization token required.", 401)

            token = auth_header.split(" ", 1)[1].strip()
            try:
                payload = decode_token(token, expected_type="access")
            except AppError as e:
                return api_error(e.code, e.message, e.status_code)

            user_id = int(payload["sub"])
            user = UserRepository.get_by_id(user_id)
            if not user or not user.is_active:
                return api_error("UNAUTHORIZED", "User account is invalid or inactive.", 401)

            g.current_user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_roles(*roles: str) -> Callable:
    """Decorator to enforce that the authenticated user possesses one of the allowed roles."""
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            current_user = getattr(g, "current_user", None)
            if not current_user:
                return api_error("UNAUTHORIZED", "Authentication required.", 401)

            user_role = current_user.role.name if current_user.role else None
            if user_role not in roles:
                return api_error("FORBIDDEN", "You do not have permission to access this resource.", 403)

            return fn(*args, **kwargs)
        return wrapper
    return decorator
