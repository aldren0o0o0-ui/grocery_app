from decimal import Decimal
import pytest
from sqlalchemy import select
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Role
from app.modules.categories.models import Category
from app.modules.inventory.models import StockMovement
from app.modules.inventory.services import InventoryService
from app.modules.products.models import Product
from app.modules.users.models import User


def get_inventory_token_for_role(client, role_name):
    email = f"inv_{role_name.lower()}@test.com"
    role = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one()
    user = db.session.execute(select(User).filter_by(email=email)).scalar_one_or_none()
    if not user:
        user = User(
            role_id=role.id,
            first_name="Inventory",
            last_name=role_name,
            email=email,
            password_hash=generate_password_hash("Password123"),
            is_active=True,
        )
        db.session.add(user)
        db.session.commit()

    res = client.post("/api/auth/login", json={"email": email, "password": "Password123"})
    return res.get_json()["access_token"]


@pytest.fixture(autouse=True)
def cleanup_inventory_data(app):
    def clean():
        with app.app_context():
            from app.modules.purchasing.models import PurchaseItem, Purchase
            from app.modules.sales.models import Sale, SaleItem, Payment
            AuditLog.query.filter(AuditLog.entity_type.in_(["Product", "Category", "StockMovement", "Purchase", "Sale"])).delete()
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


def setup_sample_inventory(client):
    """Sets up standard category and products for testing."""
    cat = Category(name="Produce & Staples", description="Fresh produce and dry pantry goods", is_active=True)
    db.session.add(cat)
    db.session.commit()

    # Product 1: In stock (stock 25 > reorder 10)
    p1 = Product(
        category_id=cat.id,
        name="Jasmine Rice 5kg",
        sku="RICE-JAS-5K",
        barcode="8850123456789",
        unit="bag",
        cost_price=Decimal("8.50"),
        selling_price=Decimal("12.00"),
        stock_quantity=Decimal("25.000"),
        reorder_level=Decimal("10.000"),
        is_active=True,
    )
    # Product 2: Low stock (stock 5 <= reorder 10)
    p2 = Product(
        category_id=cat.id,
        name="Brown Sugar 1kg",
        sku="SUGAR-BRN-1K",
        barcode="8850987654321",
        unit="pack",
        cost_price=Decimal("1.80"),
        selling_price=Decimal("2.50"),
        stock_quantity=Decimal("5.000"),
        reorder_level=Decimal("10.000"),
        is_active=True,
    )
    # Product 3: Out of stock (stock 0, reorder 5)
    p3 = Product(
        category_id=cat.id,
        name="Cooking Oil 1L",
        sku="OIL-COOK-1L",
        barcode="8851122334455",
        unit="bottle",
        cost_price=Decimal("3.00"),
        selling_price=Decimal("4.50"),
        stock_quantity=Decimal("0.000"),
        reorder_level=Decimal("5.000"),
        is_active=True,
    )
    # Product 4: Positive stock but reorder level zero (should be IN_STOCK, NOT low stock)
    p4 = Product(
        category_id=cat.id,
        name="Table Salt 500g",
        sku="SALT-TBL-500G",
        barcode=None,
        unit="pack",
        cost_price=Decimal("0.50"),
        selling_price=Decimal("0.99"),
        stock_quantity=Decimal("15.000"),
        reorder_level=Decimal("0.000"),
        is_active=True,
    )
    # Product 5: Inactive product
    p5 = Product(
        category_id=cat.id,
        name="Discontinued Flour",
        sku="FLOUR-DISC-1K",
        barcode=None,
        unit="pack",
        cost_price=Decimal("1.00"),
        selling_price=Decimal("1.50"),
        stock_quantity=Decimal("2.000"),
        reorder_level=Decimal("5.000"),
        is_active=False,
    )

    db.session.add_all([p1, p2, p3, p4, p5])
    db.session.commit()

    return {"cat": cat, "p1": p1, "p2": p2, "p3": p3, "p4": p4, "p5": p5}


# ==============================================================================
# 1. Read Operations & Query Filters Tests
# ==============================================================================

def test_inventory_list_and_pagination(client):
    data = setup_sample_inventory(client)
    token = get_inventory_token_for_role(client, "CASHIER")

    # List inventory (per_page = 2)
    res = client.get(
        "/api/inventory?page=1&per_page=2",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data["status"] == "success"
    assert len(json_data["data"]["items"]) == 2
    assert json_data["data"]["pagination"]["total"] == 5
    assert json_data["data"]["pagination"]["pages"] == 3


def test_inventory_search_and_filters(client):
    data = setup_sample_inventory(client)
    token = get_inventory_token_for_role(client, "STAFF")

    # Search by SKU
    res = client.get(
        "/api/inventory?search=RICE",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    items = res.get_json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["product"]["sku"] == "RICE-JAS-5K"

    # Search by barcode
    res_bc = client.get(
        "/api/inventory?search=8850987654321",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_bc.status_code == 200
    assert len(res_bc.get_json()["data"]["items"]) == 1
    assert res_bc.get_json()["data"]["items"][0]["product"]["sku"] == "SUGAR-BRN-1K"

    # Filter active only
    res_active = client.get(
        "/api/inventory?is_active=true",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_active.status_code == 200
    assert res_active.get_json()["data"]["pagination"]["total"] == 4

    # Filter inactive only
    res_inactive = client.get(
        "/api/inventory?is_active=false",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_inactive.status_code == 200
    assert res_inactive.get_json()["data"]["pagination"]["total"] == 1
    assert res_inactive.get_json()["data"]["items"][0]["product"]["sku"] == "FLOUR-DISC-1K"


def test_inventory_stock_status_filter_and_reorder_zero(client):
    data = setup_sample_inventory(client)
    token = get_inventory_token_for_role(client, "OWNER")

    # 1. OUT_OF_STOCK filter
    res_oos = client.get(
        "/api/inventory?stock_status=OUT_OF_STOCK",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_oos.status_code == 200
    oos_items = res_oos.get_json()["data"]["items"]
    assert len(oos_items) == 1
    assert oos_items[0]["product"]["sku"] == "OIL-COOK-1L"
    assert oos_items[0]["is_out_of_stock"] is True

    # 2. LOW_STOCK filter (should include SUGAR-BRN-1K and FLOUR-DISC-1K, but NOT SALT-TBL-500G with reorder 0)
    res_low = client.get(
        "/api/inventory?stock_status=LOW_STOCK",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_low.status_code == 200
    low_items = res_low.get_json()["data"]["items"]
    skus = [item["product"]["sku"] for item in low_items]
    assert "SUGAR-BRN-1K" in skus
    assert "FLOUR-DISC-1K" in skus
    assert "SALT-TBL-500G" not in skus  # Reorder level is 0 -> positive stock is IN_STOCK

    # 3. IN_STOCK filter (includes RICE-JAS-5K and SALT-TBL-500G)
    res_in = client.get(
        "/api/inventory?stock_status=IN_STOCK",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_in.status_code == 200
    in_items = res_in.get_json()["data"]["items"]
    in_skus = [item["product"]["sku"] for item in in_items]
    assert "RICE-JAS-5K" in in_skus
    assert "SALT-TBL-500G" in in_skus


def test_inventory_detail_and_not_found(client):
    data = setup_sample_inventory(client)
    token = get_inventory_token_for_role(client, "OWNER")

    # Existing product
    res = client.get(
        f"/api/inventory/{data['p1'].id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.get_json()["data"]["product"]["sku"] == "RICE-JAS-5K"
    assert res.get_json()["data"]["stock_quantity"] == "25.000"

    # Non-existent product
    res_404 = client.get(
        "/api/inventory/999999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_404.status_code == 404
    assert res_404.get_json()["error"]["code"] == "PRODUCT_NOT_FOUND"


def test_low_stock_endpoint(client):
    data = setup_sample_inventory(client)
    token = get_inventory_token_for_role(client, "OWNER")

    # Default includes out of stock
    res = client.get(
        "/api/inventory/low-stock?include_out_of_stock=true",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    items = res.get_json()["data"]["items"]
    skus = [i["product"]["sku"] for i in items]
    assert "OIL-COOK-1L" in skus  # stock 0, reorder 5
    assert "SUGAR-BRN-1K" in skus  # stock 5, reorder 10

    # Exclude out of stock
    res_no_oos = client.get(
        "/api/inventory/low-stock?include_out_of_stock=false",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_no_oos.status_code == 200
    no_oos_items = res_no_oos.get_json()["data"]["items"]
    no_oos_skus = [i["product"]["sku"] for i in no_oos_items]
    assert "OIL-COOK-1L" not in no_oos_skus
    assert "SUGAR-BRN-1K" in no_oos_skus


# ==============================================================================
# 2. Stock Adjustment & RBAC Tests
# ==============================================================================

def test_manual_adjustment_in_succeeds_for_owner(client):
    data = setup_sample_inventory(client)
    owner_token = get_inventory_token_for_role(client, "OWNER")

    p = data["p1"]  # Initial stock: 25.000

    # OWNER adds 10.000 units
    res1 = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "product_id": p.id,
            "direction": "IN",
            "quantity": "10.000",
            "reason": "PHYSICAL_COUNT",
            "remarks": "Warehouse stocktake recount",
        },
    )
    assert res1.status_code == 201
    mov1 = res1.get_json()["data"]
    assert mov1["movement_type"] == "ADJUSTMENT_IN"
    assert mov1["quantity"] == "10.000"
    assert mov1["quantity_before"] == "25.000"
    assert mov1["quantity_after"] == "35.000"

    # OWNER adds 5.250 units
    res2 = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "product_id": p.id,
            "direction": "IN",
            "quantity": "5.250",
            "reason": "CORRECTION",
            "remarks": "Received extra pack",
        },
    )
    assert res2.status_code == 201
    mov2 = res2.get_json()["data"]
    assert mov2["movement_type"] == "ADJUSTMENT_IN"
    assert mov2["quantity"] == "5.250"
    assert mov2["quantity_before"] == "35.000"
    assert mov2["quantity_after"] == "40.250"

    # Verify updated product stock
    updated_p = db.session.get(Product, p.id)
    assert updated_p.stock_quantity == Decimal("40.250")


def test_manual_adjustment_out_succeeds_and_maps_reasons(client):
    data = setup_sample_inventory(client)
    owner_token = get_inventory_token_for_role(client, "OWNER")

    p = data["p1"]  # Initial stock: 25.000

    # 1. Deduct with reason DAMAGED -> movement_type DAMAGED
    res_dam = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "product_id": p.id,
            "direction": "OUT",
            "quantity": "2.000",
            "reason": "DAMAGED",
            "remarks": "Bag torn during transit",
        },
    )
    assert res_dam.status_code == 201
    mov_dam = res_dam.get_json()["data"]
    assert mov_dam["movement_type"] == "DAMAGED"
    assert mov_dam["quantity_before"] == "25.000"
    assert mov_dam["quantity_after"] == "23.000"

    # 2. Deduct with reason EXPIRED -> movement_type EXPIRED
    res_exp = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "product_id": p.id,
            "direction": "OUT",
            "quantity": "1.000",
            "reason": "EXPIRED",
            "remarks": "Passed best-before date",
        },
    )
    assert res_exp.status_code == 201
    mov_exp = res_exp.get_json()["data"]
    assert mov_exp["movement_type"] == "EXPIRED"
    assert mov_exp["quantity_before"] == "23.000"
    assert mov_exp["quantity_after"] == "22.000"

    # 3. Deduct with reason PHYSICAL_COUNT -> movement_type ADJUSTMENT_OUT
    res_out = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "product_id": p.id,
            "direction": "OUT",
            "quantity": "3.000",
            "reason": "PHYSICAL_COUNT",
            "remarks": "Count shortage",
        },
    )
    assert res_out.status_code == 201
    mov_out = res_out.get_json()["data"]
    assert mov_out["movement_type"] == "ADJUSTMENT_OUT"
    assert mov_out["quantity_before"] == "22.000"
    assert mov_out["quantity_after"] == "19.000"


def test_cashier_and_staff_cannot_perform_adjustments(client):
    data = setup_sample_inventory(client)
    cashier_token = get_inventory_token_for_role(client, "CASHIER")
    staff_token = get_inventory_token_for_role(client, "STAFF")

    payload = {
        "product_id": data["p1"].id,
        "direction": "IN",
        "quantity": "5.000",
        "reason": "PHYSICAL_COUNT",
    }

    # CASHIER forbidden (403)
    res_c = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {cashier_token}"},
        json=payload,
    )
    assert res_c.status_code == 403

    # STAFF forbidden (403)
    res_s = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {staff_token}"},
        json=payload,
    )
    assert res_s.status_code == 403


def test_adjustment_validation_failures(client):
    data = setup_sample_inventory(client)
    token = get_inventory_token_for_role(client, "OWNER")
    p_id = data["p1"].id

    # 1. Zero quantity
    res_zero = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {token}"},
        json={"product_id": p_id, "direction": "IN", "quantity": "0.000", "reason": "CORRECTION"},
    )
    assert res_zero.status_code == 400
    assert res_zero.get_json()["error"]["code"] == "INVALID_QUANTITY"

    # 2. Negative quantity
    res_neg = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {token}"},
        json={"product_id": p_id, "direction": "IN", "quantity": "-5.000", "reason": "CORRECTION"},
    )
    assert res_neg.status_code == 400
    assert res_neg.get_json()["error"]["code"] == "INVALID_QUANTITY"

    # 3. Non-numeric quantity
    res_nan = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {token}"},
        json={"product_id": p_id, "direction": "IN", "quantity": "five", "reason": "CORRECTION"},
    )
    assert res_nan.status_code == 400
    assert res_nan.get_json()["error"]["code"] == "INVALID_QUANTITY"

    # 4. Invalid direction
    res_dir = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {token}"},
        json={"product_id": p_id, "direction": "SIDEWAYS", "quantity": "5.000", "reason": "CORRECTION"},
    )
    assert res_dir.status_code == 400
    assert res_dir.get_json()["error"]["code"] == "INVALID_ADJUSTMENT_DIRECTION"

    # 5. Invalid reason
    res_rsn = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {token}"},
        json={"product_id": p_id, "direction": "IN", "quantity": "5.000", "reason": "LOST_IN_SPACE"},
    )
    assert res_rsn.status_code == 400
    assert res_rsn.get_json()["error"]["code"] == "INVALID_ADJUSTMENT_REASON"


def test_insufficient_stock_rejected_cleanly(client):
    data = setup_sample_inventory(client)
    token = get_inventory_token_for_role(client, "OWNER")

    p = data["p2"]  # Available stock: 5.000

    # Attempt to deduct 7.000 units
    res = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "product_id": p.id,
            "direction": "OUT",
            "quantity": "7.000",
            "reason": "PHYSICAL_COUNT",
        },
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "INSUFFICIENT_STOCK"

    # Assert stock remains completely unchanged
    p_unchanged = db.session.get(Product, p.id)
    assert p_unchanged.stock_quantity == Decimal("5.000")

    # Assert no movement was created
    movements = StockMovement.query.filter_by(product_id=p.id).all()
    assert len(movements) == 0


# ==============================================================================
# 3. Ledger Integrity & Consistency Tests
# ==============================================================================

def test_stock_movement_ledger_integrity_and_audit_logging(client):
    data = setup_sample_inventory(client)
    token = get_inventory_token_for_role(client, "OWNER")
    p = data["p1"]

    # Perform adjustment
    res = client.post(
        "/api/inventory/adjustments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "product_id": p.id,
            "direction": "IN",
            "quantity": "12.750",
            "reason": "PHYSICAL_COUNT",
            "remarks": "Container arrival recount",
        },
    )
    assert res.status_code == 201
    movement_id = res.get_json()["data"]["id"]

    # 1. Verify movements history endpoint
    res_mov = client.get(
        f"/api/inventory/{p.id}/movements",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_mov.status_code == 200
    items = res_mov.get_json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["id"] == movement_id
    assert items[0]["quantity"] == "12.750"
    assert items[0]["created_by"]["email"] == "inv_owner@test.com"

    # 2. Check consistency helper
    consistency = InventoryService.verify_inventory_consistency(p.id)
    assert consistency["is_consistent"] is True
    assert consistency["product_stock"] == consistency["ledger_latest_after"]

    # 3. Check audit log
    audit = AuditLog.query.filter_by(entity_type="Product", entity_id=p.id).first()
    assert audit is not None
    assert audit.action == "INVENTORY_ADJUSTED_IN"
    assert "12.750" in audit.description


def test_product_crud_cannot_modify_stock_quantity(client):
    data = setup_sample_inventory(client)
    token = get_inventory_token_for_role(client, "OWNER")
    p = data["p1"]

    # Attempt to modify stock_quantity via Product update PATCH
    res = client.patch(
        f"/api/products/{p.id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"stock_quantity": 999},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "VALIDATION_ERROR"
