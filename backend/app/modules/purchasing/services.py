from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from app.common.errors import AppError
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.inventory.services import InventoryService
from app.modules.products.models import Product
from app.modules.purchasing.models import Purchase, PurchaseItem, PurchaseStatus
from app.modules.purchasing.repository import PurchaseRepository
from app.modules.suppliers.models import Supplier
from app.modules.users.models import User


class PurchaseService:
    """Authoritative domain service for Purchasing workflows."""

    @classmethod
    def generate_reference_number(cls, p_date: date) -> str:
        """Generates sequential reference number PUR-YYYYMMDD-XXXX."""
        date_str = p_date.strftime("%Y%m%d")
        count = PurchaseRepository.count_today_purchases(p_date) + 1
        seq = count
        while True:
            ref = f"PUR-{date_str}-{seq:04d}"
            if not PurchaseRepository.get_by_reference_number(ref):
                return ref
            seq += 1

    @classmethod
    def list_purchases(
        cls,
        status: Optional[str] = None,
        supplier_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Purchase], int]:
        return PurchaseRepository.list_purchases(
            status=status,
            supplier_id=supplier_id,
            start_date=start_date,
            end_date=end_date,
            search=search,
            page=page,
            per_page=per_page,
        )

    @classmethod
    def get_purchase(cls, purchase_id: int) -> Purchase:
        purchase = PurchaseRepository.get_by_id(purchase_id, with_items=True)
        if not purchase:
            raise AppError("PURCHASE_NOT_FOUND", f"Purchase with ID {purchase_id} not found.", 404)
        return purchase

    @classmethod
    def create_purchase(
        cls,
        supplier_id: int,
        purchase_date: date,
        reference_number: Optional[str],
        items_data: List[Dict[str, Any]],
        creator: User,
    ) -> Purchase:
        # Validate supplier
        supplier = db.session.get(Supplier, supplier_id)
        if not supplier:
            raise AppError("SUPPLIER_NOT_FOUND", f"Supplier with ID {supplier_id} not found.", 404)
        if not supplier.is_active:
            raise AppError("SUPPLIER_INACTIVE", f"Supplier '{supplier.name}' is inactive.", 400)

        # Validate / generate reference number
        if reference_number:
            existing = PurchaseRepository.get_by_reference_number(reference_number)
            if existing:
                raise AppError("PURCHASE_REF_EXISTS", f"Purchase reference '{reference_number}' already exists.", 409)
            final_ref = reference_number
        else:
            final_ref = cls.generate_reference_number(purchase_date)

        purchase = Purchase(
            supplier_id=supplier.id,
            reference_number=final_ref,
            purchase_date=purchase_date,
            status=PurchaseStatus.DRAFT.value,
            total_amount=Decimal("0.00"),
            created_by=creator.id,
        )

        total_amount = Decimal("0.00")
        try:
            PurchaseRepository.save(purchase, commit=False)

            for itm in items_data:
                product = db.session.get(Product, itm["product_id"])
                if not product:
                    raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {itm['product_id']} not found.", 404)
                if not product.is_active:
                    raise AppError("PRODUCT_INACTIVE", f"Product '{product.name}' is inactive.", 400)

                qty: Decimal = itm["quantity"]
                cost: Decimal = itm["unit_cost"]
                subtotal = (qty * cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

                line_item = PurchaseItem(
                    purchase_id=purchase.id,
                    product_id=product.id,
                    quantity=qty,
                    unit_cost=cost,
                    subtotal=subtotal,
                )
                db.session.add(line_item)
                total_amount += subtotal

            purchase.total_amount = total_amount

            # Audit log
            audit = AuditLog(
                user_id=creator.id,
                action="PURCHASE_CREATED",
                entity_type="Purchase",
                entity_id=purchase.id,
                description=f"Purchase {purchase.reference_number} created with {len(items_data)} items.",
            )
            db.session.add(audit)
            db.session.commit()
            return purchase

        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def add_line_item(
        cls,
        purchase_id: int,
        product_id: int,
        quantity: Decimal,
        unit_cost: Decimal,
        actor: User,
    ) -> PurchaseItem:
        purchase = PurchaseRepository.get_for_update(purchase_id)
        if not purchase:
            raise AppError("PURCHASE_NOT_FOUND", f"Purchase with ID {purchase_id} not found.", 404)

        if purchase.status != PurchaseStatus.DRAFT.value:
            raise AppError("PURCHASE_NOT_EDITABLE", f"Cannot add items to purchase with status '{purchase.status}'.", 400)

        product = db.session.get(Product, product_id)
        if not product:
            raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {product_id} not found.", 404)
        if not product.is_active:
            raise AppError("PRODUCT_INACTIVE", f"Product '{product.name}' is inactive.", 400)

        existing_item = PurchaseRepository.get_item_by_product(purchase.id, product.id)
        if existing_item:
            raise AppError("DUPLICATE_PRODUCT_IN_PURCHASE", f"Product '{product.name}' is already in this purchase.", 409)

        subtotal = (quantity * unit_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        item = PurchaseItem(
            purchase_id=purchase.id,
            product_id=product.id,
            quantity=quantity,
            unit_cost=unit_cost,
            subtotal=subtotal,
        )

        try:
            PurchaseRepository.add_item(item, commit=False)
            # Recompute total amount
            all_items = [it for it in purchase.items if it.id != item.id] + [item]
            purchase.total_amount = sum((it.subtotal for it in all_items), Decimal("0.00"))

            audit = AuditLog(
                user_id=actor.id,
                action="PURCHASE_ITEM_ADDED",
                entity_type="Purchase",
                entity_id=purchase.id,
                description=f"Added item '{product.name}' (Qty: {quantity:.3f}, Cost: {unit_cost:.2f}) to purchase {purchase.reference_number}.",
            )
            db.session.add(audit)
            db.session.commit()
            return item
        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def update_line_item(
        cls,
        purchase_id: int,
        item_id: int,
        quantity: Optional[Decimal],
        unit_cost: Optional[Decimal],
        actor: User,
    ) -> PurchaseItem:
        purchase = PurchaseRepository.get_for_update(purchase_id)
        if not purchase:
            raise AppError("PURCHASE_NOT_FOUND", f"Purchase with ID {purchase_id} not found.", 404)

        if purchase.status != PurchaseStatus.DRAFT.value:
            raise AppError("PURCHASE_NOT_EDITABLE", f"Cannot modify items for purchase with status '{purchase.status}'.", 400)

        item = PurchaseRepository.get_item(purchase.id, item_id)
        if not item:
            raise AppError("PURCHASE_ITEM_NOT_FOUND", f"Purchase item with ID {item_id} not found.", 404)

        if quantity is not None:
            item.quantity = quantity
        if unit_cost is not None:
            item.unit_cost = unit_cost

        item.subtotal = (item.quantity * item.unit_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        try:
            # Recompute total amount
            purchase.total_amount = sum((it.subtotal for it in purchase.items), Decimal("0.00"))
            audit = AuditLog(
                user_id=actor.id,
                action="PURCHASE_ITEM_UPDATED",
                entity_type="Purchase",
                entity_id=purchase.id,
                description=f"Updated item ID {item.id} on purchase {purchase.reference_number}.",
            )
            db.session.add(audit)
            db.session.commit()
            return item
        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def remove_line_item(cls, purchase_id: int, item_id: int, actor: User) -> None:
        purchase = PurchaseRepository.get_for_update(purchase_id)
        if not purchase:
            raise AppError("PURCHASE_NOT_FOUND", f"Purchase with ID {purchase_id} not found.", 404)

        if purchase.status != PurchaseStatus.DRAFT.value:
            raise AppError("PURCHASE_NOT_EDITABLE", f"Cannot remove items from purchase with status '{purchase.status}'.", 400)

        item = PurchaseRepository.get_item(purchase.id, item_id)
        if not item:
            raise AppError("PURCHASE_ITEM_NOT_FOUND", f"Purchase item with ID {item_id} not found.", 404)

        try:
            PurchaseRepository.remove_item(item, commit=False)
            remaining_items = [it for it in purchase.items if it.id != item.id]
            purchase.total_amount = sum((it.subtotal for it in remaining_items), Decimal("0.00"))

            audit = AuditLog(
                user_id=actor.id,
                action="PURCHASE_ITEM_REMOVED",
                entity_type="Purchase",
                entity_id=purchase.id,
                description=f"Removed item ID {item_id} from purchase {purchase.reference_number}.",
            )
            db.session.add(audit)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def receive_purchase(cls, purchase_id: int, actor: User) -> Purchase:
        """Atomically receives purchase, increments stock, updates cost price, and finalizes status."""
        try:
            # Lock purchase row to serialize state transitions and prevent double-receive
            purchase = PurchaseRepository.get_for_update(purchase_id)
            if not purchase:
                raise AppError("PURCHASE_NOT_FOUND", f"Purchase with ID {purchase_id} not found.", 404)

            if purchase.status == PurchaseStatus.RECEIVED.value:
                raise AppError("PURCHASE_ALREADY_RECEIVED", "Purchase has already been received.", 400)
            if purchase.status == PurchaseStatus.CANCELLED.value:
                raise AppError("PURCHASE_CANCELLED", "Cannot receive a cancelled purchase.", 400)
            if purchase.status != PurchaseStatus.DRAFT.value:
                raise AppError("INVALID_PURCHASE_STATUS", f"Cannot receive purchase in status '{purchase.status}'.", 400)

            if not purchase.items or len(purchase.items) == 0:
                raise AppError("EMPTY_PURCHASE", "Cannot receive a purchase with no line items.", 400)

            # Process all line items through authoritative InventoryService
            for item in purchase.items:
                InventoryService.add_stock(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    movement_type="PURCHASE",
                    actor=actor,
                    reference_type="PURCHASE",
                    reference_id=purchase.id,
                    remarks=f"Received via Purchase {purchase.reference_number}",
                    audit_action="PURCHASE_STOCK_ADDED",
                    commit=False,
                )

                # Cost Price Policy: Latest received unit cost updates product cost price
                item.product.cost_price = item.unit_cost

            # Recalculate total amount from line items
            purchase.total_amount = sum((it.subtotal for it in purchase.items), Decimal("0.00"))
            purchase.status = PurchaseStatus.RECEIVED.value

            audit = AuditLog(
                user_id=actor.id,
                action="PURCHASE_RECEIVED",
                entity_type="Purchase",
                entity_id=purchase.id,
                description=(
                    f"Purchase {purchase.reference_number} received by {actor.email}. "
                    f"{len(purchase.items)} items received, total amount: {purchase.total_amount:.2f}."
                ),
            )
            db.session.add(audit)
            db.session.commit()
            return purchase

        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def cancel_purchase(cls, purchase_id: int, actor: User) -> Purchase:
        """Transitions a DRAFT purchase to CANCELLED."""
        try:
            purchase = PurchaseRepository.get_for_update(purchase_id)
            if not purchase:
                raise AppError("PURCHASE_NOT_FOUND", f"Purchase with ID {purchase_id} not found.", 404)

            if purchase.status == PurchaseStatus.CANCELLED.value:
                raise AppError("PURCHASE_ALREADY_CANCELLED", "Purchase is already cancelled.", 400)
            if purchase.status == PurchaseStatus.RECEIVED.value:
                raise AppError("PURCHASE_ALREADY_RECEIVED", "Cannot cancel a received purchase.", 400)
            if purchase.status != PurchaseStatus.DRAFT.value:
                raise AppError("INVALID_PURCHASE_STATUS", f"Cannot cancel purchase in status '{purchase.status}'.", 400)

            purchase.status = PurchaseStatus.CANCELLED.value

            audit = AuditLog(
                user_id=actor.id,
                action="PURCHASE_CANCELLED",
                entity_type="Purchase",
                entity_id=purchase.id,
                description=f"Purchase {purchase.reference_number} cancelled by {actor.email}.",
            )
            db.session.add(audit)
            db.session.commit()
            return purchase

        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def delete_purchase(cls, purchase_id: int, actor: User) -> None:
        """Deletes a DRAFT purchase and its items."""
        purchase = PurchaseRepository.get_for_update(purchase_id)
        if not purchase:
            raise AppError("PURCHASE_NOT_FOUND", f"Purchase with ID {purchase_id} not found.", 404)

        if purchase.status != PurchaseStatus.DRAFT.value:
            raise AppError("PURCHASE_NOT_DELETABLE", f"Cannot delete purchase with status '{purchase.status}'. Only DRAFT purchases can be deleted.", 400)

        try:
            for item in list(purchase.items):
                db.session.delete(item)
            PurchaseRepository.delete(purchase, commit=False)

            audit = AuditLog(
                user_id=actor.id,
                action="PURCHASE_DELETED",
                entity_type="Purchase",
                entity_id=purchase_id,
                description=f"Purchase {purchase.reference_number} deleted by {actor.email}.",
            )
            db.session.add(audit)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
