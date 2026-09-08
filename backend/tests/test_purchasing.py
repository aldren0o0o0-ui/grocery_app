from datetime import date
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
from app.modules.purchasing.models import Purchase, PurchaseItem, PurchaseStatus
from app.modules.suppliers.models import Supplier
from app.modules.users.models import User


def get_token_for_role(client, role_name: str) -> str:
    role = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one()
    email = f"purchasing_{role_name.lower()}@test.com"
    user = db.session.execute(select(User).filter_by(email=email)).scalar_one_or_none()
    if not user:
        user = User(
            role_id=role.id,
            first_name=role_name.capitalize(),
            last_name="Tester",
            email=email,
            password_hash=generate_password_hash("Password123"),
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()
    return generate_access_token(user)


@pytest.fixture(autouse=True)
def cleanup_purchasing_data(app):
    def clean():
        with app.app_context():
            from app.modules.sales.models import Sale, SaleItem, Payment
            AuditLog.query.filter(AuditLog.entity_type.in_(["Purchase", "Product", "Supplier", "StockMovement", "Category", "Sale"])).delete()
            Payment.query.delete()
            SaleItem.query.delete()
            Sale.query.delete()
            PurchaseItem.query.delete()
            Purchase.query.delete()
            StockMovement.query.delete()
            Product.query.delete()
            Category.query.delete()
            Supplier.query.delete()
            db.session.commit()
    clean()
    yield
    clean()


@pytest.fixture
def setup_data(app):
    import uuid
    uid = uuid.uuid4().hex[:6]
    with app.app_context():
        # Supplier
        sup = Supplier(
            name=f"Mega Wholesale Corp {uid}",
            contact_person="Tony Stark",
            phone="+63 917 111 2222",
            email=f"sales_{uid}@megawholesale.com",
            address="Makati City",
            is_active=True,
        )
        sup_inactive = Supplier(
            name=f"Defunct Supplies Ltd {uid}",
            is_active=False,
        )
        # Category
        cat = Category(name=f"Staples {uid}", is_active=True)
        db.session.add_all([sup, sup_inactive, cat])
        db.session.flush()

        # Products
        p1 = Product(
            category_id=cat.id,
            name=f"Jasmine Rice 25kg {uid}",
            sku=f"RICE-JAS-{uid}",
            stock_quantity=Decimal("10.000"),
            cost_price=Decimal("1000.00"),
            selling_price=Decimal("1250.00"),
            unit="sack",
            is_active=True,
        )
        p2 = Product(
            category_id=cat.id,
            name=f"Refined Sugar 50kg {uid}",
            sku=f"SUGAR-REF-{uid}",
            stock_quantity=Decimal("5.000"),
            cost_price=Decimal("2000.00"),
            selling_price=Decimal("2400.00"),
            unit="sack",
            is_active=True,
        )
        p_inactive = Product(
            category_id=cat.id,
            name=f"Discontinued Item {uid}",
            sku=f"DISC-ITEM-{uid}",
            stock_quantity=Decimal("0.000"),
            cost_price=Decimal("100.00"),
            selling_price=Decimal("150.00"),
            unit="piece",
            is_active=False,
        )
        db.session.add_all([p1, p2, p_inactive])
        db.session.commit()

        return {
            "supplier_id": sup.id,
            "inactive_supplier_id": sup_inactive.id,
            "p1_id": p1.id,
            "p2_id": p2.id,
            "p_inactive_id": p_inactive.id,
        }


def test_purchasing_rbac(client, setup_data):
    """OWNER and STAFF can read and create, CASHIER is forbidden (403)."""
    owner_token = get_token_for_role(client, "OWNER")
    staff_token = get_token_for_role(client, "STAFF")
    cashier_token = get_token_for_role(client, "CASHIER")

    # 1. CASHIER cannot list purchases (403)
    res_c_list = client.get("/api/purchases", headers={"Authorization": f"Bearer {cashier_token}"})
    assert res_c_list.status_code == 403

    # 2. STAFF can list purchases (200)
    res_s_list = client.get("/api/purchases", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_s_list.status_code == 200

    # 3. OWNER can list purchases (200)
    res_o_list = client.get("/api/purchases", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_o_list.status_code == 200

    # 4. CASHIER cannot create purchase (403)
    res_c_create = client.post(
        "/api/purchases",
        headers={"Authorization": f"Bearer {cashier_token}"},
        json={"supplier_id": setup_data["supplier_id"]},
    )
    assert res_c_create.status_code == 403


def test_create_purchase_validations(client, setup_data):
    """Test validation of inactive supplier, missing supplier, duplicate line items."""
    owner_token = get_token_for_role(client, "OWNER")

    # Inactive supplier (400)
    res_inact_sup = client.post(
        "/api/purchases",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"supplier_id": setup_data["inactive_supplier_id"]},
    )
    assert res_inact_sup.status_code == 400
    assert res_inact_sup.get_json()["error"]["code"] == "SUPPLIER_INACTIVE"

    # Non-existent supplier (404)
    res_no_sup = client.post(
        "/api/purchases",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"supplier_id": 999999},
    )
    assert res_no_sup.status_code == 404

    # Duplicate product in initial items (400)
    p1_id = setup_data["p1_id"]
    res_dup = client.post(
        "/api/purchases",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "supplier_id": setup_data["supplier_id"],
            "items": [
                {"product_id": p1_id, "quantity": "5.000", "unit_cost": "1050.00"},
                {"product_id": p1_id, "quantity": "3.000", "unit_cost": "1050.00"},
            ],
        },
    )
    assert res_dup.status_code == 400
    assert res_dup.get_json()["error"]["code"] == "DUPLICATE_PRODUCT_IN_PURCHASE"


def test_create_purchase_auto_ref_and_calculation(client, setup_data):
    """Verify auto-generation of PUR-YYYYMMDD-XXXX and initial total_amount."""
    owner_token = get_token_for_role(client, "OWNER")
    p1_id = setup_data["p1_id"]
    p2_id = setup_data["p2_id"]

    # Create purchase with 2 line items
    # 10 * 1050.00 = 10500.00
    # 5 * 2100.00 = 10500.00
    # Total = 21000.00
    res = client.post(
        "/api/purchases",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "supplier_id": setup_data["supplier_id"],
            "items": [
                {"product_id": p1_id, "quantity": "10.000", "unit_cost": "1050.00"},
                {"product_id": p2_id, "quantity": "5.000", "unit_cost": "2100.00"},
            ],
        },
    )
    assert res.status_code == 201
    data = res.get_json()["data"]
    assert data["status"] == "DRAFT"
    assert data["reference_number"].startswith("PUR-")
    assert data["total_amount"] == "21000.00"
    assert len(data["items"]) == 2
    assert data["item_count"] == 2


def test_line_item_modifications(client, setup_data):
    """Add, update, and remove line items on a DRAFT purchase."""
    staff_token = get_token_for_role(client, "STAFF")
    p1_id = setup_data["p1_id"]
    p2_id = setup_data["p2_id"]

    # 1. Create empty draft purchase
    res = client.post(
        "/api/purchases",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"supplier_id": setup_data["supplier_id"]},
    )
    assert res.status_code == 201
    purchase_id = res.get_json()["data"]["id"]
    assert res.get_json()["data"]["total_amount"] == "0.00"

    # 2. Add line item p1 (4 * 1020.50 = 4082.00)
    res_add1 = client.post(
        f"/api/purchases/{purchase_id}/items",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"product_id": p1_id, "quantity": "4.000", "unit_cost": "1020.50"},
    )
    assert res_add1.status_code == 201
    item1_id = res_add1.get_json()["data"]["id"]
    assert res_add1.get_json()["data"]["subtotal"] == "4082.00"

    # Verify purchase total updated
    res_p = client.get(f"/api/purchases/{purchase_id}", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_p.get_json()["data"]["total_amount"] == "4082.00"

    # 3. Prevent duplicate line item of p1
    res_dup = client.post(
        f"/api/purchases/{purchase_id}/items",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"product_id": p1_id, "quantity": "1.000", "unit_cost": "1020.50"},
    )
    assert res_dup.status_code == 409
    assert res_dup.get_json()["error"]["code"] == "DUPLICATE_PRODUCT_IN_PURCHASE"

    # 4. Add line item p2 (2 * 1950.00 = 3900.00)
    res_add2 = client.post(
        f"/api/purchases/{purchase_id}/items",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"product_id": p2_id, "quantity": "2.000", "unit_cost": "1950.00"},
    )
    assert res_add2.status_code == 201
    item2_id = res_add2.get_json()["data"]["id"]

    # Verify total: 4082.00 + 3900.00 = 7982.00
    res_p2 = client.get(f"/api/purchases/{purchase_id}", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_p2.get_json()["data"]["total_amount"] == "7982.00"

    # 5. Update line item p1: change quantity to 5.000 (5 * 1020.50 = 5102.50)
    res_up = client.patch(
        f"/api/purchases/{purchase_id}/items/{item1_id}",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"quantity": "5.000"},
    )
    assert res_up.status_code == 200
    assert res_up.get_json()["data"]["subtotal"] == "5102.50"

    # Verify new total: 5102.50 + 3900.00 = 9002.50
    res_p3 = client.get(f"/api/purchases/{purchase_id}", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_p3.get_json()["data"]["total_amount"] == "9002.50"

    # 6. Remove item2
    res_del = client.delete(
        f"/api/purchases/{purchase_id}/items/{item2_id}",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_del.status_code == 200

    # Verify total back to 5102.50
    res_p4 = client.get(f"/api/purchases/{purchase_id}", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_p4.get_json()["data"]["total_amount"] == "5102.50"
    assert len(res_p4.get_json()["data"]["items"]) == 1


def test_receive_purchase_workflow_and_invariants(client, setup_data):
    """Verify end-to-end receipt:
    - stock added via InventoryService
    - StockMovement created
    - Product cost_price updated to latest received unit_cost
    - selling_price untouched
    - status becomes RECEIVED (terminal)
    - cannot receive twice
    - cannot edit or cancel received purchase
    """
    owner_token = get_token_for_role(client, "OWNER")
    p1_id = setup_data["p1_id"]  # Initial stock: 10.000, cost: 1000.00, selling: 1250.00
    p2_id = setup_data["p2_id"]  # Initial stock: 5.000, cost: 2000.00, selling: 2400.00

    # 1. Create draft purchase
    res_create = client.post(
        "/api/purchases",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "supplier_id": setup_data["supplier_id"],
            "items": [
                {"product_id": p1_id, "quantity": "15.000", "unit_cost": "1080.00"},
                {"product_id": p2_id, "quantity": "10.000", "unit_cost": "2150.00"},
            ],
        },
    )
    assert res_create.status_code == 201
    purchase_id = res_create.get_json()["data"]["id"]

    # 2. Receive purchase
    res_receive = client.post(
        f"/api/purchases/{purchase_id}/receive",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_receive.status_code == 200
    data = res_receive.get_json()["data"]
    assert data["status"] == "RECEIVED"

    # 3. Verify Product inventory balances & cost prices
    updated_p1 = db.session.get(Product, p1_id)
    assert updated_p1.stock_quantity == Decimal("25.000")  # 10 + 15
    assert updated_p1.cost_price == Decimal("1080.00")  # updated to latest received unit_cost
    assert updated_p1.selling_price == Decimal("1250.00")  # untouched

    updated_p2 = db.session.get(Product, p2_id)
    assert updated_p2.stock_quantity == Decimal("15.000")  # 5 + 10
    assert updated_p2.cost_price == Decimal("2150.00")  # updated
    assert updated_p2.selling_price == Decimal("2400.00")  # untouched

    # 4. Verify StockMovement entries
    movements = (
        db.session.execute(
            select(StockMovement)
            .filter_by(reference_type="PURCHASE", reference_id=purchase_id)
            .order_by(StockMovement.id)
        )
        .scalars()
        .all()
    )
    assert len(movements) == 2
    assert movements[0].product_id == p1_id
    assert movements[0].movement_type == "PURCHASE"
    assert movements[0].quantity == Decimal("15.000")
    assert movements[0].quantity_before == Decimal("10.000")
    assert movements[0].quantity_after == Decimal("25.000")

    assert movements[1].product_id == p2_id
    assert movements[1].movement_type == "PURCHASE"
    assert movements[1].quantity == Decimal("10.000")
    assert movements[1].quantity_before == Decimal("5.000")
    assert movements[1].quantity_after == Decimal("15.000")

    # 5. Terminal State Invariant: Double receive rejected (400)
    res_double = client.post(
        f"/api/purchases/{purchase_id}/receive",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_double.status_code == 400
    assert res_double.get_json()["error"]["code"] == "PURCHASE_ALREADY_RECEIVED"

    # 6. Terminal State Invariant: Cancel received rejected (400)
    res_cancel = client.post(
        f"/api/purchases/{purchase_id}/cancel",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_cancel.status_code == 400
    assert res_cancel.get_json()["error"]["code"] == "PURCHASE_ALREADY_RECEIVED"

    # 7. Terminal State Invariant: Modify line items on received rejected (400)
    res_add_item = client.post(
        f"/api/purchases/{purchase_id}/items",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"product_id": p1_id, "quantity": "1.000", "unit_cost": "100.00"},
    )
    assert res_add_item.status_code == 400
    assert res_add_item.get_json()["error"]["code"] == "PURCHASE_NOT_EDITABLE"


def test_cancel_purchase_workflow(client, setup_data):
    """Cancelling a DRAFT purchase marks it CANCELLED, does NOT touch stock, and blocks future changes."""
    owner_token = get_token_for_role(client, "OWNER")
    p1_id = setup_data["p1_id"]
    initial_stock = db.session.get(Product, p1_id).stock_quantity

    # Create draft
    res_create = client.post(
        "/api/purchases",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "supplier_id": setup_data["supplier_id"],
            "items": [{"product_id": p1_id, "quantity": "20.000", "unit_cost": "1000.00"}],
        },
    )
    purchase_id = res_create.get_json()["data"]["id"]

    # Cancel purchase
    res_cancel = client.post(
        f"/api/purchases/{purchase_id}/cancel",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_cancel.status_code == 200
    assert res_cancel.get_json()["data"]["status"] == "CANCELLED"

    # Verify stock was untouched
    p1_fresh = db.session.get(Product, p1_id)
    assert p1_fresh.stock_quantity == initial_stock

    # Terminal State Invariant: Cannot receive cancelled purchase (400)
    res_rec = client.post(
        f"/api/purchases/{purchase_id}/receive",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_rec.status_code == 400
    assert res_rec.get_json()["error"]["code"] == "PURCHASE_CANCELLED"

    # Cannot cancel twice (400)
    res_can2 = client.post(
        f"/api/purchases/{purchase_id}/cancel",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_can2.status_code == 400
    assert res_can2.get_json()["error"]["code"] == "PURCHASE_ALREADY_CANCELLED"


def test_cannot_receive_empty_purchase(client, setup_data):
    """Attempting to receive a purchase with no line items must fail with 400."""
    owner_token = get_token_for_role(client, "OWNER")

    res_create = client.post(
        "/api/purchases",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"supplier_id": setup_data["supplier_id"]},
    )
    purchase_id = res_create.get_json()["data"]["id"]

    res_rec = client.post(
        f"/api/purchases/{purchase_id}/receive",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_rec.status_code == 400
    assert res_rec.get_json()["error"]["code"] == "EMPTY_PURCHASE"
