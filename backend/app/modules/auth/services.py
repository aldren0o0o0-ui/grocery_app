from typing import Any, Dict, Optional, Tuple
from werkzeug.security import check_password_hash

from app.extensions import db
from app.common.errors import AppError
from app.modules.audit.models import AuditLog
from app.modules.auth.tokens import decode_token, generate_access_token, generate_refresh_token
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import user_schema


class AuthService:
    @staticmethod
    def login(email: str, password: str) -> Tuple[Dict[str, Any], str, str]:
        """Authenticates user credentials, writes audit log, and issues access & refresh tokens."""
        user = UserRepository.get_by_email(email)

        # Generic authentication failure message prevents account enumeration
        if not user or not check_password_hash(user.password_hash, password):
            raise AppError("INVALID_CREDENTIALS", "Invalid email or password.", 401)

        if not user.is_active:
            raise AppError("INACTIVE_USER", "This account is inactive. Please contact an administrator.", 403)

        access_token = generate_access_token(user)
        refresh_token = generate_refresh_token(user)

        audit = AuditLog(
            user_id=user.id,
            action="LOGIN_SUCCESS",
            entity_type="User",
            entity_id=user.id,
            description="User logged in successfully",
        )
        db.session.add(audit)
        db.session.commit()

        return user_schema(user), access_token, refresh_token

    @staticmethod
    def refresh(refresh_token_str: Optional[str]) -> Tuple[Dict[str, Any], str, str]:
        """Validates HttpOnly refresh cookie, verifies active user, and returns new rotated tokens."""
        if not refresh_token_str:
            raise AppError("INVALID_TOKEN", "Refresh token cookie is missing.", 401)

        payload = decode_token(refresh_token_str, expected_type="refresh")
        user_id = int(payload["sub"])

        user = UserRepository.get_by_id(user_id)
        if not user or not user.is_active:
            raise AppError("UNAUTHORIZED", "User account is invalid or inactive.", 401)

        new_access_token = generate_access_token(user)
        new_refresh_token = generate_refresh_token(user)

        return user_schema(user), new_access_token, new_refresh_token

    @staticmethod
    def logout(user: Optional[User]) -> None:
        """Records user logout event if authenticated."""
        if user:
            audit = AuditLog(
                user_id=user.id,
                action="LOGOUT",
                entity_type="User",
                entity_id=user.id,
                description="User logged out",
            )
            db.session.add(audit)
            db.session.commit()
