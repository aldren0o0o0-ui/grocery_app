from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import pytest
from sqlalchemy import select
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Role
from app.modules.categories.models import Category
from app.modules.inventory.models import StockMovement
from app.modules.products.models import Product
from app.modules.purchasing.models import Purchase, PurchaseItem
from app.modules.returns.models import SaleReturn, SaleReturnItem
from app.modules.returns.services import ReturnService
from app.modules.sales.models import Payment, Sale, SaleItem
from app.modules.users.models import User


@pytest.fixture(autouse=True)
def cleanup_concurrency_data(app):
    def clean():
        with app.app_context():
            AuditLog.query.filter(
                AuditLog.entity_type.in_(["SaleReturn", "Sale", "StockMovement", "Product", "Category", "Purchase"])
            ).delete()
            SaleReturnItem.query.delete()
            SaleReturn.query.delete()
            Payment.query.delete()
            SaleItem.query.delete()
            Sale.query.delete()
            PurchaseItem.query.delete()
            Purchase.query.delete()
            StockMovement.query.delete()
            Product.query.delete()
            Category.query.delete()
            db.session.commit()
    clean()
    yield
    clean()


def test_concurrent_returns_prevent_double_restoration(app):
    """Verifies that competing concurrent return transactions cannot exceed returnable quantity."""
    with app.app_context():
        role = db.session.execute(select(Role).filter_by(name="OWNER")).scalar_one()
        owner = db.session.execute(select(User).filter_by(email="concur_owner@test.com")).scalar_one_or_none()
        if not owner:
            owner = User(
                role_id=role.id,
                first_name="Concur",
                last_name="Owner",
                email="concur_owner@test.com",
                password_hash=generate_password_hash("Password123"),
                is_active=True,
            )
            db.session.add(owner)
            db.session.flush()

        cat = Category(name="Concurrency Cat", is_active=True)
        db.session.add(cat)
        db.session.flush()

        product = Product(
            category_id=cat.id,
            name="Concurrency Soap",
            sku="SOAP-CONCUR",
            barcode="BAR-SOAP-CONCUR",
            stock_quantity=Decimal("10.000"),
            cost_price=Decimal("20.00"),
            selling_price=Decimal("30.00"),
            unit="pcs",
            is_active=True,
        )
        db.session.add(product)
        db.session.flush()

        # Sale of 2 units
        sale = Sale(
            invoice_number="SAL-CONCUR-0001",
            cashier_id=owner.id,
            subtotal=Decimal("60.00"),
            discount=Decimal("0.00"),
            total=Decimal("60.00"),
            status="COMPLETED",
        )
        db.session.add(sale)
        db.session.flush()

        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=product.id,
            quantity=Decimal("2.000"),
            unit_price=Decimal("30.00"),
            cost_price=Decimal("20.00"),
            subtotal=Decimal("60.00"),
        )
        db.session.add(sale_item)
        db.session.commit()

        sale_id = sale.id
        sale_item_id = sale_item.id
        owner_id = owner.id
        product_id = product.id

    # Two competing threads attempt to return the full 2.000 units concurrently
    def attempt_return(_):
        with app.app_context():
            actor = db.session.get(User, owner_id)
            payload = {
                "sale_id": sale_id,
                "reason": "Concurrent race attempt",
                "refund_method": "CASH",
                "items": [{"sale_item_id": sale_item_id, "quantity": "2.000"}],
            }
            try:
                ret = ReturnService.create_return(payload, actor)
                return {"status": "SUCCESS", "return_id": ret.id}
            except Exception as e:
                return {"status": "ERROR", "error": str(e)}

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(attempt_return, [1, 2]))

    successes = [r for r in results if r["status"] == "SUCCESS"]
    errors = [r for r in results if r["status"] == "ERROR"]

    # Exactly 1 must succeed and 1 must fail
    assert len(successes) == 1, f"Expected exactly 1 success, got: {results}"
    assert len(errors) == 1, f"Expected exactly 1 error, got: {results}"
    assert (
        "exceeds remaining returnable quantity" in errors[0]["error"]
        or "Cannot process return for sale with status 'RETURNED'" in errors[0]["error"]
    )

    # Check database state: total returned quantity in DB must be exactly 2.000
    with app.app_context():
        p = db.session.get(Product, product_id)
        # Initial stock was 10.000, 2 units restored = 12.000 (never 14.000!)
        assert p.stock_quantity == Decimal("12.000")

        total_ret_qty = db.session.execute(
            select(db.func.sum(SaleReturnItem.quantity)).filter_by(sale_item_id=sale_item_id)
        ).scalar_one()
        assert total_ret_qty == Decimal("2.000")
