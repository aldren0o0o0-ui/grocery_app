from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch
import pytest
from sqlalchemy import select
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Role
from app.modules.auth.tokens import generate_access_token
from app.modules.expenses.models import Expense, ExpenseCategory
from app.modules.users.models import User


def get_token_for_role(role_name: str, email_suffix: str = "main") -> str:
    role = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one()
    email = f"expense_{role_name.lower()}_{email_suffix}@test.com"
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
def cleanup_expenses_data(app):
    def clean():
        with app.app_context():
            AuditLog.query.filter(
                AuditLog.entity_type.in_(["Expense", "ExpenseCategory"])
            ).delete()
            Expense.query.delete()
            ExpenseCategory.query.delete()
            db.session.commit()
    clean()
    yield
    clean()


@pytest.fixture
def setup_categories(app):
    with app.app_context():
        c1 = ExpenseCategory(name="Utilities", description="Electricity and water", is_active=True)
        c2 = ExpenseCategory(name="Lease & Rent", description="Monthly store space rental", is_active=True)
        c3 = ExpenseCategory(name="Discontinued Category", description="Old inactive category", is_active=False)
        db.session.add_all([c1, c2, c3])
        db.session.commit()
        return {
            "utilities_id": c1.id,
            "rent_id": c2.id,
            "inactive_id": c3.id,
        }


# ==============================================================================
# EXPENSE CATEGORIES TESTS
# ==============================================================================

def test_category_rbac_and_listing(client, setup_categories):
    owner_token = get_token_for_role("OWNER", "cat1")
    staff_token = get_token_for_role("STAFF", "cat1")
    cashier_token = get_token_for_role("CASHIER", "cat1")

    # 1. CASHIER is denied
    res_cashier = client.get("/api/expense-categories", headers={"Authorization": f"Bearer {cashier_token}"})
    assert res_cashier.status_code == 403

    # 2. STAFF can list
    res_staff = client.get("/api/expense-categories", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_staff.status_code == 200
    assert len(res_staff.get_json()["categories"]) == 3

    # 3. OWNER can list with is_active filter
    res_owner = client.get("/api/expense-categories?is_active=true", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_owner.status_code == 200
    assert len(res_owner.get_json()["categories"]) == 2


def test_category_creation_and_validation(client):
    owner_token = get_token_for_role("OWNER", "create_cat")
    staff_token = get_token_for_role("STAFF", "create_cat")

    # 1. STAFF cannot create categories
    res_staff = client.post(
        "/api/expense-categories",
        json={"name": "Logistics"},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_staff.status_code == 403

    # 2. Blank or whitespace name rejected
    res_blank = client.post(
        "/api/expense-categories",
        json={"name": "   "},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_blank.status_code == 400
    assert res_blank.get_json()["error"]["code"] == "VALIDATION_ERROR"

    # 3. Valid creation
    res_valid = client.post(
        "/api/expense-categories",
        json={"name": "Logistics", "description": "Delivery fuel and fees"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_valid.status_code == 201
    cat_data = res_valid.get_json()["category"]
    assert cat_data["name"] == "Logistics"
    assert cat_data["is_active"] is True

    # 4. Case-insensitive duplicate name rejected
    res_dup = client.post(
        "/api/expense-categories",
        json={"name": "  logistics  "},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_dup.status_code == 400
    assert res_dup.get_json()["error"]["code"] == "EXPENSE_CATEGORY_NAME_EXISTS"


def test_category_update_and_status_lifecycle(client, setup_categories):
    owner_token = get_token_for_role("OWNER", "upd_cat")
    staff_token = get_token_for_role("STAFF", "upd_cat")
    cat_id = setup_categories["utilities_id"]

    # 1. STAFF cannot update
    res_staff = client.patch(
        f"/api/expense-categories/{cat_id}",
        json={"name": "Power & Water"},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_staff.status_code == 403

    # 2. OWNER updates name & description
    res_owner = client.patch(
        f"/api/expense-categories/{cat_id}",
        json={"name": "Power & Water", "description": "Consolidated utilities"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_owner.status_code == 200
    assert res_owner.get_json()["category"]["name"] == "Power & Water"

    # 3. Soft deactivation
    res_deact = client.patch(
        f"/api/expense-categories/{cat_id}/status",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_deact.status_code == 200
    assert res_deact.get_json()["category"]["is_active"] is False

    # 4. Soft reactivation
    res_react = client.patch(
        f"/api/expense-categories/{cat_id}/status",
        json={"is_active": True},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_react.status_code == 200
    assert res_react.get_json()["category"]["is_active"] is True


# ==============================================================================
# EXPENSE CREATION & VALIDATION TESTS
# ==============================================================================

def test_expense_creation_rbac(client, setup_categories):
    owner_token = get_token_for_role("OWNER", "exp_rbac")
    staff_token = get_token_for_role("STAFF", "exp_rbac")
    cashier_token = get_token_for_role("CASHIER", "exp_rbac")
    cat_id = setup_categories["utilities_id"]
    today_str = date.today().isoformat()

    payload = {
        "category_id": cat_id,
        "amount": "1250.50",
        "expense_date": today_str,
        "description": "Monthly water bill",
    }

    # 1. CASHIER is denied
    res_cashier = client.post("/api/expenses", json=payload, headers={"Authorization": f"Bearer {cashier_token}"})
    assert res_cashier.status_code == 403

    # 2. STAFF can create
    res_staff = client.post("/api/expenses", json=payload, headers={"Authorization": f"Bearer {staff_token}"})
    assert res_staff.status_code == 201
    exp_staff = res_staff.get_json()["expense"]
    assert exp_staff["amount"] == "1250.50"
    assert exp_staff["creator"]["email"] == "expense_staff_exp_rbac@test.com"

    # 3. OWNER can create
    res_owner = client.post("/api/expenses", json=payload, headers={"Authorization": f"Bearer {owner_token}"})
    assert res_owner.status_code == 201
    assert res_owner.get_json()["expense"]["creator"]["email"] == "expense_owner_exp_rbac@test.com"


def test_expense_creation_validation_rules(client, setup_categories):
    owner_token = get_token_for_role("OWNER", "exp_val")
    cat_id = setup_categories["utilities_id"]
    inactive_id = setup_categories["inactive_id"]
    today = date.today()

    # 1. Category not found
    res = client.post(
        "/api/expenses",
        json={"category_id": 999999, "amount": "100.00", "expense_date": today.isoformat()},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 404
    assert res.get_json()["error"]["code"] == "EXPENSE_CATEGORY_NOT_FOUND"

    # 2. Inactive category rejected
    res = client.post(
        "/api/expenses",
        json={"category_id": inactive_id, "amount": "100.00", "expense_date": today.isoformat()},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "EXPENSE_CATEGORY_INACTIVE"

    # 3. Amount zero or negative rejected
    res_zero = client.post(
        "/api/expenses",
        json={"category_id": cat_id, "amount": "0.00", "expense_date": today.isoformat()},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_zero.status_code == 400
    assert res_zero.get_json()["error"]["code"] == "INVALID_AMOUNT"

    res_neg = client.post(
        "/api/expenses",
        json={"category_id": cat_id, "amount": "-50.00", "expense_date": today.isoformat()},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_neg.status_code == 400
    assert res_neg.get_json()["error"]["code"] == "INVALID_AMOUNT"

    # 4. More than 2 decimal places rejected
    res_decimals = client.post(
        "/api/expenses",
        json={"category_id": cat_id, "amount": "100.555", "expense_date": today.isoformat()},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_decimals.status_code == 400
    assert res_decimals.get_json()["error"]["code"] == "INVALID_AMOUNT"

    # 5. Future date rejected
    tomorrow = (today + timedelta(days=1)).isoformat()
    res_future = client.post(
        "/api/expenses",
        json={"category_id": cat_id, "amount": "100.00", "expense_date": tomorrow},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_future.status_code == 400
    assert res_future.get_json()["error"]["code"] == "EXPENSE_DATE_IN_FUTURE"

    # 6. Past date allowed
    yesterday = (today - timedelta(days=1)).isoformat()
    res_past = client.post(
        "/api/expenses",
        json={"category_id": cat_id, "amount": "100.00", "expense_date": yesterday},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_past.status_code == 201
    assert res_past.get_json()["expense"]["expense_date"] == yesterday

    # 7. Creator spoofing prevented (payload created_by ignored/overridden by auth identity)
    res_spoof = client.post(
        "/api/expenses",
        json={"category_id": cat_id, "amount": "100.00", "expense_date": today.isoformat(), "created_by": 9999},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_spoof.status_code == 201
    assert res_spoof.get_json()["expense"]["creator"]["email"] == "expense_owner_exp_val@test.com"


# ==============================================================================
# EXPENSE EDITING TESTS
# ==============================================================================

def test_expense_updating(client, setup_categories):
    owner_token = get_token_for_role("OWNER", "upd_exp")
    staff_token = get_token_for_role("STAFF", "upd_exp")
    cat1_id = setup_categories["utilities_id"]
    cat2_id = setup_categories["rent_id"]
    inactive_id = setup_categories["inactive_id"]
    today_str = date.today().isoformat()

    # Create initial expense
    res_create = client.post(
        "/api/expenses",
        json={"category_id": cat1_id, "amount": "500.00", "expense_date": today_str, "description": "Initial"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_create.status_code == 201
    exp_id = res_create.get_json()["expense"]["id"]

    # 1. STAFF cannot update expenses
    res_staff = client.patch(
        f"/api/expenses/{exp_id}",
        json={"amount": "600.00"},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_staff.status_code == 403

    # 2. Cannot reassign to inactive category
    res_inact = client.patch(
        f"/api/expenses/{exp_id}",
        json={"category_id": inactive_id},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_inact.status_code == 400
    assert res_inact.get_json()["error"]["code"] == "EXPENSE_CATEGORY_INACTIVE"

    # 3. Disallowed system fields modification
    res_id = client.patch(
        f"/api/expenses/{exp_id}",
        json={"created_by": 123},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_id.status_code == 400
    assert res_id.get_json()["error"]["code"] == "VALIDATION_ERROR"

    # 4. Successful update by OWNER
    past_date = (date.today() - timedelta(days=2)).isoformat()
    res_ok = client.patch(
        f"/api/expenses/{exp_id}",
        json={
            "category_id": cat2_id,
            "amount": "550.00",
            "expense_date": past_date,
            "description": "Adjusted rent utility split",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_ok.status_code == 200
    updated = res_ok.get_json()["expense"]
    assert updated["category_id"] == cat2_id
    assert updated["amount"] == "550.00"
    assert updated["expense_date"] == past_date
    assert updated["description"] == "Adjusted rent utility split"


# ==============================================================================
# EXPENSE LISTING, SEARCH, & FILTERS TESTS
# ==============================================================================

def test_expense_listing_and_filters(client, setup_categories):
    owner_token = get_token_for_role("OWNER", "list_exp")
    cat1_id = setup_categories["utilities_id"]
    cat2_id = setup_categories["rent_id"]
    today = date.today()

    # Seed 3 expenses
    client.post(
        "/api/expenses",
        json={"category_id": cat1_id, "amount": "100.00", "expense_date": (today - timedelta(days=5)).isoformat(), "description": "Electric light replacement"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.post(
        "/api/expenses",
        json={"category_id": cat1_id, "amount": "200.00", "expense_date": (today - timedelta(days=2)).isoformat(), "description": "Water meter repair"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    client.post(
        "/api/expenses",
        json={"category_id": cat2_id, "amount": "15000.00", "expense_date": today.isoformat(), "description": "Monthly retail space rental"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    # 1. Total listing
    res_all = client.get("/api/expenses", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_all.status_code == 200
    assert len(res_all.get_json()["expenses"]) == 3

    # 2. Filter by category
    res_cat = client.get(f"/api/expenses?category_id={cat1_id}", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_cat.status_code == 200
    assert len(res_cat.get_json()["expenses"]) == 2

    # 3. Filter by date range
    date_from = (today - timedelta(days=3)).isoformat()
    date_to = today.isoformat()
    res_date = client.get(f"/api/expenses?date_from={date_from}&date_to={date_to}", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_date.status_code == 200
    assert len(res_date.get_json()["expenses"]) == 2

    # 4. Search by description keyword
    res_search = client.get("/api/expenses?search=meter", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_search.status_code == 200
    assert len(res_search.get_json()["expenses"]) == 1
    assert "meter" in res_search.get_json()["expenses"][0]["description"]

    # 5. Search by category name keyword
    res_cat_search = client.get("/api/expenses?search=lease", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_cat_search.status_code == 200
    assert len(res_cat_search.get_json()["expenses"]) == 1
    assert res_cat_search.get_json()["expenses"][0]["category_name"] == "Lease & Rent"


# ==============================================================================
# AUDIT LOGGING & ATOMICITY TESTS
# ==============================================================================

def test_expense_audit_logging_and_atomicity(client, setup_categories):
    owner_token = get_token_for_role("OWNER", "audit_exp")
    cat_id = setup_categories["utilities_id"]
    today_str = date.today().isoformat()

    # Create expense and check AuditLog
    res = client.post(
        "/api/expenses",
        json={"category_id": cat_id, "amount": "450.00", "expense_date": today_str, "description": "Audit check"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 201
    exp_id = res.get_json()["expense"]["id"]

    with client.application.app_context():
        audit = db.session.execute(
            select(AuditLog).filter_by(entity_type="Expense", entity_id=exp_id, action="EXPENSE_CREATED")
        ).scalar_one_or_none()
        assert audit is not None
        assert "450.00" in audit.description

    # Test atomicity rollback: mock error during commit
    with patch("app.modules.expenses.services.db.session.commit", side_effect=RuntimeError("Simulated DB failure")):
        res_fail = client.post(
            "/api/expenses",
            json={"category_id": cat_id, "amount": "999.00", "expense_date": today_str},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert res_fail.status_code == 500

    # Ensure no expense with 999.00 was saved
    with client.application.app_context():
        unsaved = db.session.execute(select(Expense).filter_by(amount=Decimal("999.00"))).scalar_one_or_none()
        assert unsaved is None
