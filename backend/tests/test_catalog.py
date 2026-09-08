from decimal import Decimal
import pytest
from sqlalchemy import select
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Role
from app.modules.categories.models import Category
from app.modules.products.models import Product
from app.modules.users.models import User


def get_token_for_role(client, role_name):
    email = f"catalog_{role_name.lower()}@test.com"
    role = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one()
    user = db.session.execute(select(User).filter_by(email=email)).scalar_one_or_none()
    if not user:
        user = User(
            role_id=role.id,
            first_name="Catalog",
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
def cleanup_catalog_data(app):
    def clean():
        with app.app_context():
            from app.modules.purchasing.models import PurchaseItem, Purchase
            from app.modules.sales.models import Sale, SaleItem, Payment
            from app.modules.inventory.models import StockMovement
            AuditLog.query.filter(AuditLog.entity_type.in_(["Product", "Category", "Purchase", "StockMovement", "Sale"])).delete()
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


# ==============================================================================
# Category Tests
# ==============================================================================

def test_category_crud_and_rbac(client):
    owner_token = get_token_for_role(client, "OWNER")
    cashier_token = get_token_for_role(client, "CASHIER")
    staff_token = get_token_for_role(client, "STAFF")

    # 1. CASHIER and STAFF cannot create category (403)
    res_cashier = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {cashier_token}"},
        json={"name": "Cashier Cat"},
    )
    assert res_cashier.status_code == 403

    res_staff = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"name": "Staff Cat"},
    )
    assert res_staff.status_code == 403

    # 2. OWNER creates category (201)
    res_owner = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "Fresh Produce", "description": "Fruits and vegetables"},
    )
    assert res_owner.status_code == 201
    cat_id = res_owner.get_json()["category"]["id"]
    assert res_owner.get_json()["category"]["name"] == "Fresh Produce"
    assert res_owner.get_json()["category"]["is_active"] is True

    # 3. Duplicate category rejection (case-insensitive collision e.g. "fresh produce")
    res_dup = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "  fresh produce  "},
    )
    assert res_dup.status_code == 409
    assert res_dup.get_json()["error"]["code"] == "CATEGORY_NAME_EXISTS"

    # 5. Blank category name rejection (400)
    res_blank = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "   "},
    )
    assert res_blank.status_code == 400
    assert res_blank.get_json()["error"]["code"] == "VALIDATION_ERROR"

    # 6. Read category (all roles permitted)
    res_get = client.get(
        f"/api/categories/{cat_id}",
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res_get.status_code == 200
    assert res_get.get_json()["category"]["name"] == "Fresh Produce"

    # 7. Category not found (404)
    res_404 = client.get(
        "/api/categories/999999",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_404.status_code == 404
    assert res_404.get_json()["error"]["code"] == "CATEGORY_NOT_FOUND"

    # 8. Update category (200)
    res_update = client.patch(
        f"/api/categories/{cat_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "Organic Fresh Produce", "description": "Farm-to-table organic goods"},
    )
    assert res_update.status_code == 200
    assert res_update.get_json()["category"]["name"] == "Organic Fresh Produce"

    # 9. Deactivate category status (200)
    res_deact = client.patch(
        f"/api/categories/{cat_id}/status",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": False},
    )
    assert res_deact.status_code == 200
    assert res_deact.get_json()["category"]["is_active"] is False

    # 10. List categories with search and pagination
    res_list = client.get(
        "/api/categories?search=Organic&page=1&per_page=10",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_list.status_code == 200
    list_data = res_list.get_json()
    assert "items" in list_data
    assert "pagination" in list_data
    assert len(list_data["items"]) >= 1
    assert any(c["id"] == cat_id for c in list_data["items"])


# ==============================================================================
# Product Tests
# ==============================================================================

def test_product_crud_and_validations(client):
    owner_token = get_token_for_role(client, "OWNER")
    cashier_token = get_token_for_role(client, "CASHIER")
    staff_token = get_token_for_role(client, "STAFF")

    # Create active and inactive categories for testing
    cat_active_res = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "Beverages Category Active"},
    )
    cat_active_id = cat_active_res.get_json()["category"]["id"]

    cat_inactive_res = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "Beverages Category Inactive"},
    )
    cat_inactive_id = cat_inactive_res.get_json()["category"]["id"]
    client.patch(
        f"/api/categories/{cat_inactive_id}/status",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": False},
    )

    # 1. CASHIER/STAFF cannot create product (403)
    res_cashier_prod = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {cashier_token}"},
        json={"category_id": cat_active_id, "name": "Juice", "sku": "BEV-JUC-1"},
    )
    assert res_cashier_prod.status_code == 403

    # 2. Reject creating product with inactive category (400)
    res_inact_cat = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "category_id": cat_inactive_id,
            "name": "Orange Soda",
            "sku": "BEV-SODA-01",
            "cost_price": "20.00",
            "selling_price": "30.00",
        },
    )
    assert res_inact_cat.status_code == 400
    assert res_inact_cat.get_json()["error"]["code"] == "CATEGORY_INACTIVE"

    # 3. Reject creating product with non-existent category (404)
    res_missing_cat = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "category_id": 999999,
            "name": "Ghost Soda",
            "sku": "BEV-GHOST-01",
        },
    )
    assert res_missing_cat.status_code == 404
    assert res_missing_cat.get_json()["error"]["code"] == "CATEGORY_NOT_FOUND"

    # 4. Strict Stock Immutability: Reject stock_quantity in creation payload (400)
    res_stock_inject = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "category_id": cat_active_id,
            "name": "Hacked Stock Item",
            "sku": "HACK-001",
            "stock_quantity": "500.000",
        },
    )
    assert res_stock_inject.status_code == 400
    assert res_stock_inject.get_json()["error"]["code"] == "VALIDATION_ERROR"
    assert "stock_quantity" in res_stock_inject.get_json()["error"]["message"]

    # 5. Successful product creation (201)
    res_create = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "category_id": cat_active_id,
            "name": "Sparkling Apple Juice 1L",
            "sku": "bev-apple-1l",  # lowercase will be normalized to BEV-APPLE-1L
            "barcode": "4800099881122",
            "description": "Crisp sparkling apple juice",
            "unit": "bottle",
            "cost_price": "45.50",
            "selling_price": "65.00",
            "reorder_level": "20.000",
        },
    )
    assert res_create.status_code == 201
    prod = res_create.get_json()["product"]
    prod_id = prod["id"]
    assert prod["sku"] == "BEV-APPLE-1L"
    assert prod["barcode"] == "4800099881122"
    assert prod["stock_quantity"] == "0.000"  # Authoritative initial stock is 0
    assert prod["cost_price"] == "45.50"
    assert prod["selling_price"] == "65.00"
    assert prod["reorder_level"] == "20.000"
    assert prod["category"]["name"] == "Beverages Category Active"

    # 6. SKU duplicate rejection & case collision (409)
    res_dup_sku = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "category_id": cat_active_id,
            "name": "Duplicate Apple Juice",
            "sku": "  bev-apple-1l  ",  # normalized collision
            "cost_price": "40.00",
            "selling_price": "60.00",
        },
    )
    assert res_dup_sku.status_code == 409
    assert res_dup_sku.get_json()["error"]["code"] == "PRODUCT_SKU_EXISTS"

    # 7. Barcode duplicate rejection (409)
    res_dup_barcode = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "category_id": cat_active_id,
            "name": "Different Drink Same Barcode",
            "sku": "DIFF-DRINK-01",
            "barcode": "4800099881122",
        },
    )
    assert res_dup_barcode.status_code == 409
    assert res_dup_barcode.get_json()["error"]["code"] == "PRODUCT_BARCODE_EXISTS"

    # 8. Nullable barcodes allowed for multiple products
    res_nobar1 = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"category_id": cat_active_id, "name": "No Barcode 1", "sku": "NOBAR-01", "barcode": ""},
    )
    assert res_nobar1.status_code == 201
    assert res_nobar1.get_json()["product"]["barcode"] is None

    res_nobar2 = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"category_id": cat_active_id, "name": "No Barcode 2", "sku": "NOBAR-02", "barcode": None},
    )
    assert res_nobar2.status_code == 201
    assert res_nobar2.get_json()["product"]["barcode"] is None

    # 9. Negative price & reorder validations (400)
    res_neg_cost = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"category_id": cat_active_id, "name": "Neg", "sku": "NEG-01", "cost_price": "-10.00"},
    )
    assert res_neg_cost.status_code == 400
    assert res_neg_cost.get_json()["error"]["code"] == "VALIDATION_ERROR"

    res_neg_sell = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"category_id": cat_active_id, "name": "Neg", "sku": "NEG-02", "selling_price": "-5.00"},
    )
    assert res_neg_sell.status_code == 400

    res_neg_reorder = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"category_id": cat_active_id, "name": "Neg", "sku": "NEG-03", "reorder_level": "-1.000"},
    )
    assert res_neg_reorder.status_code == 400

    # 10. Blank name & blank unit validation (400)
    res_blank_name = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"category_id": cat_active_id, "name": "  ", "sku": "BLANK-NAME"},
    )
    assert res_blank_name.status_code == 400

    res_blank_unit = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"category_id": cat_active_id, "name": "Valid", "sku": "BLANK-UNIT", "unit": "  "},
    )
    assert res_blank_unit.status_code == 400

    # 11. Partial product update (200) & price audit
    res_update_price = client.patch(
        f"/api/products/{prod_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"selling_price": "70.00", "reorder_level": "25.000"},
    )
    assert res_update_price.status_code == 200
    updated_prod = res_update_price.get_json()["product"]
    assert updated_prod["selling_price"] == "70.00"
    assert updated_prod["reorder_level"] == "25.000"

    # 12. Reject stock_quantity in update payload (400)
    res_update_stock = client.patch(
        f"/api/products/{prod_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"stock_quantity": "100.000"},
    )
    assert res_update_stock.status_code == 400
    assert res_update_stock.get_json()["error"]["code"] == "VALIDATION_ERROR"

    # 13. Deactivate product status (200)
    res_status = client.patch(
        f"/api/products/{prod_id}/status",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": False},
    )
    assert res_status.status_code == 200
    assert res_status.get_json()["product"]["is_active"] is False

    # 14. List products with search, sorting, and pagination
    # Search by name
    res_search_name = client.get(
        "/api/products?search=Sparkling&sort_by=selling_price&sort_order=desc",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_search_name.status_code == 200
    assert len(res_search_name.get_json()["items"]) >= 1

    # Search by SKU
    res_search_sku = client.get(
        "/api/products?search=BEV-APPLE",
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res_search_sku.status_code == 200
    assert any(p["sku"] == "BEV-APPLE-1L" for p in res_search_sku.get_json()["items"])

    # Search by barcode
    res_search_bar = client.get(
        "/api/products?search=4800099881122",
        headers={"Authorization": f"Bearer {cashier_token}"},
    )
    assert res_search_bar.status_code == 200
    assert any(p["barcode"] == "4800099881122" for p in res_search_bar.get_json()["items"])


# ==============================================================================
# Audit Log Tests
# ==============================================================================

def test_catalog_audit_logging(client, app):
    owner_token = get_token_for_role(client, "OWNER")

    # Create Category
    cat_res = client.post(
        "/api/categories",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "Audit Test Category"},
    )
    cat_id = cat_res.get_json()["category"]["id"]

    # Update Category
    client.patch(
        f"/api/categories/{cat_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"description": "Updated Description"},
    )

    # Change Category Status
    client.patch(
        f"/api/categories/{cat_id}/status",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": False},
    )

    # Create Product
    prod_res = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "category_id": cat_id,
            "name": "Audit Test Product",
            "sku": "AUDIT-PROD-01",
            "cost_price": "10.00",
            "selling_price": "15.00",
        },
    )
    # Since category is inactive, creation fails:
    assert prod_res.status_code == 400

    # Reactivate category
    client.patch(
        f"/api/categories/{cat_id}/status",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": True},
    )

    # Create Product successfully
    prod_res = client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "category_id": cat_id,
            "name": "Audit Test Product",
            "sku": "AUDIT-PROD-01",
            "cost_price": "10.00",
            "selling_price": "15.00",
        },
    )
    prod_id = prod_res.get_json()["product"]["id"]

    # Update Product Price
    client.patch(
        f"/api/products/{prod_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"selling_price": "18.50"},
    )

    # Change Product Status
    client.patch(
        f"/api/products/{prod_id}/status",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": False},
    )

    with app.app_context():
        # Verify Category Audits
        cat_audits = db.session.execute(
            select(AuditLog).filter_by(entity_type="Category", entity_id=cat_id)
        ).scalars().all()
        cat_actions = [a.action for a in cat_audits]
        assert "CATEGORY_CREATED" in cat_actions
        assert "CATEGORY_UPDATED" in cat_actions
        assert "CATEGORY_STATUS_CHANGED" in cat_actions

        # Verify Product Audits
        prod_audits = db.session.execute(
            select(AuditLog).filter_by(entity_type="Product", entity_id=prod_id)
        ).scalars().all()
        prod_actions = [a.action for a in prod_audits]
        assert "PRODUCT_CREATED" in prod_actions
        assert "PRODUCT_UPDATED" in prod_actions
        assert "PRODUCT_STATUS_CHANGED" in prod_actions

        # Verify price change was explicitly logged in description
        price_audit = next(a for a in prod_audits if a.action == "PRODUCT_UPDATED")
        assert "Price changed" in price_audit.description
        assert "18.50" in price_audit.description
