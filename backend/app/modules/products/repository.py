from typing import List, Optional, Tuple
from sqlalchemy import func, select
from app.extensions import db
from app.modules.products.models import Product

SORTABLE_COLUMNS = {
    "name": Product.name,
    "sku": Product.sku,
    "selling_price": Product.selling_price,
    "created_at": Product.created_at,
}


class ProductRepository:
    @staticmethod
    def get_by_id(product_id: int) -> Optional[Product]:
        return db.session.execute(
            select(Product).filter_by(id=product_id)
        ).scalar_one_or_none()

    @staticmethod
    def get_by_sku(sku: str, exclude_id: Optional[int] = None) -> Optional[Product]:
        query = select(Product).filter(func.upper(Product.sku) == func.upper(sku.strip()))
        if exclude_id is not None:
            query = query.filter(Product.id != exclude_id)
        return db.session.execute(query).scalar_one_or_none()

    @staticmethod
    def get_by_barcode(barcode: str, exclude_id: Optional[int] = None) -> Optional[Product]:
        query = select(Product).filter(Product.barcode == barcode.strip())
        if exclude_id is not None:
            query = query.filter(Product.id != exclude_id)
        return db.session.execute(query).scalar_one_or_none()

    @staticmethod
    def list(
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
    ) -> Tuple[List[Product], int]:
        query = select(Product)
        count_query = select(func.count(Product.id))

        if category_id is not None:
            query = query.filter(Product.category_id == category_id)
            count_query = count_query.filter(Product.category_id == category_id)

        if is_active is not None:
            query = query.filter(Product.is_active == is_active)
            count_query = count_query.filter(Product.is_active == is_active)

        if search:
            search_term = f"%{search.strip()}%"
            search_filter = (
                Product.name.ilike(search_term)
                | Product.sku.ilike(search_term)
                | Product.barcode.ilike(search_term)
            )
            query = query.filter(search_filter)
            count_query = count_query.filter(search_filter)

        total = db.session.execute(count_query).scalar_one()

        # Sorting using whitelisted column expressions
        sort_col = SORTABLE_COLUMNS.get(sort_by.lower(), Product.name)
        if sort_order.lower() == "desc":
            query = query.order_by(sort_col.desc(), Product.id.desc())
        else:
            query = query.order_by(sort_col.asc(), Product.id.asc())

        offset = (page - 1) * per_page
        query = query.offset(offset).limit(per_page)
        items = list(db.session.execute(query).scalars().all())

        return items, total

    @staticmethod
    def create(product: Product) -> Product:
        db.session.add(product)
        return product
