from datetime import date
from decimal import Decimal
from unittest.mock import patch
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
from app.modules.returns.models import SaleReturn, SaleReturnItem
from app.modules.sales.models import Payment, Sale, SaleItem
from app.modules.users.models import User


def get_token_for_role(role_name: str, email_suffix: str = "main") -> str:
    role = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one()
    email = f"returns_{role_name.lower()}_{email_suffix}@test.com"
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


def get_user_for_role(role_name: str, email_suffix: str = "main") -> User:
    email = f"returns_{role_name.lower()}_{email_suffix}@test.com"
    return db.session.execute(select(User).filter_by(email=email)).scalar_one()


@pytest.fixture(autouse=True)
def cleanup_returns_data(app):
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
            name=f"Rice 5kg {uid}",
            sku=f"RICE-{uid}",
            barcode=f"BAR-RICE-{uid}",
            stock_quantity=Decimal("50.000"),
            cost_price=Decimal("150.00"),
            selling_price=Decimal("200.00"),
            unit="bag",
            is_active=True,
        )
        p2 = Product(
            category_id=cat.id,
            name=f"Sugar 1kg {uid}",
            sku=f"SUGAR-{uid}",
            barcode=f"BAR-SUG-{uid}",
            stock_quantity=Decimal("30.000"),
            cost_price=Decimal("50.00"),
            selling_price=Decimal("70.00"),
            unit="pcs",
            is_active=True,
        )
        db.session.add_all([p1, p2])
        db.session.commit()

        return {
            "category_id": cat.id,
            "product1_id": p1.id,
            "product2_id": p2.id,
        }


def create_sample_sale(client, cashier_token, p1_id, p2_id, qty1="2.000", qty2="1.000", discount="0.00"):
    payload = {
        "items": [
            {"product_id": p1_id, "quantity": qty1},
            {"product_id": p2_id, "quantity": qty2},
        ],
        "discount": discount,
        "payment": {
            "method": "CASH",
            "amount_paid": "1000.00",
        },
    }
    res = client.post("/api/sales", json=payload, headers={"Authorization": f"Bearer {cashier_token}"})
    assert res.status_code == 201
    return res.get_json()["sale"]


def test_rbac_returns(client, setup_data):
    owner_token = get_token_for_role("OWNER", "r1")
    cashier1_token = get_token_for_role("CASHIER", "r1")
    cashier2_token = get_token_for_role("CASHIER", "r2")
    staff_token = get_token_for_role("STAFF", "r1")

    p1_id = setup_data["product1_id"]
    p2_id = setup_data["product2_id"]

    sale = create_sample_sale(client, cashier1_token, p1_id, p2_id)
    sale_item = sale["items"][0]

    return_payload = {
        "sale_id": sale["id"],
        "reason": "Defective item packaging",
        "refund_method": "CASH",
        "items": [
            {"sale_item_id": sale_item["id"], "quantity": "1.000"},
        ],
    }

    # 1. STAFF is denied
    res = client.post("/api/returns", json=return_payload, headers={"Authorization": f"Bearer {staff_token}"})
    assert res.status_code == 403

    # 2. Other Cashier is denied on Cashier 1's sale
    res = client.post("/api/returns", json=return_payload, headers={"Authorization": f"Bearer {cashier2_token}"})
    assert res.status_code == 403
    assert res.get_json()["error"]["code"] == "FORBIDDEN"

    # 3. Cashier 1 can return own sale
    res = client.post("/api/returns", json=return_payload, headers={"Authorization": f"Bearer {cashier1_token}"})
    assert res.status_code == 201
    ret_data = res.get_json()["return"]
    assert ret_data["return_number"].startswith("RET-")

    # Cashier cannot see cost prices in returns or sale detail
    for item in ret_data["items"]:
        assert "cost_price" not in item

    # 4. OWNER can view return and sees cost price
    res_owner = client.get(f"/api/returns/{ret_data['id']}", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_owner.status_code == 200
    for item in res_owner.get_json()["return"]["items"]:
        assert "cost_price" in item


def test_partial_return_and_inventory_restoration(client, setup_data):
    owner_token = get_token_for_role("OWNER", "inv1")
    cashier_token = get_token_for_role("CASHIER", "inv1")
    p1_id = setup_data["product1_id"]
    p2_id = setup_data["product2_id"]

    # Initial stock: p1 = 50, p2 = 30
    sale = create_sample_sale(client, cashier_token, p1_id, p2_id, qty1="3.000", qty2="2.000")
    # Post-sale stock: p1 = 47, p2 = 28

    with client.application.app_context():
        p1 = db.session.get(Product, p1_id)
        assert p1.stock_quantity == Decimal("47.000")

    item1 = [i for i in sale["items"] if i["product_id"] == p1_id][0]

    # Partial return of 1 bag of p1
    res = client.post(
        "/api/returns",
        json={
            "sale_id": sale["id"],
            "reason": "Customer purchased wrong brand",
            "refund_method": "CASH",
            "items": [{"sale_item_id": item1["id"], "quantity": "1.000"}],
        },
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res.status_code == 201
    ret_id = res.get_json()["return"]["id"]

    # Verify inventory was restored strictly by 1.000
    with client.application.app_context():
        p1 = db.session.get(Product, p1_id)
        assert p1.stock_quantity == Decimal("48.000")

        # Verify StockMovement record
        movement = db.session.execute(
            select(StockMovement).filter_by(reference_type="SALE_RETURN", reference_id=ret_id)
        ).scalar_one()
        assert movement.product_id == p1_id
        assert movement.quantity == Decimal("1.000")
        assert movement.movement_type == "RETURN"

    # Verify Sale state
    res_sale = client.get(f"/api/sales/{sale['id']}", headers={"Authorization": f"Bearer {owner_token}"})
    sale_updated = res_sale.get_json()["sale"]
    assert sale_updated["status"] == "COMPLETED"
    assert sale_updated["return_state"] == "PARTIAL"
    assert sale_updated["total_refunded"] == "200.00"

    item1_updated = [i for i in sale_updated["items"] if i["product_id"] == p1_id][0]
    assert item1_updated["returned_quantity"] == "1.000"
    assert item1_updated["returnable_quantity"] == "2.000"


def test_prorated_discount_and_exact_full_return_reconciliation(client, setup_data):
    owner_token = get_token_for_role("OWNER", "disc1")
    p1_id = setup_data["product1_id"]
    p2_id = setup_data["product2_id"]

    # p1 = 200.00 x 2 = 400.00
    # p2 = 70.00 x 1 = 70.00
    # subtotal = 470.00, discount = 47.00, total = 423.00
    sale = create_sample_sale(client, owner_token, p1_id, p2_id, qty1="2.000", qty2="1.000", discount="47.00")
    assert sale["subtotal"] == "470.00"
    assert sale["discount"] == "47.00"
    assert sale["total"] == "423.00"

    item1 = [i for i in sale["items"] if i["product_id"] == p1_id][0]
    item2 = [i for i in sale["items"] if i["product_id"] == p2_id][0]

    # Return 1 unit of p1
    # p1 discount share: 47 * (400 / 470) = 40.00 => net for 2 units = 360.00
    # 1 unit refund = 180.00
    res1 = client.post(
        "/api/returns",
        json={
            "sale_id": sale["id"],
            "reason": "Partial return item 1",
            "refund_method": "CASH",
            "items": [{"sale_item_id": item1["id"], "quantity": "1.000"}],
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res1.status_code == 201
    ret1 = res1.get_json()["return"]
    assert ret1["refund_amount"] == "180.00"

    # Return remaining 1 unit of p1 and 1 unit of p2 (completes full return of sale)
    # Remaining on sale: total (423.00) - 180.00 = 243.00
    res2 = client.post(
        "/api/returns",
        json={
            "sale_id": sale["id"],
            "reason": "Complete remaining return",
            "refund_method": "CASH",
            "items": [
                {"sale_item_id": item1["id"], "quantity": "1.000"},
                {"sale_item_id": item2["id"], "quantity": "1.000"},
            ],
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res2.status_code == 201
    ret2 = res2.get_json()["return"]
    assert ret2["refund_amount"] == "243.00"

    # Cumulative refund must equal exactly 423.00
    total_refund = Decimal(ret1["refund_amount"]) + Decimal(ret2["refund_amount"])
    assert total_refund == Decimal("423.00")

    # Verify Sale transitions to RETURNED and return_state is FULL
    res_sale = client.get(f"/api/sales/{sale['id']}", headers={"Authorization": f"Bearer {owner_token}"})
    sale_updated = res_sale.get_json()["sale"]
    assert sale_updated["status"] == "RETURNED"
    assert sale_updated["return_state"] == "FULL"
    assert sale_updated["total_refunded"] == "423.00"


def test_inactive_product_return_allowed(client, setup_data):
    owner_token = get_token_for_role("OWNER", "inact1")
    p1_id = setup_data["product1_id"]
    p2_id = setup_data["product2_id"]

    sale = create_sample_sale(client, owner_token, p1_id, p2_id, qty1="1.000", qty2="1.000")
    item1 = [i for i in sale["items"] if i["product_id"] == p1_id][0]

    # Deactivate product
    with client.application.app_context():
        p1 = db.session.get(Product, p1_id)
        p1.is_active = False
        db.session.commit()

    # Attempt return of deactivated product
    res = client.post(
        "/api/returns",
        json={
            "sale_id": sale["id"],
            "reason": "Customer returning discontinued product",
            "refund_method": "CASH",
            "items": [{"sale_item_id": item1["id"], "quantity": "1.000"}],
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 201
    assert res.get_json()["return"]["items"][0]["quantity"] == "1.000"


def test_validation_and_exceeding_quantity(client, setup_data):
    owner_token = get_token_for_role("OWNER", "val1")
    p1_id = setup_data["product1_id"]
    p2_id = setup_data["product2_id"]

    sale = create_sample_sale(client, owner_token, p1_id, p2_id, qty1="2.000", qty2="1.000")
    item1 = [i for i in sale["items"] if i["product_id"] == p1_id][0]

    # 1. Missing items
    res = client.post(
        "/api/returns",
        json={"sale_id": sale["id"], "reason": "Test", "refund_method": "CASH", "items": []},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "RETURN_EMPTY"

    # 2. Invalid refund method
    res = client.post(
        "/api/returns",
        json={"sale_id": sale["id"], "reason": "Test", "refund_method": "BITCOIN", "items": [{"sale_item_id": item1["id"], "quantity": "1.000"}]},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "INVALID_REFUND_METHOD"

    # 3. Exceeding returnable quantity (sold 2.000, requesting 3.000)
    res = client.post(
        "/api/returns",
        json={
            "sale_id": sale["id"],
            "reason": "Exceed test",
            "refund_method": "CASH",
            "items": [{"sale_item_id": item1["id"], "quantity": "3.000"}],
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "RETURN_QUANTITY_EXCEEDED"


def test_atomicity_rollback_on_failure(client, setup_data):
    owner_token = get_token_for_role("OWNER", "atom1")
    p1_id = setup_data["product1_id"]
    p2_id = setup_data["product2_id"]

    sale = create_sample_sale(client, owner_token, p1_id, p2_id, qty1="2.000", qty2="1.000")
    item1 = [i for i in sale["items"] if i["product_id"] == p1_id][0]

    # Mock an unexpected error during InventoryService.restore_stock
    with patch("app.modules.returns.services.InventoryService.restore_stock", side_effect=RuntimeError("Simulated stock failure")):
        res = client.post(
            "/api/returns",
            json={
                "sale_id": sale["id"],
                "reason": "Atomic test",
                "refund_method": "CASH",
                "items": [{"sale_item_id": item1["id"], "quantity": "1.000"}],
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert res.status_code == 500

    # Verify no return or stock movements exist
    with client.application.app_context():
        returns_count = db.session.execute(select(db.func.count(SaleReturn.id))).scalar_one()
        assert returns_count == 0

        movements_count = db.session.execute(
            select(db.func.count(StockMovement.id)).filter_by(reference_type="SALE_RETURN")
        ).scalar_one()
        assert movements_count == 0
