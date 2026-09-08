from decimal import Decimal
import pytest
from sqlalchemy import select
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Role
from app.modules.auth.tokens import generate_access_token
from app.modules.categories.models import Category
from app.modules.inventory.models import StockMovement
from app.modules.products.models import Product
from app.modules.purchasing.models import Purchase, PurchaseItem
from app.modules.sales.models import Payment, Sale, SaleItem
from app.modules.users.models import User


def get_token_for_role(role_name: str, email_suffix: str = "main") -> str:
    role = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one()
    email = f"sales_{role_name.lower()}_{email_suffix}@test.com"
    user = db.session.execute(select(User).filter_by(email=email)).scalar_one_or_none()
    if not user:
        user = User(
            role_id=role.id,
            first_name=role_name.capitalize(),
            last_name=f"Tester {email_suffix}",
            email=email,
            password_hash=generate_password_hash("Password123"),
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()
    return generate_access_token(user)


@pytest.fixture(autouse=True)
def cleanup_sales_data(app):
    def clean():
        with app.app_context():
            AuditLog.query.filter(AuditLog.entity_type.in_(["Sale", "Product", "Category", "Purchase", "StockMovement"])).delete()
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


@pytest.fixture
def setup_data(app):
    import uuid
    uid = uuid.uuid4().hex[:6]
    with app.app_context():
        cat = Category(name=f"Groceries {uid}", is_active=True)
        db.session.add(cat)
        db.session.flush()

        p1 = Product(
            category_id=cat.id,
            name=f"Jasmine Rice 5kg {uid}",
            sku=f"RICE-{uid}",
            barcode=f"BAR-RICE-{uid}",
            stock_quantity=Decimal("20.000"),
            cost_price=Decimal("150.00"),
            selling_price=Decimal("200.00"),
            unit="bag",
            is_active=True,
        )
        p2 = Product(
            category_id=cat.id,
            name=f"Refined Sugar 1kg {uid}",
            sku=f"SUGAR-{uid}",
            barcode=f"BAR-SUG-{uid}",
            stock_quantity=Decimal("10.000"),
            cost_price=Decimal("40.00"),
            selling_price=Decimal("60.00"),
            unit="pack",
            is_active=True,
        )
        p_inactive = Product(
            category_id=cat.id,
            name=f"Discontinued Goods {uid}",
            sku=f"DISC-{uid}",
            stock_quantity=Decimal("15.000"),
            cost_price=Decimal("30.00"),
            selling_price=Decimal("50.00"),
            unit="pcs",
            is_active=False,
        )
        db.session.add_all([p1, p2, p_inactive])
        db.session.commit()

        return {
            "p1_id": p1.id,
            "p2_id": p2.id,
            "p_inactive_id": p_inactive.id,
        }


def test_sales_authorization(client, setup_data):
    """OWNER and CASHIER are allowed; STAFF is strictly forbidden."""
    owner_token = get_token_for_role("OWNER", "auth1")
    cashier_token = get_token_for_role("CASHIER", "auth1")
    staff_token = get_token_for_role("STAFF", "auth1")

    # POS products catalog
    res_owner = client.get("/api/sales/products", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_owner.status_code == 200

    res_cashier = client.get("/api/sales/products", headers={"Authorization": f"Bearer {cashier_token}"})
    assert res_cashier.status_code == 200

    res_staff = client.get("/api/sales/products", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_staff.status_code == 403

    # Sales listing
    assert client.get("/api/sales", headers={"Authorization": f"Bearer {owner_token}"}).status_code == 200
    assert client.get("/api/sales", headers={"Authorization": f"Bearer {cashier_token}"}).status_code == 200
    assert client.get("/api/sales", headers={"Authorization": f"Bearer {staff_token}"}).status_code == 403

    # Checkout
    sample_payload = {
        "items": [{"product_id": setup_data["p1_id"], "quantity": "1.000"}],
        "payment": {"method": "CASH", "amount_paid": "200.00"},
    }
    assert client.post("/api/sales", json=sample_payload, headers={"Authorization": f"Bearer {staff_token}"}).status_code == 403


def test_checkout_empty_cart_and_validation(client, setup_data):
    cashier_token = get_token_for_role("CASHIER", "val1")

    # Empty items list
    res = client.post(
        "/api/sales",
        json={"items": [], "payment": {"method": "CASH", "amount_paid": "100.00"}},
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "SALE_EMPTY"

    # Missing product
    res = client.post(
        "/api/sales",
        json={"items": [{"product_id": 99999, "quantity": "1.000"}], "payment": {"method": "CASH", "amount_paid": "100.00"}},
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 404
    assert res.get_json()["error"]["code"] == "PRODUCT_NOT_FOUND"

    # Inactive product
    res = client.post(
        "/api/sales",
        json={"items": [{"product_id": setup_data["p_inactive_id"], "quantity": "1.000"}], "payment": {"method": "CASH", "amount_paid": "100.00"}},
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "PRODUCT_INACTIVE"

    # Zero quantity
    res = client.post(
        "/api/sales",
        json={"items": [{"product_id": setup_data["p1_id"], "quantity": "0.000"}], "payment": {"method": "CASH", "amount_paid": "100.00"}},
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "INVALID_QUANTITY"

    # Negative quantity
    res = client.post(
        "/api/sales",
        json={"items": [{"product_id": setup_data["p1_id"], "quantity": "-2.000"}], "payment": {"method": "CASH", "amount_paid": "100.00"}},
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "INVALID_QUANTITY"


def test_checkout_server_authoritative_pricing_and_calculations(client, setup_data):
    """Client cannot spoof unit_price, cost_price, subtotal, total, or cashier."""
    cashier_token = get_token_for_role("CASHIER", "calc1")

    # Client tries to spoof prices to ₱1.00
    spoofed_payload = {
        "items": [
            {
                "product_id": setup_data["p1_id"],
                "quantity": "2.000",
                "unit_price": "1.00",
                "cost_price": "0.50",
                "subtotal": "2.00",
            },
            {
                "product_id": setup_data["p2_id"],
                "quantity": "1.500",
                "unit_price": "1.00",
                "cost_price": "0.50",
                "subtotal": "1.50",
            },
        ],
        "discount": "20.00",
        "subtotal": "3.50",
        "total": "3.50",
        "invoice_number": "FAKE-INVOICE-001",
        "cashier_id": 999,
        "payment": {
            "method": "CASH",
            "amount_paid": "500.00",
        },
    }

    res = client.post("/api/sales", json=spoofed_payload, headers={"Authorization": f"Bearer {cashier_token}"})
    assert res.status_code == 201

    sale = res.get_json()["sale"]
    assert sale["invoice_number"].startswith("SAL-")
    assert sale["invoice_number"] != "FAKE-INVOICE-001"

    # Server calculations:
    # p1: 2 * 200.00 = 400.00
    # p2: 1.5 * 60.00 = 90.00
    # subtotal = 490.00
    # discount = 20.00
    # total = 470.00
    # payment: 500.00 -> change = 30.00
    assert sale["subtotal"] == "490.00"
    assert sale["discount"] == "20.00"
    assert sale["total"] == "470.00"

    payment = sale["payments"][0]
    assert payment["payment_method"] == "CASH"
    assert payment["amount_paid"] == "500.00"
    assert payment["change_amount"] == "30.00"


def test_checkout_duplicate_cart_items_normalized(client, setup_data):
    cashier_token = get_token_for_role("CASHIER", "norm1")

    payload = {
        "items": [
            {"product_id": setup_data["p1_id"], "quantity": "1.000"},
            {"product_id": setup_data["p2_id"], "quantity": "2.000"},
            {"product_id": setup_data["p1_id"], "quantity": "3.500"},  # duplicate of p1
        ],
        "discount": "0.00",
        "payment": {
            "method": "CASH",
            # p1 total qty: 4.5 * 200 = 900; p2 total qty: 2.0 * 60 = 120. Total = 1020.00
            "amount_paid": "1020.00",
        },
    }

    res = client.post("/api/sales", json=payload, headers={"Authorization": f"Bearer {cashier_token}"})
    assert res.status_code == 201

    sale = res.get_json()["sale"]
    assert len(sale["items"]) == 2  # exactly 2 unique items

    p1_item = next(it for it in sale["items"] if it["product_id"] == setup_data["p1_id"])
    assert p1_item["quantity"] == "4.500"
    assert p1_item["subtotal"] == "900.00"

    p2_item = next(it for it in sale["items"] if it["product_id"] == setup_data["p2_id"])
    assert p2_item["quantity"] == "2.000"
    assert p2_item["subtotal"] == "120.00"


def test_cash_and_electronic_payment_rules(client, setup_data):
    cashier_token = get_token_for_role("CASHIER", "pay1")

    # 1. Cash Underpayment rejected
    res = client.post(
        "/api/sales",
        json={
            "items": [{"product_id": setup_data["p1_id"], "quantity": "1.000"}],  # 200.00
            "payment": {"method": "CASH", "amount_paid": "150.00"},
        },
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "INSUFFICIENT_PAYMENT"

    # 2. GCash amount mismatch rejected (overpayment)
    res = client.post(
        "/api/sales",
        json={
            "items": [{"product_id": setup_data["p1_id"], "quantity": "1.000"}],  # 200.00
            "payment": {"method": "GCASH", "amount_paid": "250.00"},
        },
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "PAYMENT_AMOUNT_MISMATCH"

    # 3. GCash amount mismatch rejected (underpayment)
    res = client.post(
        "/api/sales",
        json={
            "items": [{"product_id": setup_data["p1_id"], "quantity": "1.000"}],  # 200.00
            "payment": {"method": "GCASH", "amount_paid": "199.00"},
        },
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "PAYMENT_AMOUNT_MISMATCH"

    # 4. GCash exact payment succeeds with 0 change
    res = client.post(
        "/api/sales",
        json={
            "items": [{"product_id": setup_data["p1_id"], "quantity": "1.000"}],  # 200.00
            "payment": {"method": "GCASH", "amount_paid": "200.00"},
        },
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 201
    sale = res.get_json()["sale"]
    assert sale["payments"][0]["change_amount"] == "0.00"


def test_inventory_integration_and_ledger_traceability(client, setup_data):
    cashier_token = get_token_for_role("CASHIER", "inv1")

    # Initial stock: p1 = 20.000
    payload = {
        "items": [{"product_id": setup_data["p1_id"], "quantity": "3.500"}],
        "payment": {"method": "CASH", "amount_paid": "700.00"},  # 3.5 * 200 = 700.00
    }

    res = client.post("/api/sales", json=payload, headers={"Authorization": f"Bearer {cashier_token}"})
    assert res.status_code == 201
    sale_id = res.get_json()["sale"]["id"]

    # Verify Product stock decreased through InventoryService
    product = db.session.get(Product, setup_data["p1_id"])
    assert product.stock_quantity == Decimal("16.500")

    # Verify immutable StockMovement
    movement = db.session.execute(
        select(StockMovement).filter_by(reference_type="SALE", reference_id=sale_id)
    ).scalar_one()

    assert movement.movement_type == "SALE"
    assert movement.quantity == Decimal("3.500")
    assert movement.quantity_before == Decimal("20.000")
    assert movement.quantity_after == Decimal("16.500")


def test_atomicity_multi_item_rollback_on_failure(client, setup_data):
    """If one line has insufficient stock, entire checkout rolls back."""
    cashier_token = get_token_for_role("CASHIER", "atom1")

    # Initial balances: p1 = 20.000, p2 = 10.000
    payload = {
        "items": [
            {"product_id": setup_data["p1_id"], "quantity": "5.000"},   # Available
            {"product_id": setup_data["p2_id"], "quantity": "50.000"},  # Insufficient (only 10 available)
        ],
        "payment": {"method": "CASH", "amount_paid": "5000.00"},
    }

    res = client.post("/api/sales", json=payload, headers={"Authorization": f"Bearer {cashier_token}"})
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "INSUFFICIENT_STOCK"

    # Verify that p1 stock was NOT deducted!
    p1 = db.session.get(Product, setup_data["p1_id"])
    p2 = db.session.get(Product, setup_data["p2_id"])
    assert p1.stock_quantity == Decimal("20.000")
    assert p2.stock_quantity == Decimal("10.000")

    # No Sale or StockMovements exist
    assert Sale.query.count() == 0
    assert SaleItem.query.count() == 0
    assert Payment.query.count() == 0
    assert StockMovement.query.count() == 0


def test_sales_history_scoping_and_cost_exposure(client, setup_data):
    owner_token = get_token_for_role("OWNER", "scope_owner")
    cashier1_token = get_token_for_role("CASHIER", "scope_c1")
    cashier2_token = get_token_for_role("CASHIER", "scope_c2")

    # Cashier 1 makes Sale 1
    res1 = client.post(
        "/api/sales",
        json={"items": [{"product_id": setup_data["p1_id"], "quantity": "1.000"}], "payment": {"method": "CASH", "amount_paid": "200.00"}},
        headers={"Authorization": f"Bearer {cashier1_token}"},
    )
    sale1_id = res1.get_json()["sale"]["id"]

    # Cashier 2 makes Sale 2
    res2 = client.post(
        "/api/sales",
        json={"items": [{"product_id": setup_data["p2_id"], "quantity": "1.000"}], "payment": {"method": "CASH", "amount_paid": "60.00"}},
        headers={"Authorization": f"Bearer {cashier2_token}"},
    )
    sale2_id = res2.get_json()["sale"]["id"]

    # Cashier 1 lists sales: sees only Sale 1
    res = client.get("/api/sales", headers={"Authorization": f"Bearer {cashier1_token}"})
    sales_c1 = res.get_json()["sales"]
    assert len(sales_c1) == 1
    assert sales_c1[0]["id"] == sale1_id

    # Cashier 1 attempts to view Sale 2 detail: FORBIDDEN
    res_forbidden = client.get(f"/api/sales/{sale2_id}", headers={"Authorization": f"Bearer {cashier1_token}"})
    assert res_forbidden.status_code == 403

    # Cashier 1 views Sale 1 detail: cost_price is NOT exposed
    res_detail_c1 = client.get(f"/api/sales/{sale1_id}", headers={"Authorization": f"Bearer {cashier1_token}"})
    assert res_detail_c1.status_code == 200
    item_c1 = res_detail_c1.get_json()["sale"]["items"][0]
    assert "cost_price" not in item_c1

    # OWNER lists sales: sees both Sale 1 and Sale 2
    res_owner = client.get("/api/sales", headers={"Authorization": f"Bearer {owner_token}"})
    assert len(res_owner.get_json()["sales"]) == 2

    # OWNER views Sale 1 detail: cost_price IS exposed
    res_detail_owner = client.get(f"/api/sales/{sale1_id}", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_detail_owner.status_code == 200
    item_owner = res_detail_owner.get_json()["sale"]["items"][0]
    assert "cost_price" in item_owner
    assert item_owner["cost_price"] == "150.00"
