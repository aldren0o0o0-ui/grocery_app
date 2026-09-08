from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from app.common.errors import AppError
from app.common.sequences import SequenceService
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.services import InventoryService
from app.modules.returns.models import SaleReturn, SaleReturnItem
from app.modules.returns.repository import ReturnRepository
from app.modules.returns.schemas import validate_return_input
from app.modules.sales.models import Sale, SaleItem, SaleStatus
from app.modules.users.models import User


class ReturnService:
    """Authoritative domain service governing sales returns, refund calculation, and inventory restoration."""

    @classmethod
    def get_return(cls, return_id: int) -> SaleReturn:
        ret = ReturnRepository.get_by_id(return_id)
        if not ret:
            raise AppError("RETURN_NOT_FOUND", f"Return with ID {return_id} not found.", 404)
        return ret

    @classmethod
    def list_returns(
        cls,
        processed_by: Optional[int] = None,
        refund_method: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[SaleReturn], int]:
        return ReturnRepository.list_returns(
            processed_by=processed_by,
            refund_method=refund_method,
            date_from=date_from,
            date_to=date_to,
            search=search,
            page=page,
            per_page=per_page,
        )

    @classmethod
    def create_return(cls, data: Dict[str, Any], actor: User) -> SaleReturn:
        """Atomically processes a sales return, records refund, and restores inventory.

        Transaction sequence:
        1. Validate request payload and normalize items.
        2. Acquire PostgreSQL row lock on target Sale (SELECT ... FOR UPDATE).
        3. Enforce RBAC: CASHIER can only return own processed sales; OWNER can return any.
        4. Validate Sale status (must be COMPLETED).
        5. Verify returnable quantities (requested_qty <= sold_qty - already_returned_qty).
        6. Acquire PostgreSQL row locks on affected products in ascending sorted order.
        7. Calculate prorated refund allocating original transaction discounts.
        8. Atomically generate sequential return number RET-YYYYMMDD-XXXX via SequenceService.
        9. Insert SaleReturn and flush.
        10. Insert SaleReturnItem rows.
        11. Restore stock via InventoryService.restore_stock(..., commit=False).
        12. Update Sale.status to RETURNED if all sold quantities are now 100% returned.
        13. Insert AuditLog(action="SALE_RETURN_COMPLETED").
        14. Commit transaction atomically (or rollback on any failure).
        """
        # Step 1: Validate payload and normalize duplicate lines
        sale_id, reason, refund_method, normalized_items = validate_return_input(data)

        try:
            # Step 2: Lock target Sale row
            sale = ReturnRepository.get_sale_for_update(sale_id)
            if not sale:
                raise AppError("SALE_NOT_FOUND", f"Sale with ID {sale_id} not found.", 404)

            # Step 3: RBAC verification
            if actor.role.name == "CASHIER" and sale.cashier_id != actor.id:
                raise AppError("FORBIDDEN", "Cashiers may only process returns for their own sales.", 403)

            # Step 4: Status verification
            if sale.status != SaleStatus.COMPLETED.value:
                raise AppError(
                    "SALE_NOT_RETURNABLE",
                    f"Cannot process return for sale with status '{sale.status}'.",
                    400,
                )

            # Step 5: Check returnable quantities
            sale_items_by_id = {item.id: item for item in sale.items}
            returned_quantities = ReturnRepository.get_sale_returned_quantities(sale.id)

            # Check if all items in the sale will become fully returned after this request
            requested_qty_map: Dict[int, Decimal] = {}
            for itm in normalized_items:
                sid = itm["sale_item_id"]
                req_qty = itm["quantity"]

                if sid not in sale_items_by_id:
                    raise AppError(
                        "SALE_ITEM_NOT_FOUND",
                        f"Sale item {sid} does not belong to sale {sale.invoice_number}.",
                        400,
                    )

                sale_item = sale_items_by_id[sid]
                already_returned = returned_quantities.get(sid, Decimal("0.000"))
                returnable = sale_item.quantity - already_returned

                if req_qty > returnable:
                    raise AppError(
                        "RETURN_QUANTITY_EXCEEDED",
                        f"Requested return quantity ({req_qty:.3f}) exceeds remaining returnable quantity "
                        f"({returnable:.3f}) for item '{sale_item.product.name}'.",
                        400,
                    )

                requested_qty_map[sid] = req_qty

            # Determine if this return completes 100% of the entire original sale
            is_full_return = True
            for it in sale.items:
                prev_ret = returned_quantities.get(it.id, Decimal("0.000"))
                new_ret = requested_qty_map.get(it.id, Decimal("0.000"))
                if (prev_ret + new_ret) < it.quantity:
                    is_full_return = False
                    break

            # Step 6: Acquire locks on affected products in deterministic ascending order
            affected_product_ids = sorted(list({sale_items_by_id[sid].product_id for sid in requested_qty_map}))
            for pid in affected_product_ids:
                InventoryRepository.get_product_for_update(pid)

            # Step 7: Prorated discount calculation for refund amounts
            sale_subtotal = sale.subtotal
            sale_discount = sale.discount
            sale_total = sale.total
            already_refunded = sum((r.refund_amount for r in sale.returns), Decimal("0.00"))

            line_items_data = []
            total_calculated_refund = Decimal("0.00")

            for itm in normalized_items:
                sid = itm["sale_item_id"]
                req_qty = itm["quantity"]
                sale_item = sale_items_by_id[sid]

                if sale_discount > Decimal("0.00") and sale_subtotal > Decimal("0.00"):
                    # Item gross ratio within original sale
                    ratio = sale_item.subtotal / sale_subtotal
                    item_discount_share = sale_discount * ratio
                    net_item_subtotal = sale_item.subtotal - item_discount_share
                    line_refund = (req_qty / sale_item.quantity * net_item_subtotal).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )
                else:
                    line_refund = (req_qty * sale_item.unit_price).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )

                total_calculated_refund += line_refund
                line_items_data.append({
                    "sale_item": sale_item,
                    "product_id": sale_item.product_id,
                    "quantity": req_qty,
                    "unit_price": sale_item.unit_price,
                    "refund_subtotal": line_refund,
                })

            # Full return exact reconciliation: ensure cumulative refunds equal sale.total exactly
            if is_full_return:
                final_refund_amount = sale_total - already_refunded
                diff = final_refund_amount - total_calculated_refund
                if diff != Decimal("0.00") and line_items_data:
                    # Adjust rounding difference on the last line item
                    line_items_data[-1]["refund_subtotal"] += diff
                total_refund = final_refund_amount
            else:
                total_refund = total_calculated_refund
                # Safety cap: cannot exceed remaining amount paid on the sale
                max_allowable = sale_total - already_refunded
                if total_refund > max_allowable:
                    diff = total_refund - max_allowable
                    total_refund = max_allowable
                    if line_items_data:
                        line_items_data[-1]["refund_subtotal"] -= diff

            # Step 8: Generate sequential concurrency-safe return number
            return_number = SequenceService.next_reference("RET", date.today())

            # Step 9: Create SaleReturn record
            sale_return = SaleReturn(
                return_number=return_number,
                sale_id=sale.id,
                processed_by=actor.id,
                refund_method=refund_method,
                refund_amount=total_refund,
                reason=reason,
                status="COMPLETED",
            )
            db.session.add(sale_return)
            db.session.flush()

            # Step 10: Create SaleReturnItems and restore inventory
            for line in line_items_data:
                ret_item = SaleReturnItem(
                    sale_return_id=sale_return.id,
                    sale_item_id=line["sale_item"].id,
                    product_id=line["product_id"],
                    quantity=line["quantity"],
                    unit_price=line["unit_price"],
                    refund_subtotal=line["refund_subtotal"],
                )
                db.session.add(ret_item)

                # Authoritative stock restoration
                InventoryService.restore_stock(
                    product_id=line["product_id"],
                    quantity=line["quantity"],
                    actor=actor,
                    reference_type="SALE_RETURN",
                    reference_id=sale_return.id,
                    remarks=f"Return {return_number} for Invoice {sale.invoice_number}",
                    commit=False,
                )

            # Step 11: Update Sale status if 100% returned
            if is_full_return:
                sale.status = SaleStatus.RETURNED.value

            # Step 12: Audit Log
            audit = AuditLog(
                user_id=actor.id,
                action="SALE_RETURN_COMPLETED",
                entity_type="SaleReturn",
                entity_id=sale_return.id,
                description=(
                    f"Return {return_number} processed for Invoice {sale.invoice_number} by {actor.email}. "
                    f"Items: {len(line_items_data)}, Refund: {total_refund:.2f} ({refund_method}). "
                    f"Reason: {reason}."
                ),
            )
            db.session.add(audit)

            # Step 13: Commit atomic transaction
            db.session.commit()

            return cls.get_return(sale_return.id)

        except Exception:
            db.session.rollback()
            raise
