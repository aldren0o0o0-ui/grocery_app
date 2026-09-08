import concurrent.futures
from decimal import Decimal
import pytest
from sqlalchemy import select

from app.extensions import db
from app.modules.categories.models import Category
from app.modules.products.models import Product
from app.modules.purchasing.models import Purchase, PurchaseItem, PurchaseStatus
from app.modules.purchasing.services import PurchaseService
from app.modules.suppliers.models import Supplier
from app.modules.users.models import User
from tests.test_purchasing import get_token_for_role


def test_concurrent_receive_purchase(app, client):
    """Verifies that concurrent calls to receive the same purchase serialize properly:
    Exactly one succeeds and the other fails without double-stock addition.
    """
    import uuid
    uid = uuid.uuid4().hex[:6]
    with app.app_context():
        # Setup supplier, product, user, and purchase
        sup = Supplier(name=f"Concurrency Supplier {uid}", is_active=True)
        cat = Category(name=f"Concurrency Category {uid}", is_active=True)
        db.session.add_all([sup, cat])
        db.session.flush()

        prod = Product(
            category_id=cat.id,
            name=f"Concurrent Sugar 1kg {uid}",
            sku=f"CONC-SUG-{uid}",
            stock_quantity=Decimal("10.000"),
            cost_price=Decimal("40.00"),
            selling_price=Decimal("60.00"),
            unit="pack",
            is_active=True,
        )
        db.session.add(prod)
        db.session.flush()

        owner = db.session.execute(
            select(User).join(User.role).filter_by(name="OWNER")
        ).scalars().first()

        purchase = Purchase(
            supplier_id=sup.id,
            reference_number=PurchaseService.generate_reference_number(prod.created_at.date() if prod.created_at else db.func.current_date()),
            purchase_date=db.func.current_date(),
            status=PurchaseStatus.DRAFT.value,
            total_amount=Decimal("2000.00"),
            created_by=owner.id,
        )
        db.session.add(purchase)
        db.session.flush()

        item = PurchaseItem(
            purchase_id=purchase.id,
            product_id=prod.id,
            quantity=Decimal("50.000"),
            unit_cost=Decimal("40.00"),
            subtotal=Decimal("2000.00"),
        )
        db.session.add(item)
        db.session.commit()

        purchase_id = purchase.id
        prod_id = prod.id

    token = get_token_for_role(client, "OWNER")

    def perform_receive():
        # Create a fresh test client for each thread
        c = app.test_client()
        return c.post(
            f"/api/purchases/{purchase_id}/receive",
            headers={"Authorization": f"Bearer {token}"},
        )

    # Fire 2 concurrent receive requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(perform_receive)
        f2 = executor.submit(perform_receive)
        res1 = f1.result()
        res2 = f2.result()

    status_codes = sorted([res1.status_code, res2.status_code])
    # Exactly one 200, exactly one 400 (or 409)
    assert status_codes == [200, 400]

    with app.app_context():
        p_final = db.session.get(Purchase, purchase_id)
        assert p_final.status == PurchaseStatus.RECEIVED.value

        # Invariant: stock was incremented ONCE (10 + 50 = 60), never 110!
        prod_final = db.session.get(Product, prod_id)
        assert prod_final.stock_quantity == Decimal("60.000")
