import concurrent.futures
from decimal import Decimal
import pytest
from sqlalchemy import select

from app.extensions import db
from app.modules.categories.models import Category
from app.modules.inventory.models import StockMovement
from app.modules.products.models import Product
from app.modules.sales.models import Payment, Sale, SaleItem
from tests.test_sales import get_token_for_role


def test_concurrent_competing_sales_prevent_oversell(app, client):
    """Verifies that two cashiers competing for the same inventory cannot oversell:
    Initial stock: 5.000.
    Cashier A checks out 4.000.
    Cashier B checks out 3.000.
    Expected: Exactly one succeeds (201), one fails (400 INSUFFICIENT_STOCK).
    Remaining stock is 1.000 or 2.000, NEVER negative.
    """
    import uuid
    uid = uuid.uuid4().hex[:6]
    with app.app_context():
        cat = Category(name=f"Concurrency Cat {uid}", is_active=True)
        db.session.add(cat)
        db.session.flush()

        prod = Product(
            category_id=cat.id,
            name=f"Limited Stock Product {uid}",
            sku=f"CONC-LTD-{uid}",
            stock_quantity=Decimal("5.000"),
            cost_price=Decimal("50.00"),
            selling_price=Decimal("100.00"),
            unit="pcs",
            is_active=True,
        )
        db.session.add(prod)
        db.session.commit()
        prod_id = prod.id

    token_c1 = get_token_for_role("CASHIER", f"c1_{uid}")
    token_c2 = get_token_for_role("CASHIER", f"c2_{uid}")

    def checkout_request(token, quantity, amount_paid):
        c = app.test_client()
        return c.post(
            "/api/sales",
            json={
                "items": [{"product_id": prod_id, "quantity": quantity}],
                "payment": {"method": "CASH", "amount_paid": amount_paid},
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    # Launch competing checkouts simultaneously
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(checkout_request, token_c1, "4.000", "400.00")
        f2 = executor.submit(checkout_request, token_c2, "3.000", "300.00")
        res1 = f1.result()
        res2 = f2.result()

    status_codes = sorted([res1.status_code, res2.status_code])
    assert status_codes == [201, 400]

    # Verify error code of the losing request
    loser_res = res1 if res1.status_code == 400 else res2
    assert loser_res.get_json()["error"]["code"] == "INSUFFICIENT_STOCK"

    with app.app_context():
        final_prod = db.session.get(Product, prod_id)
        # Winner was either 4 (leaves 1) or 3 (leaves 2)
        assert final_prod.stock_quantity in [Decimal("1.000"), Decimal("2.000")]

        # Exactly 1 Sale was created for this product
        assert Sale.query.count() == 1
        assert SaleItem.query.filter_by(product_id=prod_id).count() == 1
        assert StockMovement.query.filter_by(product_id=prod_id, movement_type="SALE").count() == 1


def test_concurrent_multi_product_deadlock_prevention(app, client):
    """Verifies that concurrent checkouts requesting the same products in reverse order
    do not deadlock due to deterministic row-level lock ordering (sorted product IDs).
    """
    import uuid
    uid = uuid.uuid4().hex[:6]
    with app.app_context():
        cat = Category(name=f"Deadlock Cat {uid}", is_active=True)
        db.session.add(cat)
        db.session.flush()

        p_low = Product(
            category_id=cat.id,
            name=f"Item Low ID {uid}",
            sku=f"LOW-{uid}",
            stock_quantity=Decimal("50.000"),
            cost_price=Decimal("10.00"),
            selling_price=Decimal("20.00"),
            unit="pcs",
            is_active=True,
        )
        p_high = Product(
            category_id=cat.id,
            name=f"Item High ID {uid}",
            sku=f"HIGH-{uid}",
            stock_quantity=Decimal("50.000"),
            cost_price=Decimal("15.00"),
            selling_price=Decimal("30.00"),
            unit="pcs",
            is_active=True,
        )
        db.session.add_all([p_low, p_high])
        db.session.commit()
        id1, id2 = p_low.id, p_high.id

    token1 = get_token_for_role("CASHIER", f"dl1_{uid}")
    token2 = get_token_for_role("CASHIER", f"dl2_{uid}")

    # Thread 1 sends [id1, id2]
    payload1 = {
        "items": [
            {"product_id": id1, "quantity": "2.000"},
            {"product_id": id2, "quantity": "1.000"},
        ],
        "payment": {"method": "CASH", "amount_paid": "70.00"},  # 2*20 + 1*30 = 70.00
    }

    # Thread 2 sends [id2, id1] (reverse order)
    payload2 = {
        "items": [
            {"product_id": id2, "quantity": "2.000"},
            {"product_id": id1, "quantity": "3.000"},
        ],
        "payment": {"method": "CASH", "amount_paid": "120.00"},  # 2*30 + 3*20 = 120.00
    }

    def checkout_call(token, payload):
        c = app.test_client()
        return c.post(
            "/api/sales",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(checkout_call, token1, payload1)
        f2 = executor.submit(checkout_call, token2, payload2)
        r1 = f1.result()
        r2 = f2.result()

    # Both must complete without deadlock
    assert r1.status_code == 201
    assert r2.status_code == 201

    with app.app_context():
        final_p1 = db.session.get(Product, id1)
        final_p2 = db.session.get(Product, id2)
        # Total deducted from id1: 2 + 3 = 5 -> 45.000
        assert final_p1.stock_quantity == Decimal("45.000")
        # Total deducted from id2: 1 + 2 = 3 -> 47.000
        assert final_p2.stock_quantity == Decimal("47.000")
