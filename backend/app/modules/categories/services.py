from typing import Any, Dict, Optional
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.common.errors import AppError
from app.modules.audit.models import AuditLog
from app.modules.categories.models import Category
from app.modules.categories.repository import CategoryRepository
from app.modules.categories.schemas import category_schema, validate_category_input
from app.modules.users.models import User


class CategoryService:
    @staticmethod
    def create_category(data: Dict[str, Any], user: User) -> Dict[str, Any]:
        name, description = validate_category_input(data, is_update=False)

        # Check case-insensitive duplicate
        if CategoryRepository.get_by_name_normalized(name):
            raise AppError("CATEGORY_NAME_EXISTS", f"Category with name '{name}' already exists.", 409)

        category = Category(name=name, description=description, is_active=True)
        CategoryRepository.create(category)
        db.session.flush()

        audit = AuditLog(
            user_id=user.id,
            action="CATEGORY_CREATED",
            entity_type="Category",
            entity_id=category.id,
            description=f"Category '{category.name}' created",
        )
        db.session.add(audit)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise AppError("CATEGORY_NAME_EXISTS", f"Category with name '{name}' already exists.", 409)

        return category_schema(category)

    @staticmethod
    def update_category(category_id: int, data: Dict[str, Any], user: User) -> Dict[str, Any]:
        category = CategoryRepository.get_by_id(category_id)
        if not category:
            raise AppError("CATEGORY_NOT_FOUND", f"Category with ID {category_id} not found.", 404)

        name, description = validate_category_input(data, is_update=True)

        if "name" in data:
            existing = CategoryRepository.get_by_name_normalized(name, exclude_id=category.id)
            if existing:
                raise AppError("CATEGORY_NAME_EXISTS", f"Category with name '{name}' already exists.", 409)
            category.name = name

        if "description" in data:
            category.description = description

        audit = AuditLog(
            user_id=user.id,
            action="CATEGORY_UPDATED",
            entity_type="Category",
            entity_id=category.id,
            description=f"Category '{category.name}' updated",
        )
        db.session.add(audit)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise AppError("CATEGORY_NAME_EXISTS", f"Category with name '{category.name}' already exists.", 409)

        return category_schema(category)

    @staticmethod
    def set_category_status(category_id: int, is_active: bool, user: User) -> Dict[str, Any]:
        category = CategoryRepository.get_by_id(category_id)
        if not category:
            raise AppError("CATEGORY_NOT_FOUND", f"Category with ID {category_id} not found.", 404)

        category.is_active = bool(is_active)

        audit = AuditLog(
            user_id=user.id,
            action="CATEGORY_STATUS_CHANGED",
            entity_type="Category",
            entity_id=category.id,
            description=f"Category '{category.name}' set to {'active' if category.is_active else 'inactive'}",
        )
        db.session.add(audit)
        db.session.commit()

        return category_schema(category)

    @staticmethod
    def get_category(category_id: int) -> Dict[str, Any]:
        category = CategoryRepository.get_by_id(category_id)
        if not category:
            raise AppError("CATEGORY_NOT_FOUND", f"Category with ID {category_id} not found.", 404)
        return category_schema(category)

    @staticmethod
    def list_categories(
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Dict[str, Any]:
        page = max(1, page)
        per_page = min(100, max(1, per_page))

        items, total = CategoryRepository.list(page=page, per_page=per_page, search=search, is_active=is_active)
        pages = (total + per_page - 1) // per_page if total > 0 else 1

        return {
            "items": [category_schema(c) for c in items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages,
            },
        }
