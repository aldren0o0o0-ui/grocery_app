from typing import List, Optional, Tuple
from sqlalchemy import func, select
from app.extensions import db
from app.modules.categories.models import Category


class CategoryRepository:
    @staticmethod
    def get_by_id(category_id: int) -> Optional[Category]:
        return db.session.execute(
            select(Category).filter_by(id=category_id)
        ).scalar_one_or_none()

    @staticmethod
    def get_by_name_normalized(name: str, exclude_id: Optional[int] = None) -> Optional[Category]:
        query = select(Category).filter(func.lower(Category.name) == func.lower(name.strip()))
        if exclude_id is not None:
            query = query.filter(Category.id != exclude_id)
        return db.session.execute(query).scalar_one_or_none()

    @staticmethod
    def list(
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[Category], int]:
        query = select(Category)
        count_query = select(func.count(Category.id))

        if is_active is not None:
            query = query.filter(Category.is_active == is_active)
            count_query = count_query.filter(Category.is_active == is_active)

        if search:
            search_term = f"%{search.strip()}%"
            filter_cond = Category.name.ilike(search_term) | Category.description.ilike(search_term)
            query = query.filter(filter_cond)
            count_query = count_query.filter(filter_cond)

        total = db.session.execute(count_query).scalar_one()

        offset = (page - 1) * per_page
        query = query.order_by(Category.name.asc()).offset(offset).limit(per_page)
        items = list(db.session.execute(query).scalars().all())

        return items, total

    @staticmethod
    def create(category: Category) -> Category:
        db.session.add(category)
        return category
