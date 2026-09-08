from typing import Any, Dict
from app.modules.users.models import User


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
