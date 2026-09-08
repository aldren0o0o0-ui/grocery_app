from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
import pytest
from sqlalchemy import select
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Role
from app.modules.auth.tokens import generate_access_token
from app.modules.categories.models import Category
from app.modules.expenses.models import Expense, ExpenseCategory
from app.modules.inventory.models import StockMovement
from app.modules.products.models import Product
from app.modules.purchasing.models import Purchase, PurchaseItem
from app.modules.returns.models import SaleReturn, SaleReturnItem
from app.modules.sales.models import Payment, Sale, SaleItem, SaleStatus
from app.modules.users.models import User


def get_token_for_role(role_name: str, email_suffix: str = "main") -> str:
    role = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one()
    email = f"dash_{role_name.lower()}_{email_suffix}@test.com"
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
    get_token_for_role(role_name, email_suffix)
    email = f"dash_{role_name.lower()}_{email_suffix}@test.com"
    return db.session.execute(select(User).filter_by(email=email)).scalar_one()


@pytest.fixture(autouse=True)
def cleanup_dashboard_data(app):
    def clean():
        with app.app_context():
            AuditLog.query.filter(
                AuditLog.entity_type.in_([
                    "SaleReturn", "Sale", "StockMovement", "Product",
                    "Category", "Purchase", "Expense", "ExpenseCategory",
                ])
            ).delete()
            Expense.query.delete()
            ExpenseCategory.query.delete()
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
def setup_base_data(app):
    with app.app_context():
        cat = Category(name="General Store", is_active=True)
        db.session.add(cat)
        db.session.flush()

        # Products
        p1 = Product(
            category_id=cat.id,
            name="Corned Beef 150g",
            sku="CB-150",
            unit="can",
            cost_price=Decimal("40.00"),
            selling_price=Decimal("60.00"),
            stock_quantity=Decimal("100.000"),
            reorder_level=Decimal("10.000"),
            is_active=True,
        )
        p2 = Product(
            category_id=cat.id,
            name="Instant Noodles",
            sku="NOODLE-01",
            unit="pack",
            cost_price=Decimal("10.00"),
            selling_price=Decimal("15.00"),
            stock_quantity=Decimal("3.000"),
            reorder_level=Decimal("10.000"),
            is_active=True,
        )
        p3 = Product(
            category_id=cat.id,
            name="Powder Milk 300g",
            sku="MILK-300",
            unit="pouch",
            cost_price=Decimal("70.00"),
            selling_price=Decimal("100.00"),
            stock_quantity=Decimal("0.000"),
            reorder_level=Decimal("5.000"),
            is_active=True,
        )
        p_inactive = Product(
            category_id=cat.id,
            name="Discontinued Item",
            sku="DISC-01",
            unit="pcs",
            cost_price=Decimal("10.00"),
            selling_price=Decimal("20.00"),
            stock_quantity=Decimal("0.000"),
            reorder_level=Decimal("5.000"),
            is_active=False,
        )
        db.session.add_all([p1, p2, p3, p_inactive])

        exp_cat = ExpenseCategory(name="Utilities", is_active=True)
        db.session.add(exp_cat)
        db.session.commit()

        return {
            "p1_id": p1.id,
            "p2_id": p2.id,
            "p3_id": p3.id,
            "exp_cat_id": exp_cat.id,
        }


# ==============================================================================
# OWNER TESTS
# ==============================================================================

def test_owner_zero_data_dashboard(client):
    token = get_token_for_role("OWNER")
    resp = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json

    assert "period" in data
    assert data["sales"]["gross_sales"] == "0.00"
    assert data["sales"]["refunds"] == "0.00"
    assert data["sales"]["net_sales"] == "0.00"
    assert data["sales"]["transactions"] == 0

    assert data["profit"]["sold_cogs"] == "0.00"
    assert data["profit"]["returned_cogs"] == "0.00"
    assert data["profit"]["net_cogs"] == "0.00"
    assert data["profit"]["estimated_gross_profit"] == "0.00"
    assert data["profit"]["operating_expenses"] == "0.00"
    assert data["profit"]["estimated_net_profit"] == "0.00"

    assert data["inventory"]["active_products"] == 0
    assert data["inventory"]["low_stock"] == 0
    assert data["inventory"]["out_of_stock"] == 0

    assert len(data["trend"]) == 7
    for day_data in data["trend"]:
        assert day_data["gross_sales"] == "0.00"
        assert day_data["refunds"] == "0.00"
        assert day_data["net_sales"] == "0.00"

    assert data["top_products"] == []
    assert data["expense_breakdown"] == []
    assert data["inventory_alerts"] == []
    assert data["recent_sales"] == []
    assert data["recent_returns"] == []
    assert data["recent_expenses"] == []


def test_owner_dashboard_today_sale_included_and_yesterday_excluded(client, app, setup_base_data):
    token = get_token_for_role("OWNER")
    cashier = get_user_for_role("CASHIER")
    tz = ZoneInfo("Asia/Manila")
    today_local = datetime.now(tz).date()

    with app.app_context():
        # Sale yesterday
        yesterday_dt = datetime.combine(today_local - timedelta(days=1), time(14, 0), tzinfo=tz)
        s_yesterday = Sale(
            invoice_number="INV-YEST-001",
            cashier_id=cashier.id,
            subtotal=Decimal("100.00"),
            discount=Decimal("0.00"),
            total=Decimal("100.00"),
            status=SaleStatus.COMPLETED.value,
        )
        s_yesterday.created_at = yesterday_dt
        db.session.add(s_yesterday)
        db.session.flush()

        item_yest = SaleItem(
            sale_id=s_yesterday.id,
            product_id=setup_base_data["p1_id"],
            quantity=Decimal("1.000"),
            unit_price=Decimal("100.00"),
            cost_price=Decimal("60.00"),
            subtotal=Decimal("100.00"),
        )
        item_yest.created_at = yesterday_dt
        db.session.add(item_yest)

        # Sale today
        today_dt = datetime.combine(today_local, time(10, 0), tzinfo=tz)
        s_today = Sale(
            invoice_number="INV-TODAY-001",
            cashier_id=cashier.id,
            subtotal=Decimal("200.00"),
            discount=Decimal("20.00"),
            total=Decimal("180.00"),
            status=SaleStatus.COMPLETED.value,
        )
        s_today.created_at = today_dt
        db.session.add(s_today)
        db.session.flush()

        item_today = SaleItem(
            sale_id=s_today.id,
            product_id=setup_base_data["p1_id"],
            quantity=Decimal("2.000"),
            unit_price=Decimal("100.00"),
            cost_price=Decimal("60.00"),
            subtotal=Decimal("200.00"),
        )
        item_today.created_at = today_dt
        db.session.add(item_today)
        db.session.commit()

    resp = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json

    # Only today's sale should be in today's sales KPIs
    assert data["sales"]["gross_sales"] == "200.00"
    assert data["sales"]["discount_total"] == "20.00"
    assert data["sales"]["net_sales"] == "180.00"
    assert data["sales"]["transactions"] == 1

    # Today's sold COGS: 2 * 60 = 120.00
    assert data["profit"]["sold_cogs"] == "120.00"
    assert data["profit"]["net_cogs"] == "120.00"
    # Gross Profit = 180 - 120 = 60.00
    assert data["profit"]["estimated_gross_profit"] == "60.00"


def test_owner_dashboard_expenses_filtering_by_expense_date(client, app, setup_base_data):
    token = get_token_for_role("OWNER")
    owner = get_user_for_role("OWNER")
    tz = ZoneInfo("Asia/Manila")
    today_local = datetime.now(tz).date()

    with app.app_context():
        # Today's expense
        exp_today = Expense(
            category_id=setup_base_data["exp_cat_id"],
            amount=Decimal("150.00"),
            description="Office Supplies",
            expense_date=today_local,
            created_by=owner.id,
        )
        # Yesterday's expense
        exp_yesterday = Expense(
            category_id=setup_base_data["exp_cat_id"],
            amount=Decimal("500.00"),
            description="Past Repairs",
            expense_date=today_local - timedelta(days=1),
            created_by=owner.id,
        )
        # Other date expense
        exp_other = Expense(
            category_id=setup_base_data["exp_cat_id"],
            amount=Decimal("300.00"),
            description="Other Expense",
            expense_date=today_local - timedelta(days=5),
            created_by=owner.id,
        )
        db.session.add_all([exp_today, exp_yesterday, exp_other])
        db.session.commit()

    resp = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json

    assert data["profit"]["operating_expenses"] == "150.00"
    assert len(data["expense_breakdown"]) == 1
    assert data["expense_breakdown"][0]["category"] == "Utilities"
    assert data["expense_breakdown"][0]["amount"] == "150.00"
    assert data["expense_breakdown"][0]["percentage"] == "100.0"


def test_financial_formulas_controlled_fixture(client, app, setup_base_data):
    """Controlled fixture verifying exact Decimal math:
    Sale: subtotal 1000, discount 100, total 900, COGS 600
    Return: refund 180, returned COGS 120
    Expenses: 100
    Expected:
    Net Sales = 900 - 180 = 720.00
    Net COGS = 600 - 120 = 480.00
    Gross Profit = 720 - 480 = 240.00
    Estimated Net Profit = 240 - 100 = 140.00
    """
    token = get_token_for_role("OWNER")
    cashier = get_user_for_role("CASHIER")
    owner = get_user_for_role("OWNER")
    tz = ZoneInfo("Asia/Manila")
    today_local = datetime.now(tz).date()
    now_dt = datetime.combine(today_local, time(12, 0), tzinfo=tz)

    with app.app_context():
        # Sale
        sale = Sale(
            invoice_number="INV-CTRL-001",
            cashier_id=cashier.id,
            subtotal=Decimal("1000.00"),
            discount=Decimal("100.00"),
            total=Decimal("900.00"),
            status=SaleStatus.COMPLETED.value,
        )
        sale.created_at = now_dt
        db.session.add(sale)
        db.session.flush()

        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=setup_base_data["p1_id"],
            quantity=Decimal("5.000"),
            unit_price=Decimal("200.00"),
            cost_price=Decimal("120.00"),
            subtotal=Decimal("1000.00"),
        )
        sale_item.created_at = now_dt
        db.session.add(sale_item)
        db.session.flush()

        # Return: 1 item returned out of 5 (returned COGS = 1 * 120 = 120)
        ret = SaleReturn(
            return_number="RET-CTRL-001",
            sale_id=sale.id,
            processed_by=cashier.id,
            refund_method="CASH",
            refund_amount=Decimal("180.00"),
            reason="Customer changed mind",
            status="COMPLETED",
        )
        ret.created_at = now_dt
        db.session.add(ret)
        db.session.flush()

        ret_item = SaleReturnItem(
            sale_return_id=ret.id,
            sale_item_id=sale_item.id,
            product_id=setup_base_data["p1_id"],
            quantity=Decimal("1.000"),
            unit_price=Decimal("200.00"),
            refund_subtotal=Decimal("180.00"),
        )
        ret_item.created_at = now_dt
        db.session.add(ret_item)

        # Expense
        exp = Expense(
            category_id=setup_base_data["exp_cat_id"],
            amount=Decimal("100.00"),
            description="Store cleaning",
            expense_date=today_local,
            created_by=owner.id,
        )
        db.session.add(exp)
        db.session.commit()

    resp = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json

    assert data["sales"]["gross_sales"] == "1000.00"
    assert data["sales"]["discount_total"] == "100.00"
    assert data["sales"]["refunds"] == "180.00"
    assert data["sales"]["net_sales"] == "720.00"
    assert data["sales"]["transactions"] == 1

    assert data["profit"]["sold_cogs"] == "600.00"
    assert data["profit"]["returned_cogs"] == "120.00"
    assert data["profit"]["net_cogs"] == "480.00"
    assert data["profit"]["estimated_gross_profit"] == "240.00"
    assert data["profit"]["operating_expenses"] == "100.00"
    assert data["profit"]["estimated_net_profit"] == "140.00"


def test_full_return_dashboard(client, app, setup_base_data):
    """Fully returned sale:
    Sale total = 500, COGS = 300
    Return refund = 500, returned COGS = 300
    Net sales contribution = 0, Gross profit = 0
    """
    token = get_token_for_role("OWNER")
    cashier = get_user_for_role("CASHIER")
    tz = ZoneInfo("Asia/Manila")
    today_local = datetime.now(tz).date()
    now_dt = datetime.combine(today_local, time(13, 0), tzinfo=tz)

    with app.app_context():
        sale = Sale(
            invoice_number="INV-FULLRET-001",
            cashier_id=cashier.id,
            subtotal=Decimal("500.00"),
            discount=Decimal("0.00"),
            total=Decimal("500.00"),
            status=SaleStatus.RETURNED.value,
        )
        sale.created_at = now_dt
        db.session.add(sale)
        db.session.flush()

        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=setup_base_data["p1_id"],
            quantity=Decimal("5.000"),
            unit_price=Decimal("100.00"),
            cost_price=Decimal("60.00"),
            subtotal=Decimal("500.00"),
        )
        sale_item.created_at = now_dt
        db.session.add(sale_item)
        db.session.flush()

        ret = SaleReturn(
            return_number="RET-FULLRET-001",
            sale_id=sale.id,
            processed_by=cashier.id,
            refund_method="CASH",
            refund_amount=Decimal("500.00"),
            reason="Defective goods batch",
            status="COMPLETED",
        )
        ret.created_at = now_dt
        db.session.add(ret)
        db.session.flush()

        ret_item = SaleReturnItem(
            sale_return_id=ret.id,
            sale_item_id=sale_item.id,
            product_id=setup_base_data["p1_id"],
            quantity=Decimal("5.000"),
            unit_price=Decimal("100.00"),
            refund_subtotal=Decimal("500.00"),
        )
        ret_item.created_at = now_dt
        db.session.add(ret_item)
        db.session.commit()

    resp = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json

    assert data["sales"]["gross_sales"] == "500.00"
    assert data["sales"]["refunds"] == "500.00"
    assert data["sales"]["net_sales"] == "0.00"
    assert data["profit"]["sold_cogs"] == "300.00"
    assert data["profit"]["returned_cogs"] == "300.00"
    assert data["profit"]["net_cogs"] == "0.00"
    assert data["profit"]["estimated_gross_profit"] == "0.00"


def test_cross_date_return(client, app, setup_base_data):
    """Sale occurred yesterday. Return processed today.
    Yesterday's transaction is untouched historically.
    Today's dashboard reflects the compensating refund and returned COGS.
    """
    token = get_token_for_role("OWNER")
    cashier = get_user_for_role("CASHIER")
    tz = ZoneInfo("Asia/Manila")
    today_local = datetime.now(tz).date()
    yesterday_local = today_local - timedelta(days=1)

    yest_dt = datetime.combine(yesterday_local, time(15, 0), tzinfo=tz)
    today_dt = datetime.combine(today_local, time(11, 0), tzinfo=tz)

    with app.app_context():
        sale = Sale(
            invoice_number="INV-CROSS-001",
            cashier_id=cashier.id,
            subtotal=Decimal("500.00"),
            discount=Decimal("0.00"),
            total=Decimal("500.00"),
            status=SaleStatus.COMPLETED.value,
        )
        sale.created_at = yest_dt
        db.session.add(sale)
        db.session.flush()

        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=setup_base_data["p1_id"],
            quantity=Decimal("5.000"),
            unit_price=Decimal("100.00"),
            cost_price=Decimal("60.00"),
            subtotal=Decimal("500.00"),
        )
        sale_item.created_at = yest_dt
        db.session.add(sale_item)
        db.session.flush()

        # Return occurs TODAY
        ret = SaleReturn(
            return_number="RET-CROSS-001",
            sale_id=sale.id,
            processed_by=cashier.id,
            refund_method="CASH",
            refund_amount=Decimal("200.00"),
            reason="Customer returned 2 cans",
            status="COMPLETED",
        )
        ret.created_at = today_dt
        db.session.add(ret)
        db.session.flush()

        ret_item = SaleReturnItem(
            sale_return_id=ret.id,
            sale_item_id=sale_item.id,
            product_id=setup_base_data["p1_id"],
            quantity=Decimal("2.000"),
            unit_price=Decimal("100.00"),
            refund_subtotal=Decimal("200.00"),
        )
        ret_item.created_at = today_dt
        db.session.add(ret_item)
        db.session.commit()

    # Query today's dashboard
    resp = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json

    assert data["sales"]["gross_sales"] == "0.00"
    assert data["sales"]["refunds"] == "200.00"
    assert data["sales"]["net_sales"] == "-200.00"
    assert data["profit"]["sold_cogs"] == "0.00"
    assert data["profit"]["returned_cogs"] == "120.00"
    assert data["profit"]["net_cogs"] == "-120.00"
    # Net sales (-200) - Net COGS (-120) = -80.00
    assert data["profit"]["estimated_gross_profit"] == "-80.00"


def test_owner_top_products_with_return_subtraction(client, app, setup_base_data):
    token = get_token_for_role("OWNER")
    cashier = get_user_for_role("CASHIER")
    tz = ZoneInfo("Asia/Manila")
    today_local = datetime.now(tz).date()
    now_dt = datetime.combine(today_local, time(12, 0), tzinfo=tz)

    with app.app_context():
        # Product 1 sold 10, returned 3 => net 7
        # Product 2 sold 8, returned 0 => net 8
        # Product 3 sold 5, returned 5 => net 0 (should be excluded)
        sale = Sale(
            invoice_number="INV-TOP-001",
            cashier_id=cashier.id,
            subtotal=Decimal("1500.00"),
            discount=Decimal("0.00"),
            total=Decimal("1500.00"),
            status=SaleStatus.COMPLETED.value,
        )
        sale.created_at = now_dt
        db.session.add(sale)
        db.session.flush()

        si1 = SaleItem(
            sale_id=sale.id,
            product_id=setup_base_data["p1_id"],
            quantity=Decimal("10.000"),
            unit_price=Decimal("60.00"),
            cost_price=Decimal("40.00"),
            subtotal=Decimal("600.00"),
        )
        si2 = SaleItem(
            sale_id=sale.id,
            product_id=setup_base_data["p2_id"],
            quantity=Decimal("8.000"),
            unit_price=Decimal("15.00"),
            cost_price=Decimal("10.00"),
            subtotal=Decimal("120.00"),
        )
        si3 = SaleItem(
            sale_id=sale.id,
            product_id=setup_base_data["p3_id"],
            quantity=Decimal("5.000"),
            unit_price=Decimal("100.00"),
            cost_price=Decimal("70.00"),
            subtotal=Decimal("500.00"),
        )
        db.session.add_all([si1, si2, si3])
        db.session.flush()

        # Return for si1 (3 items) and si3 (5 items)
        ret = SaleReturn(
            return_number="RET-TOP-001",
            sale_id=sale.id,
            processed_by=cashier.id,
            refund_method="CASH",
            refund_amount=Decimal("680.00"),
            reason="Returns test",
            status="COMPLETED",
        )
        ret.created_at = now_dt
        db.session.add(ret)
        db.session.flush()

        ri1 = SaleReturnItem(
            sale_return_id=ret.id,
            sale_item_id=si1.id,
            product_id=setup_base_data["p1_id"],
            quantity=Decimal("3.000"),
            unit_price=Decimal("60.00"),
            refund_subtotal=Decimal("180.00"),
        )
        ri3 = SaleReturnItem(
            sale_return_id=ret.id,
            sale_item_id=si3.id,
            product_id=setup_base_data["p3_id"],
            quantity=Decimal("5.000"),
            unit_price=Decimal("100.00"),
            refund_subtotal=Decimal("500.00"),
        )
        db.session.add_all([ri1, ri3])
        db.session.commit()

    resp = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    top = resp.json["top_products"]

    # Only p2 (net 8) and p1 (net 7) should be included; p3 (net 0) is excluded
    assert len(top) == 2
    assert top[0]["product_id"] == setup_base_data["p2_id"]
    assert top[0]["net_quantity_sold"] == "8.000"
    assert top[1]["product_id"] == setup_base_data["p1_id"]
    assert top[1]["net_quantity_sold"] == "7.000"


def test_owner_inventory_counts_and_alerts(client, setup_base_data):
    token = get_token_for_role("OWNER")
    resp = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    inv = resp.json["inventory"]
    alerts = resp.json["inventory_alerts"]

    # Active products: p1 (100 qty), p2 (3 qty, reorder 10), p3 (0 qty, reorder 5) => 3 active
    # p_inactive is inactive => not counted
    assert inv["active_products"] == 3
    # low_stock: p2 has stock 3 <= 10 reorder level => 1
    assert inv["low_stock"] == 1
    # out_of_stock: p3 has stock 0 => 1
    assert inv["out_of_stock"] == 1

    # Alerts should rank OUT_OF_STOCK before LOW_STOCK
    assert len(alerts) == 2
    assert alerts[0]["id"] == setup_base_data["p3_id"]
    assert alerts[0]["status"] == "OUT_OF_STOCK"
    assert alerts[1]["id"] == setup_base_data["p2_id"]
    assert alerts[1]["status"] == "LOW_STOCK"


# ==============================================================================
# STAFF TESTS & PRIVACY
# ==============================================================================

def test_staff_dashboard_privacy_and_operational_sections(client, setup_base_data):
    token = get_token_for_role("STAFF")
    resp = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json

    # Must contain operational sections
    assert "period" in data
    assert "inventory" in data
    assert data["inventory"]["active_products"] == 3
    assert "inventory_alerts" in data
    assert "recent_expenses" in data

    # Financial & profit metrics MUST BE ABSENT
    assert "profit" not in data
    assert "sales" not in data
    assert "trend" not in data
    assert "top_products" not in data
    assert "expense_breakdown" not in data
    assert "recent_returns" not in data


# ==============================================================================
# CASHIER TESTS & SCOPE PRIVACY
# ==============================================================================

def test_cashier_dashboard_scope_and_privacy(client, app, setup_base_data):
    c1_token = get_token_for_role("CASHIER", email_suffix="cashier1")
    c1_user = get_user_for_role("CASHIER", email_suffix="cashier1")
    c2_token = get_token_for_role("CASHIER", email_suffix="cashier2")
    c2_user = get_user_for_role("CASHIER", email_suffix="cashier2")

    tz = ZoneInfo("Asia/Manila")
    today_local = datetime.now(tz).date()
    now_dt = datetime.combine(today_local, time(12, 0), tzinfo=tz)

    with app.app_context():
        # C1 sale: 150
        s1 = Sale(
            invoice_number="INV-C1-001",
            cashier_id=c1_user.id,
            subtotal=Decimal("150.00"),
            discount=Decimal("0.00"),
            total=Decimal("150.00"),
            status=SaleStatus.COMPLETED.value,
        )
        s1.created_at = now_dt
        db.session.add(s1)

        # C2 sale: 300
        s2 = Sale(
            invoice_number="INV-C2-001",
            cashier_id=c2_user.id,
            subtotal=Decimal("300.00"),
            discount=Decimal("0.00"),
            total=Decimal("300.00"),
            status=SaleStatus.COMPLETED.value,
        )
        s2.created_at = now_dt
        db.session.add(s2)
        db.session.commit()

    # Cashier 1 request
    resp1 = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {c1_token}"})
    assert resp1.status_code == 200
    d1 = resp1.json

    assert "cashier_sales" in d1
    assert d1["cashier_sales"]["today_sales"] == "150.00"
    assert d1["cashier_sales"]["transactions"] == 1
    assert len(d1["recent_sales"]) == 1
    assert d1["recent_sales"][0]["invoice_number"] == "INV-C1-001"

    # Store-wide financial & operational sections MUST BE ABSENT
    assert "profit" not in d1
    assert "inventory" not in d1
    assert "inventory_alerts" not in d1
    assert "trend" not in d1
    assert "top_products" not in d1
    assert "expense_breakdown" not in d1
    assert "recent_expenses" not in d1
    assert "recent_returns" not in d1

    # Cashier 2 request
    resp2 = client.get("/api/dashboard/overview", headers={"Authorization": f"Bearer {c2_token}"})
    assert resp2.status_code == 200
    d2 = resp2.json
    assert d2["cashier_sales"]["today_sales"] == "300.00"
    assert d2["cashier_sales"]["transactions"] == 1
    assert len(d2["recent_sales"]) == 1
    assert d2["recent_sales"][0]["invoice_number"] == "INV-C2-001"


def test_dashboard_unauthorized(client):
    resp = client.get("/api/dashboard/overview")
    assert resp.status_code == 401
