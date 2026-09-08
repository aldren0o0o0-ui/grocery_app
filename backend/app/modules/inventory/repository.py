from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload, lazyload

from app.extensions import db
from app.modules.inventory.models import StockMovement
from app.modules.products.models import Product


class InventoryRepository:
    """Repository handling inventory queries, stock movement records, and row-level locking."""

    @staticmethod
    def get_product_for_update(product_id: int) -> Optional[Product]:
        """Loads a product row with a PostgreSQL row-level lock (SELECT ... FOR UPDATE)."""
        stmt = (
            select(Product)
            .options(lazyload(Product.category))
            .filter(Product.id == product_id)
            .with_for_update(of=Product)
        )
        return db.session.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_inventory_item(product_id: int) -> Optional[Product]:
        """Retrieves a product with its category eagerly loaded."""
        stmt = (
            select(Product)
            .options(joinedload(Product.category))
            .filter(Product.id == product_id)
        )
        return db.session.execute(stmt).scalar_one_or_none()

    @staticmethod
    def list_inventory(
        page: int = 1,
        per_page: int = 10,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        stock_status: str = "ALL",
    ) -> Tuple[List[Product], int, int]:
        """Queries products with inventory filters and pagination.

        Returns (items, total_count, total_pages).
        """
        stmt = select(Product).options(joinedload(Product.category))

        # Search filter
        if search:
            pattern = f"%{search.strip()}%"
            stmt = stmt.filter(
                or_(
                    Product.name.ilike(pattern),
                    Product.sku.ilike(pattern),
                    Product.barcode.ilike(pattern),
                )
            )

        # Category filter
        if category_id is not None:
            stmt = stmt.filter(Product.category_id == category_id)

        # Active status filter
        if is_active is not None:
            stmt = stmt.filter(Product.is_active == is_active)

        # Stock status filter
        status = stock_status.upper()
        if status == "OUT_OF_STOCK":
            stmt = stmt.filter(Product.stock_quantity == Decimal("0.000"))
        elif status == "LOW_STOCK":
            # Low stock definition: reorder_level > 0, stock > 0, stock <= reorder_level
            stmt = stmt.filter(
                Product.reorder_level > Decimal("0.000"),
                Product.stock_quantity > Decimal("0.000"),
                Product.stock_quantity <= Product.reorder_level,
            )
        elif status == "IN_STOCK":
            # In stock: stock > reorder_level, OR (reorder_level == 0 AND stock > 0)
            stmt = stmt.filter(
                or_(
                    Product.stock_quantity > Product.reorder_level,
                    (Product.reorder_level == Decimal("0.000")) & (Product.stock_quantity > Decimal("0.000")),
                )
            )

        # Total count query
        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.session.execute(count_stmt).scalar() or 0
        pages = (total + per_page - 1) // per_page if per_page > 0 else 1

        # Pagination & ordering
        stmt = stmt.order_by(Product.name.asc(), Product.id.asc())
        stmt = stmt.offset((page - 1) * per_page).limit(per_page)

        items = list(db.session.execute(stmt).scalars().all())
        return items, total, pages

    @staticmethod
    def list_low_stock(include_out_of_stock: bool = True) -> List[Product]:
        """Returns all products at or below their reorder level (where reorder_level > 0)."""
        stmt = (
            select(Product)
            .options(joinedload(Product.category))
            .filter(Product.reorder_level > Decimal("0.000"))
        )
        if include_out_of_stock:
            stmt = stmt.filter(Product.stock_quantity <= Product.reorder_level)
        else:
            stmt = stmt.filter(
                Product.stock_quantity > Decimal("0.000"),
                Product.stock_quantity <= Product.reorder_level,
            )

        stmt = stmt.order_by(Product.stock_quantity.asc(), Product.name.asc())
        return list(db.session.execute(stmt).scalars().all())

    @staticmethod
    def record_movement(movement: StockMovement) -> StockMovement:
        """Adds a new immutable stock movement record to the current session."""
        db.session.add(movement)
        return movement

    @staticmethod
    def list_movements(
        product_id: Optional[int] = None,
        page: int = 1,
        per_page: int = 20,
        movement_type: Optional[str] = None,
        date_from=None,
        date_to=None,
    ) -> Tuple[List[StockMovement], int, int]:
        """Queries stock movement records with optional filters, ordered newest first."""
        stmt = select(StockMovement).options(joinedload(StockMovement.creator))

        if product_id is not None:
            stmt = stmt.filter(StockMovement.product_id == product_id)

        if movement_type:
            stmt = stmt.filter(StockMovement.movement_type == movement_type.upper().strip())

        if date_from:
            stmt = stmt.filter(StockMovement.created_at >= date_from)

        if date_to:
            stmt = stmt.filter(StockMovement.created_at <= date_to)

        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.session.execute(count_stmt).scalar() or 0
        pages = (total + per_page - 1) // per_page if per_page > 0 else 1

        stmt = stmt.order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
        stmt = stmt.offset((page - 1) * per_page).limit(per_page)

        items = list(db.session.execute(stmt).scalars().all())
        return items, total, pages

    @staticmethod
    def get_latest_movement(product_id: int) -> Optional[StockMovement]:
        """Returns the most recent stock movement for consistency checking."""
        stmt = (
            select(StockMovement)
            .filter(StockMovement.product_id == product_id)
            .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
            .limit(1)
        )
        return db.session.execute(stmt).scalar_one_or_none()
