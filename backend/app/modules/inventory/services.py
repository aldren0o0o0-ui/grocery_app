from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from app.common.errors import AppError
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.inventory.models import StockMovement, StockMovementType
from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.schemas import (
    inventory_item_schema,
    parse_quantity_decimal,
    stock_movement_schema,
    validate_adjustment_input,
)
from app.modules.users.models import User


class InventoryService:
    """Sole authoritative service governing all inventory mutations and stock balance logic.

    Architectural Invariant:
    Product.stock_quantity MUST NEVER be directly mutated outside this service.
    All stock increases or decreases are executed within atomic database transactions
    protected by PostgreSQL row-level locks (SELECT ... FOR UPDATE) and paired with
    immutable StockMovement audit ledger records.
    """

    @staticmethod
    def get_product_stock(product_id: int) -> Dict[str, Any]:
        """Retrieves stock information for a specific product."""
        product = InventoryRepository.get_inventory_item(product_id)
        if not product:
            raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {product_id} not found.", 404)
        return inventory_item_schema(product)

    @staticmethod
    def list_inventory(
        page: int = 1,
        per_page: int = 10,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        stock_status: str = "ALL",
    ) -> Dict[str, Any]:
        """Retrieves paginated product stock balances with filters."""
        items, total, pages = InventoryRepository.list_inventory(
            page=page,
            per_page=per_page,
            search=search,
            category_id=category_id,
            is_active=is_active,
            stock_status=stock_status,
        )
        return {
            "items": [inventory_item_schema(p) for p in items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages,
            },
        }

    @staticmethod
    def list_low_stock(include_out_of_stock: bool = True) -> List[Dict[str, Any]]:
        """Returns products needing reorder (reorder_level > 0 and stock <= reorder_level)."""
        products = InventoryRepository.list_low_stock(include_out_of_stock=include_out_of_stock)
        return [inventory_item_schema(p) for p in products]

    @staticmethod
    def list_movements(
        product_id: Optional[int] = None,
        page: int = 1,
        per_page: int = 20,
        movement_type: Optional[str] = None,
        date_from=None,
        date_to=None,
    ) -> Dict[str, Any]:
        """Returns paginated immutable movement ledger records."""
        if product_id is not None:
            # Verify product exists
            product = InventoryRepository.get_inventory_item(product_id)
            if not product:
                raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {product_id} not found.", 404)

        items, total, pages = InventoryRepository.list_movements(
            product_id=product_id,
            page=page,
            per_page=per_page,
            movement_type=movement_type,
            date_from=date_from,
            date_to=date_to,
        )
        return {
            "items": [stock_movement_schema(m) for m in items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages,
            },
        }

    @classmethod
    def add_stock(
        cls,
        product_id: int,
        quantity: Union[Decimal, str, int, float],
        movement_type: str,
        actor: User,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        remarks: Optional[str] = None,
        audit_action: Optional[str] = None,
    ) -> StockMovement:
        """Atomically increments product stock with PostgreSQL row-level lock.

        Reusable across:
        - Manual adjustments (ADJUSTMENT_IN)
        - Future Purchasing receipts (PURCHASE)
        - Customer returns (RETURN)
        """
        qty = parse_quantity_decimal(quantity, "quantity")

        try:
            # Lock product row
            product = InventoryRepository.get_product_for_update(product_id)
            if not product:
                raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {product_id} not found.", 404)

            quantity_before = product.stock_quantity
            quantity_after = quantity_before + qty

            # Update authoritative balance
            product.stock_quantity = quantity_after

            # Create immutable ledger record
            movement = StockMovement(
                product_id=product.id,
                movement_type=movement_type,
                quantity=qty,
                quantity_before=quantity_before,
                quantity_after=quantity_after,
                reference_type=reference_type,
                reference_id=reference_id,
                remarks=remarks,
                created_by=actor.id,
            )
            InventoryRepository.record_movement(movement)

            # Record audit log
            action_name = audit_action or f"INVENTORY_{movement_type}"
            audit = AuditLog(
                user_id=actor.id,
                action=action_name,
                entity_type="Product",
                entity_id=product.id,
                description=(
                    f"Stock increased by {qty:.3f} {product.unit} on '{product.name}' (SKU: {product.sku}). "
                    f"Balance: {quantity_before:.3f} -> {quantity_after:.3f}."
                ),
            )
            db.session.add(audit)

            db.session.commit()
            return movement

        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def deduct_stock(
        cls,
        product_id: int,
        quantity: Union[Decimal, str, int, float],
        movement_type: str,
        actor: User,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        remarks: Optional[str] = None,
        audit_action: Optional[str] = None,
    ) -> StockMovement:
        """Atomically decrements product stock with PostgreSQL row-level lock.

        Reusable across:
        - Manual adjustments (ADJUSTMENT_OUT, DAMAGED, EXPIRED)
        - Future POS / Sales checkout (SALE)
        - Supplier returns
        """
        qty = parse_quantity_decimal(quantity, "quantity")

        try:
            # Lock product row
            product = InventoryRepository.get_product_for_update(product_id)
            if not product:
                raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {product_id} not found.", 404)

            quantity_before = product.stock_quantity
            if quantity_before < qty:
                raise AppError(
                    "INSUFFICIENT_STOCK",
                    f"Insufficient stock for product '{product.name}' (SKU: {product.sku}). "
                    f"Available: {quantity_before:.3f}, requested deduction: {qty:.3f}.",
                    400,
                )

            quantity_after = quantity_before - qty

            # Update authoritative balance
            product.stock_quantity = quantity_after

            # Create immutable ledger record
            movement = StockMovement(
                product_id=product.id,
                movement_type=movement_type,
                quantity=qty,
                quantity_before=quantity_before,
                quantity_after=quantity_after,
                reference_type=reference_type,
                reference_id=reference_id,
                remarks=remarks,
                created_by=actor.id,
            )
            InventoryRepository.record_movement(movement)

            # Record audit log
            action_name = audit_action or f"INVENTORY_{movement_type}"
            audit = AuditLog(
                user_id=actor.id,
                action=action_name,
                entity_type="Product",
                entity_id=product.id,
                description=(
                    f"Stock decreased by {qty:.3f} {product.unit} on '{product.name}' (SKU: {product.sku}). "
                    f"Balance: {quantity_before:.3f} -> {quantity_after:.3f}."
                ),
            )
            db.session.add(audit)

            db.session.commit()
            return movement

        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def adjust_stock(
        cls,
        product_id: int,
        direction: str,
        quantity: Union[Decimal, str, int, float],
        actor: User,
        reason: str,
        remarks: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Performs a manual stock adjustment initiated by OWNER or ADMIN."""
        dir_clean = direction.strip().upper()
        reason_clean = reason.strip().upper()

        annotated_remarks = f"[{reason_clean}] {remarks}" if remarks else f"[{reason_clean}]"

        if dir_clean == "IN":
            movement_type = StockMovementType.ADJUSTMENT_IN.value
            audit_action = "INVENTORY_ADJUSTED_IN"
            movement = cls.add_stock(
                product_id=product_id,
                quantity=quantity,
                movement_type=movement_type,
                actor=actor,
                reference_type="MANUAL_ADJUSTMENT",
                reference_id=None,
                remarks=annotated_remarks,
                audit_action=audit_action,
            )
        elif dir_clean == "OUT":
            if reason_clean == "DAMAGED":
                movement_type = StockMovementType.DAMAGED.value
                audit_action = "INVENTORY_MARKED_DAMAGED"
            elif reason_clean == "EXPIRED":
                movement_type = StockMovementType.EXPIRED.value
                audit_action = "INVENTORY_MARKED_EXPIRED"
            else:
                movement_type = StockMovementType.ADJUSTMENT_OUT.value
                audit_action = "INVENTORY_ADJUSTED_OUT"

            movement = cls.deduct_stock(
                product_id=product_id,
                quantity=quantity,
                movement_type=movement_type,
                actor=actor,
                reference_type="MANUAL_ADJUSTMENT",
                reference_id=None,
                remarks=annotated_remarks,
                audit_action=audit_action,
            )
        else:
            raise AppError("INVALID_ADJUSTMENT_DIRECTION", "Direction must be 'IN' or 'OUT'.", 400)

        return stock_movement_schema(movement)

    @classmethod
    def restore_stock(
        cls,
        product_id: int,
        quantity: Union[Decimal, str, int, float],
        actor: User,
        reference_type: str,
        reference_id: int,
        remarks: Optional[str] = None,
    ) -> StockMovement:
        """Reusable helper restoring previously deducted stock (e.g. cancelled sale or return)."""
        return cls.add_stock(
            product_id=product_id,
            quantity=quantity,
            movement_type=StockMovementType.RETURN.value,
            actor=actor,
            reference_type=reference_type,
            reference_id=reference_id,
            remarks=remarks,
            audit_action="INVENTORY_RESTORED",
        )

    @staticmethod
    def verify_inventory_consistency(product_id: int) -> Dict[str, Any]:
        """Development & test diagnostic checking Product.stock_quantity against the ledger."""
        product = InventoryRepository.get_inventory_item(product_id)
        if not product:
            raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {product_id} not found.", 404)

        latest_movement = InventoryRepository.get_latest_movement(product_id)
        if latest_movement is None:
            consistent = product.stock_quantity == Decimal("0.000")
            expected_balance = Decimal("0.000")
        else:
            consistent = product.stock_quantity == latest_movement.quantity_after
            expected_balance = latest_movement.quantity_after

        return {
            "product_id": product.id,
            "sku": product.sku,
            "product_stock": f"{product.stock_quantity:.3f}",
            "ledger_latest_after": f"{expected_balance:.3f}",
            "is_consistent": consistent,
        }
