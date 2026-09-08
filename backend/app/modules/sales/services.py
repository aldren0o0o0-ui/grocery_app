from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from app.common.errors import AppError
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.services import InventoryService
from app.modules.sales.models import Payment, Sale, SaleItem, SaleStatus
from app.modules.sales.repository import SalesRepository
from app.modules.sales.schemas import validate_checkout_input
from app.modules.users.models import User


class SalesService:
    """Authoritative domain service governing POS sales, server calculations, and atomic checkout."""

    @classmethod
    def generate_invoice_number(cls, sale_date: date) -> str:
        """Generates sequential concurrency-safe invoice number SAL-YYYYMMDD-XXXX."""
        date_str = sale_date.strftime("%Y%m%d")
        count = SalesRepository.count_today_sales(sale_date) + 1
        seq = count
        while True:
            ref = f"SAL-{date_str}-{seq:04d}"
            if not SalesRepository.get_by_invoice_number(ref):
                return ref
            seq += 1

    @classmethod
    def get_sale(cls, sale_id: int) -> Sale:
        sale = SalesRepository.get_by_id(sale_id)
        if not sale:
            raise AppError("SALE_NOT_FOUND", f"Sale with ID {sale_id} not found.", 404)
        return sale

    @classmethod
    def list_sales(
        cls,
        cashier_id: Optional[int] = None,
        status: Optional[str] = None,
        payment_method: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Sale], int]:
        return SalesRepository.list_sales(
            cashier_id=cashier_id,
            status=status,
            payment_method=payment_method,
            date_from=date_from,
            date_to=date_to,
            search=search,
            page=page,
            per_page=per_page,
        )

    @classmethod
    def checkout(cls, data: Dict[str, Any], cashier: User) -> Sale:
        """Executes atomic POS checkout transaction with server-authoritative pricing and inventory deduction.

        Transaction sequence:
        1. Validate request and normalize cart (merging duplicate product lines).
        2. Sort unique product IDs ascending and acquire PostgreSQL row locks (SELECT ... FOR UPDATE).
        3. Validate all products are active and verify sufficient stock.
        4. Snapshot product selling_price and cost_price at checkout instant.
        5. Calculate line subtotals, sale subtotal, validate discount, compute total.
        6. Validate payment against total based on method rules (CASH, GCASH, CARD).
        7. Generate unique invoice number SAL-YYYYMMDD-XXXX.
        8. Create Sale record, flush to obtain sale.id.
        9. Create SaleItem records.
        10. Deduct stock for each item via InventoryService.deduct_stock(..., commit=False).
        11. Create Payment record.
        12. Record AuditLog entry.
        13. Commit transaction atomically (or rollback completely on any failure).
        """
        # Step 1: Validate payload and normalize cart
        normalized_items, discount, payment_info = validate_checkout_input(data)

        # Step 2: Deterministic row locking: sort product IDs ascending to prevent deadlocks
        sorted_pids = sorted([itm["product_id"] for itm in normalized_items])

        try:
            locked_products = {}
            for pid in sorted_pids:
                prod = InventoryRepository.get_product_for_update(pid)
                if not prod:
                    raise AppError("PRODUCT_NOT_FOUND", f"Product with ID {pid} not found.", 404)
                if not prod.is_active:
                    raise AppError("PRODUCT_INACTIVE", f"Product '{prod.name}' (SKU: {prod.sku}) is inactive.", 400)
                locked_products[pid] = prod

            # Step 3: Stock availability check and line subtotal calculation
            line_items_data = []
            subtotal = Decimal("0.00")

            for itm in normalized_items:
                pid = itm["product_id"]
                qty = itm["quantity"]
                prod = locked_products[pid]

                if prod.stock_quantity < qty:
                    raise AppError(
                        "INSUFFICIENT_STOCK",
                        f"Insufficient stock for product '{prod.name}' (SKU: {prod.sku}). "
                        f"Available: {prod.stock_quantity:.3f}, requested: {qty:.3f}.",
                        400,
                    )

                # Server-authoritative price snapshot
                unit_price = prod.selling_price
                cost_price = prod.cost_price
                line_subtotal = (qty * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

                subtotal += line_subtotal
                line_items_data.append({
                    "product": prod,
                    "quantity": qty,
                    "unit_price": unit_price,
                    "cost_price": cost_price,
                    "subtotal": line_subtotal,
                })

            # Step 4: Validate discount and calculate total
            if discount > subtotal:
                raise AppError(
                    "INVALID_DISCOUNT",
                    f"Discount ({discount:.2f}) cannot exceed subtotal ({subtotal:.2f}).",
                    400,
                )

            total = subtotal - discount

            # Step 5: Validate payment
            method = payment_info["method"]
            amount_paid = payment_info["amount_paid"]

            if method == "CASH":
                if amount_paid < total:
                    raise AppError(
                        "INSUFFICIENT_PAYMENT",
                        f"Insufficient cash payment. Total is {total:.2f}, but received {amount_paid:.2f}.",
                        400,
                    )
                change_amount = amount_paid - total
            else:  # GCASH or CARD
                if amount_paid != total:
                    raise AppError(
                        "PAYMENT_AMOUNT_MISMATCH",
                        f"Electronic payment ({method}) must exactly equal the total amount of {total:.2f}. "
                        f"Received {amount_paid:.2f}.",
                        400,
                    )
                change_amount = Decimal("0.00")

            # Step 6: Create Sale
            invoice_num = cls.generate_invoice_number(date.today())
            sale = Sale(
                invoice_number=invoice_num,
                cashier_id=cashier.id,
                subtotal=subtotal,
                discount=discount,
                total=total,
                status=SaleStatus.COMPLETED.value,
            )
            db.session.add(sale)
            db.session.flush()

            # Step 7: Create SaleItems and deduct stock through InventoryService
            for line in line_items_data:
                sale_item = SaleItem(
                    sale_id=sale.id,
                    product_id=line["product"].id,
                    quantity=line["quantity"],
                    unit_price=line["unit_price"],
                    cost_price=line["cost_price"],
                    subtotal=line["subtotal"],
                )
                db.session.add(sale_item)

                # Authoritative inventory deduction
                InventoryService.deduct_stock(
                    product_id=line["product"].id,
                    quantity=line["quantity"],
                    movement_type="SALE",
                    actor=cashier,
                    reference_type="SALE",
                    reference_id=sale.id,
                    remarks=f"POS Sale {invoice_num}",
                    audit_action="SALE_STOCK_DEDUCTED",
                    commit=False,
                )

            # Step 8: Create Payment
            payment = Payment(
                sale_id=sale.id,
                payment_method=method,
                amount_paid=amount_paid,
                change_amount=change_amount,
            )
            db.session.add(payment)

            # Step 9: Audit Log
            audit = AuditLog(
                user_id=cashier.id,
                action="SALE_COMPLETED",
                entity_type="Sale",
                entity_id=sale.id,
                description=(
                    f"Sale {invoice_num} completed by {cashier.email}. "
                    f"Items: {len(line_items_data)}, Subtotal: {subtotal:.2f}, "
                    f"Discount: {discount:.2f}, Total: {total:.2f}, "
                    f"Payment: {method} ({amount_paid:.2f}, Change: {change_amount:.2f})."
                ),
            )
            db.session.add(audit)

            # Step 10: Commit atomic transaction
            db.session.commit()

            # Return freshly loaded Sale with all relations
            return cls.get_sale(sale.id)

        except Exception:
            db.session.rollback()
            raise
