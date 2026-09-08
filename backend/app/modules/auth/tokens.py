import uuid
from datetime import datetime, timezone
from typing import Any, Dict
import jwt
from flask import current_app

from app.common.errors import AppError
from app.modules.users.models import User


def get_jwt_secret() -> str:
    return current_app.config.get("JWT_SECRET_KEY") or current_app.config.get("SECRET_KEY", "default-secret")


def generate_access_token(user: User) -> str:
    """Generates a short-lived access JWT containing identity and role claims."""
    now = datetime.now(timezone.utc)
    expires = current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES")
    payload: Dict[str, Any] = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.name if user.role else None,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + expires).timestamp()),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm="HS256")


def generate_refresh_token(user: User) -> str:
    """Generates a longer-lived refresh JWT with a unique jti for cookie storage."""
    now = datetime.now(timezone.utc)
    expires = current_app.config.get("JWT_REFRESH_TOKEN_EXPIRES")
    payload: Dict[str, Any] = {
        "sub": str(user.id),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + expires).timestamp()),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm="HS256")


def decode_token(token: str, expected_type: str) -> Dict[str, Any]:
    """Decodes and validates JWT claims, expiration, and expected token type."""
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise AppError("INVALID_TOKEN", "Token has expired.", 401)
    except jwt.InvalidTokenError:
        raise AppError("INVALID_TOKEN", "Token is invalid.", 401)

    if payload.get("type") != expected_type:
        raise AppError("INVALID_TOKEN", f"Token type mismatch. Expected '{expected_type}'.", 401)

    return payload
