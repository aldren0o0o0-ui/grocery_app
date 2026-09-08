from typing import Any, Dict, Optional, Tuple
from app.common.errors import AppError
from app.modules.categories.models import Category


def validate_category_input(data: Dict[str, Any], is_update: bool = False) -> Tuple[str, Optional[str]]:
    """Validates category creation/update payload."""
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    if not is_update or "name" in data:
        name = data.get("name")
        if not name or not isinstance(name, str) or not name.strip():
            raise AppError("VALIDATION_ERROR", "Category name is required and cannot be empty.", 400)
        name = name.strip()
    else:
        name = ""

    description = data.get("description")
    if description is not None and not isinstance(description, str):
        raise AppError("VALIDATION_ERROR", "Description must be a string.", 400)

    if isinstance(description, str):
        description = description.strip() or None

    return name, description


def category_schema(category: Category) -> Dict[str, Any]:
    """Serializes a Category instance to a dictionary."""
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "is_active": category.is_active,
        "created_at": category.created_at.isoformat() if category.created_at else None,
        "updated_at": category.updated_at.isoformat() if category.updated_at else None,
    }
