from datetime import date
from decimal import Decimal
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.modules.auth.models import Role
from app.modules.users.models import User
from app.modules.categories.models import Category
from app.modules.products.models import Product
from app.modules.suppliers.models import Supplier
from app.modules.inventory.models import StockMovement, StockMovementType
from app.modules.purchasing.models import Purchase, PurchaseItem, PurchaseStatus
from app.modules.sales.models import Sale, SaleItem, Payment, SaleStatus, PaymentMethod
from app.modules.expenses.models import ExpenseCategory, Expense
from app.modules.audit.models import AuditLog


def test_role_and_user_creation(db_session):
    # Verify role exists (from seeds or new)
    role = db_session.execute(
        select(Role).filter_by(name="ADMIN")
    ).scalar_one_or_none()
    if not role:
        role = Role(name="ADMIN", description="Administrator")
        db_session.add(role)
        db_session.flush()

    user = User(
        role_id=role.id,
        first_name="Juan",
        last_name="Dela Cruz",
        email="JUAN.DELACRUZ@example.com",  # Should normalize to lower
        password_hash="argon2_hashed_secret",
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    assert user.id is not None
    assert user.email == "juan.delacruz@example.com"
    assert user.role.name == "ADMIN"
    assert user in role.users


def test_category_and_product_relationships(db_session):
    category = Category(name="Beverages", description="Soft drinks and juices")
    db_session.add(category)
    db_session.flush()

    product = Product(
        category_id=category.id,
        name="Cola 1.5L",
        sku="BEV-COLA-15L",
        barcode="4800016644011",
        description="Refreshing carbonated cola",
        unit="bottle",
        cost_price=Decimal("45.00"),
        selling_price=Decimal("65.00"),
        stock_quantity=Decimal("120.000"),
        reorder_level=Decimal("24.000"),
        is_active=True,
    )
    db_session.add(product)
    db_session.flush()

    assert product.id is not None
    assert product.category.name == "Beverages"
    assert product in category.products


def test_supplier_purchase_and_purchase_items(db_session):
    # Setup dependencies
    role = db_session.execute(select(Role).filter_by(name="OWNER")).scalar_one()
    user = User(
        role_id=role.id,
        first_name="Maria",
        last_name="Clara",
        email="maria.clara@example.com",
        password_hash="hashed_pw",
    )
    category = Category(name="Grains")
    db_session.add_all([user, category])
    db_session.flush()

    product = Product(
        category_id=category.id,
        name="Sinandomeng Rice 25kg",
        sku="GRAIN-RICE-25K",
        unit="sack",
        cost_price=Decimal("1100.00"),
        selling_price=Decimal("1300.00"),
        stock_quantity=Decimal("10.000"),
    )
    supplier = Supplier(
        name="Golden Harvest Trading",
        contact_person="Pedro Penduko",
        phone="09171234567",
        email="pedro@goldenharvest.com",
    )
    db_session.add_all([product, supplier])
    db_session.flush()

    purchase = Purchase(
        supplier_id=supplier.id,
        reference_number="PO-2026-0001",
        purchase_date=date(2026, 9, 7),
        status=PurchaseStatus.RECEIVED.value,
        total_amount=Decimal("11000.00"),
        created_by=user.id,
    )
    db_session.add(purchase)
    db_session.flush()

    purchase_item = PurchaseItem(
        purchase_id=purchase.id,
        product_id=product.id,
        quantity=Decimal("10.000"),
        unit_cost=Decimal("1100.00"),
        subtotal=Decimal("11000.00"),
    )
    db_session.add(purchase_item)
    db_session.flush()

    assert purchase.supplier.name == "Golden Harvest Trading"
    assert purchase.creator.email == "maria.clara@example.com"
    assert len(purchase.items) == 1
    assert purchase.items[0].product.sku == "GRAIN-RICE-25K"


def test_stock_movement_ledger(db_session):
    role = db_session.execute(select(Role).filter_by(name="STAFF")).scalar_one()
    user = User(
        role_id=role.id,
        first_name="Staff",
        last_name="Member",
        email="staff.test@example.com",
        password_hash="pw",
    )
    category = Category(name="Produce")
    db_session.add_all([user, category])
    db_session.flush()

    product = Product(
        category_id=category.id,
        name="Fresh Red Onions",
        sku="PROD-ONION-KG",
        unit="kg",
        cost_price=Decimal("90.00"),
        selling_price=Decimal("140.00"),
        stock_quantity=Decimal("50.500"),
    )
    db_session.add(product)
    db_session.flush()

    movement = StockMovement(
        product_id=product.id,
        movement_type=StockMovementType.ADJUSTMENT_IN.value,
        quantity=Decimal("20.250"),
        quantity_before=Decimal("30.250"),
        quantity_after=Decimal("50.500"),
        reference_type="INVENTORY_COUNT",
        reference_id=1,
        remarks="Physical count reconciliation",
        created_by=user.id,
    )
    db_session.add(movement)
    db_session.flush()

    assert movement.id is not None
    assert movement.product.sku == "PROD-ONION-KG"
    assert movement.creator.email == "staff.test@example.com"
    assert movement in product.stock_movements


def test_sales_and_payments(db_session):
    role = db_session.execute(select(Role).filter_by(name="CASHIER")).scalar_one()
    cashier = User(
        role_id=role.id,
        first_name="Cashier",
        last_name="One",
        email="cashier.one@example.com",
        password_hash="pw",
    )
    category = Category(name="Canned Goods")
    db_session.add_all([cashier, category])
    db_session.flush()

    product = Product(
        category_id=category.id,
        name="Corned Beef 150g",
        sku="CAN-CB-150",
        unit="can",
        cost_price=Decimal("38.00"),
        selling_price=Decimal("52.00"),
        stock_quantity=Decimal("100.000"),
    )
    db_session.add(product)
    db_session.flush()

    sale = Sale(
        invoice_number="INV-2026-0001",
        cashier_id=cashier.id,
        subtotal=Decimal("104.00"),
        discount=Decimal("4.00"),
        total=Decimal("100.00"),
        status=SaleStatus.COMPLETED.value,
    )
    db_session.add(sale)
    db_session.flush()

    sale_item = SaleItem(
        sale_id=sale.id,
        product_id=product.id,
        quantity=Decimal("2.000"),
        unit_price=Decimal("52.00"),
        cost_price=Decimal("38.00"),
        subtotal=Decimal("104.00"),
    )
    payment = Payment(
        sale_id=sale.id,
        payment_method=PaymentMethod.CASH.value,
        amount_paid=Decimal("200.00"),
        change_amount=Decimal("100.00"),
    )
    db_session.add_all([sale_item, payment])
    db_session.flush()

    assert sale.cashier.email == "cashier.one@example.com"
    assert len(sale.items) == 1
    assert sale.items[0].product.name == "Corned Beef 150g"
    assert len(sale.payments) == 1
    assert sale.payments[0].amount_paid == Decimal("200.00")
    assert sale.payments[0].change_amount == Decimal("100.00")


def test_expenses_and_audit_logs(db_session):
    role = db_session.execute(select(Role).filter_by(name="ADMIN")).scalar_one()
    user = User(
        role_id=role.id,
        first_name="Admin",
        last_name="User",
        email="admin.expenses@example.com",
        password_hash="pw",
    )
    exp_category = ExpenseCategory(name="Utilities", description="Electricity, water, internet")
    db_session.add_all([user, exp_category])
    db_session.flush()

    expense = Expense(
        category_id=exp_category.id,
        amount=Decimal("3500.50"),
        description="Meralco electricity bill for August",
        expense_date=date(2026, 9, 5),
        created_by=user.id,
    )
    db_session.add(expense)
    db_session.flush()

    audit = AuditLog(
        user_id=user.id,
        action="CREATE_EXPENSE",
        entity_type="Expense",
        entity_id=expense.id,
        description="Recorded utility bill payment",
    )
    db_session.add(audit)
    db_session.flush()

    assert expense.category.name == "Utilities"
    assert expense.creator.email == "admin.expenses@example.com"
    assert audit.user.email == "admin.expenses@example.com"


# ==============================================================================
# Database Constraint Failure Tests
# ==============================================================================

def test_constraint_negative_product_cost_price(db_session):
    category = Category(name="Snacks")
    db_session.add(category)
    db_session.flush()

    with db_session.begin_nested():
        product = Product(
            category_id=category.id,
            name="Chips",
            sku="SNK-CHIP-1",
            cost_price=Decimal("-10.00"),
            selling_price=Decimal("20.00"),
        )
        db_session.add(product)
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ck_products_cost_price_non_negative" in str(exc_info.value)


def test_constraint_negative_product_selling_price(db_session):
    category = Category(name="Dairy")
    db_session.add(category)
    db_session.flush()

    with db_session.begin_nested():
        product = Product(
            category_id=category.id,
            name="Milk",
            sku="DRY-MILK-1",
            cost_price=Decimal("50.00"),
            selling_price=Decimal("-5.00"),
        )
        db_session.add(product)
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ck_products_selling_price_non_negative" in str(exc_info.value)


def test_constraint_negative_product_stock(db_session):
    category = Category(name="Bakery")
    db_session.add(category)
    db_session.flush()

    with db_session.begin_nested():
        product = Product(
            category_id=category.id,
            name="Bread",
            sku="BKY-BRD-1",
            cost_price=Decimal("30.00"),
            selling_price=Decimal("45.00"),
            stock_quantity=Decimal("-1.000"),
        )
        db_session.add(product)
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ck_products_stock_quantity_non_negative" in str(exc_info.value)


def test_constraint_duplicate_sku(db_session):
    category = Category(name="Condiments")
    db_session.add(category)
    db_session.flush()

    product1 = Product(
        category_id=category.id,
        name="Soy Sauce 500ml",
        sku="CON-SOY-500",
        cost_price=Decimal("20.00"),
        selling_price=Decimal("28.00"),
    )
    db_session.add(product1)
    db_session.flush()

    with db_session.begin_nested():
        product2 = Product(
            category_id=category.id,
            name="Another Soy Sauce",
            sku="CON-SOY-500",  # Duplicate SKU
            cost_price=Decimal("22.00"),
            selling_price=Decimal("30.00"),
        )
        db_session.add(product2)
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ix_products_sku" in str(exc_info.value) or "products_sku_key" in str(exc_info.value)


def test_constraint_duplicate_invoice_number(db_session):
    role = db_session.execute(select(Role).filter_by(name="CASHIER")).scalar_one()
    cashier = User(
        role_id=role.id,
        first_name="Cashier",
        last_name="Two",
        email="cashier.two@example.com",
        password_hash="pw",
    )
    db_session.add(cashier)
    db_session.flush()

    sale1 = Sale(
        invoice_number="INV-DUP-TEST",
        cashier_id=cashier.id,
        subtotal=Decimal("50.00"),
        total=Decimal("50.00"),
    )
    db_session.add(sale1)
    db_session.flush()

    with db_session.begin_nested():
        sale2 = Sale(
            invoice_number="INV-DUP-TEST",  # Duplicate invoice number
            cashier_id=cashier.id,
            subtotal=Decimal("70.00"),
            total=Decimal("70.00"),
        )
        db_session.add(sale2)
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ix_sales_invoice_number" in str(exc_info.value) or "sales_invoice_number_key" in str(exc_info.value)


def test_constraint_purchase_item_quantity_zero_or_negative(db_session):
    role = db_session.execute(select(Role).filter_by(name="OWNER")).scalar_one()
    user = User(
        role_id=role.id,
        first_name="User",
        last_name="Test",
        email="purchase.test@example.com",
        password_hash="pw",
    )
    supplier = Supplier(name="Test Supplier Co.")
    category = Category(name="Test Category")
    db_session.add_all([user, supplier, category])
    db_session.flush()

    product = Product(
        category_id=category.id,
        name="Test Product",
        sku="TEST-SKU-001",
        cost_price=Decimal("10.00"),
        selling_price=Decimal("15.00"),
    )
    purchase = Purchase(
        supplier_id=supplier.id,
        reference_number="PO-TEST-001",
        purchase_date=date(2026, 9, 7),
        created_by=user.id,
    )
    db_session.add_all([product, purchase])
    db_session.flush()

    with db_session.begin_nested():
        item = PurchaseItem(
            purchase_id=purchase.id,
            product_id=product.id,
            quantity=Decimal("0.000"),  # Invalid: quantity must be > 0
            unit_cost=Decimal("10.00"),
            subtotal=Decimal("0.00"),
        )
        db_session.add(item)
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ck_purchase_items_quantity_positive" in str(exc_info.value)


def test_constraint_sale_item_quantity_zero_or_negative(db_session):
    role = db_session.execute(select(Role).filter_by(name="CASHIER")).scalar_one()
    cashier = User(
        role_id=role.id,
        first_name="Cashier",
        last_name="Three",
        email="cashier.three@example.com",
        password_hash="pw",
    )
    category = Category(name="Sale Cat")
    db_session.add_all([cashier, category])
    db_session.flush()

    product = Product(
        category_id=category.id,
        name="Sale Item Prod",
        sku="SALE-PROD-001",
        cost_price=Decimal("10.00"),
        selling_price=Decimal("15.00"),
    )
    sale = Sale(
        invoice_number="INV-TEST-QTY",
        cashier_id=cashier.id,
        subtotal=Decimal("15.00"),
        total=Decimal("15.00"),
    )
    db_session.add_all([product, sale])
    db_session.flush()

    with db_session.begin_nested():
        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=product.id,
            quantity=Decimal("-1.000"),  # Invalid: quantity must be > 0
            unit_price=Decimal("15.00"),
            cost_price=Decimal("10.00"),
            subtotal=Decimal("-15.00"),
        )
        db_session.add(sale_item)
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ck_sale_items_quantity_positive" in str(exc_info.value)


def test_constraint_invalid_foreign_key(db_session):
    with db_session.begin_nested():
        user = User(
            role_id=999999,  # Non-existent role
            first_name="Ghost",
            last_name="User",
            email="ghost@example.com",
            password_hash="pw",
        )
        db_session.add(user)
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "fk" in str(exc_info.value).lower() or "foreignkey" in str(exc_info.value).lower() or "roles" in str(exc_info.value)


def test_barcode_nullable_and_unique(db_session):
    cat = Category(name="Barcode Test Cat")
    db_session.add(cat)
    db_session.flush()

    # Two products with NULL barcode should both succeed
    p1 = Product(
        category_id=cat.id,
        name="Product Without Barcode 1",
        sku="SKU-NO-BAR-1",
        barcode=None,
    )
    p2 = Product(
        category_id=cat.id,
        name="Product Without Barcode 2",
        sku="SKU-NO-BAR-2",
        barcode=None,
    )
    db_session.add_all([p1, p2])
    db_session.flush()
    assert p1.id is not None
    assert p2.id is not None

    # Two products with same non-null barcode should fail
    p3 = Product(
        category_id=cat.id,
        name="Product With Barcode 3",
        sku="SKU-BAR-3",
        barcode="1234567890123",
    )
    db_session.add(p3)
    db_session.flush()

    with db_session.begin_nested():
        p4 = Product(
            category_id=cat.id,
            name="Product With Duplicate Barcode",
            sku="SKU-BAR-4",
            barcode="1234567890123",
        )
        db_session.add(p4)
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ix_products_barcode" in str(exc_info.value) or "products_barcode_key" in str(exc_info.value)


def test_constraint_stock_movement_non_positive_quantity(db_session):
    role = db_session.execute(select(Role).filter_by(name="STAFF")).scalar_one()
    user = User(role_id=role.id, first_name="A", last_name="B", email="ab@example.com", password_hash="pw")
    cat = Category(name="SM Cat")
    db_session.add_all([user, cat])
    db_session.flush()

    prod = Product(category_id=cat.id, name="P", sku="P-SKU-1")
    db_session.add(prod)
    db_session.flush()

    with db_session.begin_nested():
        sm = StockMovement(
            product_id=prod.id,
            movement_type=StockMovementType.ADJUSTMENT_IN.value,
            quantity=Decimal("0.000"),  # Invalid: quantity must be > 0
            quantity_before=Decimal("10.000"),
            quantity_after=Decimal("10.000"),
            created_by=user.id,
        )
        db_session.add(sm)
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ck_stock_movements_quantity_positive" in str(exc_info.value)

