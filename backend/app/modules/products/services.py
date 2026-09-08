from decimal import Decimal
from typing import Any, Dict, Optional
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.common.errors import AppError
from app.modules.audit.models import AuditLog
from app.modules.categories.repository import CategoryRepository
from app.modules.products.models import Product
from app.modules.products.repository import ProductRepository
from app.modules.products.schemas import product_schema, validate_product_input
from app.modules.users.models import User


class ProductService:
    @staticmethod
    def _validate_category(category_id: int) -> None:
        category = CategoryRepository.get_by_id(category_id)
        if not category:
            raise AppError("CATEGORY_NOT_FOUND", f"Category with ID {category_id} does not exist.", 404)
        if not category.is_active:
            raise AppError("CATEGORY_INACTIVE", f"Cannot assign product to inactive category '{category.name}'.", 400)

    @staticmethod
    def create_product(data: Dict[str, Any], user: User) -> Dict[str, Any]:
        clean_data = validate_product_input(data, is_update=False)

        # 1. Validate destination category
        ProductService._validate_category(clean_data["category_id"])

        # 2. Check SKU uniqueness
        if ProductRepository.get_by_sku(clean_data["sku"]):
            raise AppError("PRODUCT_SKU_EXISTS", f"Product with SKU '{clean_data['sku']}' already exists.", 409)

        # 3. Check Barcode uniqueness (if provided)
        if clean_data.get("barcode"):
            if ProductRepository.get_by_barcode(clean_data["barcode"]):
                raise AppError("PRODUCT_BARCODE_EXISTS", f"Product with barcode '{clean_data['barcode']}' already exists.", 409)

        product = Product(
            category_id=clean_data["category_id"],
            name=clean_data["name"],
            sku=clean_data["sku"],
            barcode=clean_data.get("barcode"),
            description=clean_data.get("description"),
            unit=clean_data.get("unit", "pcs"),
            cost_price=clean_data.get("cost_price", Decimal("0.00")),
            selling_price=clean_data.get("selling_price", Decimal("0.00")),
            stock_quantity=Decimal("0.000"),  # Initial authoritative stock defaults to zero
            reorder_level=clean_data.get("reorder_level", Decimal("0.000")),
            is_active=True,
        )
        ProductRepository.create(product)
        db.session.flush()

        audit = AuditLog(
            user_id=user.id,
            action="PRODUCT_CREATED",
            entity_type="Product",
            entity_id=product.id,
            description=f"Product '{product.name}' (SKU: {product.sku}) created",
        )
        db.session.add(audit)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise AppError("PRODUCT_DUPLICATE", "Product SKU or barcode conflict occurred.", 409)

        return product_schema(product)

    @staticmethod
    def update_product(product_id: int, data: Dict[str, Any], user: User) -> Dict[str, Any]:
        product = ProductRepository.get_by_id(product_id)
        if not product:
            raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {product_id} not found.", 404)

        clean_data = validate_product_input(data, is_update=True)

        # Category change
        if "category_id" in clean_data and clean_data["category_id"] != product.category_id:
            ProductService._validate_category(clean_data["category_id"])
            product.category_id = clean_data["category_id"]

        # SKU change
        if "sku" in clean_data and clean_data["sku"] != product.sku:
            if ProductRepository.get_by_sku(clean_data["sku"], exclude_id=product.id):
                raise AppError("PRODUCT_SKU_EXISTS", f"Product with SKU '{clean_data['sku']}' already exists.", 409)
            product.sku = clean_data["sku"]

        # Barcode change
        if "barcode" in clean_data and clean_data["barcode"] != product.barcode:
            if clean_data["barcode"] and ProductRepository.get_by_barcode(clean_data["barcode"], exclude_id=product.id):
                raise AppError("PRODUCT_BARCODE_EXISTS", f"Product with barcode '{clean_data['barcode']}' already exists.", 409)
            product.barcode = clean_data["barcode"]

        # Track price modifications for audit
        old_selling = product.selling_price
        old_cost = product.cost_price

        if "name" in clean_data:
            product.name = clean_data["name"]
        if "description" in clean_data:
            product.description = clean_data["description"]
        if "unit" in clean_data:
            product.unit = clean_data["unit"]
        if "cost_price" in clean_data:
            product.cost_price = clean_data["cost_price"]
        if "selling_price" in clean_data:
            product.selling_price = clean_data["selling_price"]
        if "reorder_level" in clean_data:
            product.reorder_level = clean_data["reorder_level"]

        audit_msg = f"Product '{product.name}' updated."
        if product.selling_price != old_selling or product.cost_price != old_cost:
            audit_msg += f" Price changed: cost ({old_cost:.2f} -> {product.cost_price:.2f}), selling ({old_selling:.2f} -> {product.selling_price:.2f})"

        audit = AuditLog(
            user_id=user.id,
            action="PRODUCT_UPDATED",
            entity_type="Product",
            entity_id=product.id,
            description=audit_msg,
        )
        db.session.add(audit)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise AppError("PRODUCT_DUPLICATE", "Product SKU or barcode conflict occurred.", 409)

        return product_schema(product)

    @staticmethod
    def set_product_status(product_id: int, is_active: bool, user: User) -> Dict[str, Any]:
        product = ProductRepository.get_by_id(product_id)
        if not product:
            raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {product_id} not found.", 404)

        product.is_active = bool(is_active)

        audit = AuditLog(
            user_id=user.id,
            action="PRODUCT_STATUS_CHANGED",
            entity_type="Product",
            entity_id=product.id,
            description=f"Product '{product.name}' (SKU: {product.sku}) set to {'active' if product.is_active else 'inactive'}",
        )
        db.session.add(audit)
        db.session.commit()

        return product_schema(product)

    @staticmethod
    def get_product(product_id: int) -> Dict[str, Any]:
        product = ProductRepository.get_by_id(product_id)
        if not product:
            raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {product_id} not found.", 404)
        return product_schema(product)

    @staticmethod
    def list_products(
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
    ) -> Dict[str, Any]:
        page = max(1, page)
        per_page = min(100, max(1, per_page))

        items, total = ProductRepository.list(
            page=page,
            per_page=per_page,
            search=search,
            category_id=category_id,
            is_active=is_active,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        pages = (total + per_page - 1) // per_page if total > 0 else 1

        return {
            "items": [product_schema(p) for p in items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages,
            },
        }
