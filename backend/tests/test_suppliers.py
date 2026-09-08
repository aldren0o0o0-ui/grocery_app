import pytest
from sqlalchemy import select
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Role
from app.modules.purchasing.models import Purchase
from app.modules.suppliers.models import Supplier
from app.modules.users.models import User


def get_supplier_token_for_role(client, role_name):
    email = f"supp_{role_name.lower()}@test.com"
    role = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one()
    user = db.session.execute(select(User).filter_by(email=email)).scalar_one_or_none()
    if not user:
        user = User(
            role_id=role.id,
            first_name="Supp",
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
def cleanup_supplier_data(app):
    def clean():
        with app.app_context():
            from app.modules.purchasing.models import PurchaseItem, Purchase
            AuditLog.query.filter(AuditLog.entity_type.in_(["Supplier", "Purchase"])).delete()
            PurchaseItem.query.delete()
            Purchase.query.delete()
            Supplier.query.delete()
            db.session.commit()
    clean()
    yield
    clean()


def setup_sample_suppliers():
    """Sets up sample suppliers for listing and filtering tests."""
    s1 = Supplier(
        name="San Miguel Foods Inc.",
        contact_person="Juan Dela Cruz",
        phone="+63 2 8632 3000",
        email="orders@sanmiguelfoods.ph",
        address="100 Ortigas Center, Mandaluyong City",
        is_active=True,
    )
    s2 = Supplier(
        name="Universal Robina Corp",
        contact_person="Maria Santos",
        phone="0917-123-4567",
        email="sales@urc.com.ph",
        address="Quezon City, Metro Manila",
        is_active=True,
    )
    s3 = Supplier(
        name="Century Pacific Agri",
        contact_person="Pedro Penduko",
        phone="02-8888-1234",
        email="info@centurypacific.ph",
        address="Pasig City",
        is_active=False,
    )
    db.session.add_all([s1, s2, s3])
    db.session.commit()
    return {"s1": s1, "s2": s2, "s3": s3}


# ==============================================================================
# 1. Read Operations & Query Filters Tests
# ==============================================================================

def test_supplier_reads_and_rbac(client):
    setup_sample_suppliers()
    owner_token = get_supplier_token_for_role(client, "OWNER")
    staff_token = get_supplier_token_for_role(client, "STAFF")
    cashier_token = get_supplier_token_for_role(client, "CASHIER")

    # 1. OWNER can list suppliers
    res_o = client.get("/api/suppliers", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_o.status_code == 200
    assert len(res_o.get_json()["data"]["items"]) >= 3

    # 2. STAFF can list suppliers
    res_s = client.get("/api/suppliers", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_s.status_code == 200

    # 4. CASHIER is strictly forbidden (403)
    res_c = client.get("/api/suppliers", headers={"Authorization": f"Bearer {cashier_token}"})
    assert res_c.status_code == 403


def test_supplier_pagination_and_search_filters(client):
    data = setup_sample_suppliers()
    token = get_supplier_token_for_role(client, "OWNER")

    # Pagination
    res_page = client.get("/api/suppliers?page=1&per_page=2", headers={"Authorization": f"Bearer {token}"})
    assert res_page.status_code == 200
    pdata = res_page.get_json()["data"]
    assert len(pdata["items"]) == 2
    assert pdata["pagination"]["total"] == 3
    assert pdata["pagination"]["pages"] == 2

    # Search by Name
    res_name = client.get("/api/suppliers?search=Robina", headers={"Authorization": f"Bearer {token}"})
    assert res_name.status_code == 200
    items = res_name.get_json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["name"] == "Universal Robina Corp"

    # Search by Contact Person
    res_cp = client.get("/api/suppliers?search=Dela Cruz", headers={"Authorization": f"Bearer {token}"})
    assert res_cp.status_code == 200
    items_cp = res_cp.get_json()["data"]["items"]
    assert len(items_cp) == 1
    assert items_cp[0]["name"] == "San Miguel Foods Inc."

    # Search by Phone
    res_phone = client.get("/api/suppliers?search=0917", headers={"Authorization": f"Bearer {token}"})
    assert res_phone.status_code == 200
    assert len(res_phone.get_json()["data"]["items"]) == 1

    # Search by Email
    res_email = client.get("/api/suppliers?search=centurypacific", headers={"Authorization": f"Bearer {token}"})
    assert res_email.status_code == 200
    assert len(res_email.get_json()["data"]["items"]) == 1

    # Active status filter
    res_active = client.get("/api/suppliers?is_active=true", headers={"Authorization": f"Bearer {token}"})
    assert res_active.status_code == 200
    assert res_active.get_json()["data"]["pagination"]["total"] == 2

    res_inactive = client.get("/api/suppliers?is_active=false", headers={"Authorization": f"Bearer {token}"})
    assert res_inactive.status_code == 200
    assert res_inactive.get_json()["data"]["pagination"]["total"] == 1
    assert res_inactive.get_json()["data"]["items"][0]["name"] == "Century Pacific Agri"


def test_supplier_detail_and_not_found(client):
    data = setup_sample_suppliers()
    token = get_supplier_token_for_role(client, "STAFF")

    # Existing supplier
    res = client.get(f"/api/suppliers/{data['s1'].id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    supp = res.get_json()["data"]
    assert supp["name"] == "San Miguel Foods Inc."
    assert supp["purchase_count"] == 0

    # Non-existent supplier
    res_404 = client.get("/api/suppliers/999999", headers={"Authorization": f"Bearer {token}"})
    assert res_404.status_code == 404
    assert res_404.get_json()["error"]["code"] == "SUPPLIER_NOT_FOUND"


# ==============================================================================
# 2. Supplier Creation Tests
# ==============================================================================

def test_supplier_creation_succeeds_for_owner(client):
    owner_token = get_supplier_token_for_role(client, "OWNER")

    # OWNER creates supplier with full details
    res_o = client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "name": "  Monde Nissin Corp  ",
            "contact_person": "  Betty Go  ",
            "phone": "+63 2 8759 7000",
            "email": "Orders@MondeNissin.COM ",
            "address": "Pasig City, Philippines",
        },
    )
    assert res_o.status_code == 201
    created = res_o.get_json()["data"]
    assert created["name"] == "Monde Nissin Corp"  # trimmed
    assert created["contact_person"] == "Betty Go"
    assert created["email"] == "orders@mondenissin.com"  # lowercased
    assert created["is_active"] is True
    assert created["purchase_count"] == 0

    # OWNER creates supplier with minimal details
    res_a = client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "name": "Liwayway Marketing (Oishi)",
        },
    )
    assert res_a.status_code == 201
    assert res_a.get_json()["data"]["name"] == "Liwayway Marketing (Oishi)"
    assert res_a.get_json()["data"]["contact_person"] is None
    assert res_a.get_json()["data"]["phone"] is None
    assert res_a.get_json()["data"]["email"] is None


def test_supplier_creation_rejected_for_staff_and_cashier(client):
    staff_token = get_supplier_token_for_role(client, "STAFF")
    cashier_token = get_supplier_token_for_role(client, "CASHIER")

    payload = {"name": "Unauthorized Supplier"}

    # STAFF forbidden (403)
    res_s = client.post("/api/suppliers", headers={"Authorization": f"Bearer {staff_token}"}, json=payload)
    assert res_s.status_code == 403

    # CASHIER forbidden (403)
    res_c = client.post("/api/suppliers", headers={"Authorization": f"Bearer {cashier_token}"}, json=payload)
    assert res_c.status_code == 403


def test_supplier_creation_validations_and_duplicate_collision(client):
    token = get_supplier_token_for_role(client, "OWNER")

    # 1. Blank name rejected
    res_blank = client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "   "},
    )
    assert res_blank.status_code == 400
    assert res_blank.get_json()["error"]["code"] == "VALIDATION_ERROR"

    # 2. Invalid email format rejected
    res_email = client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Valid Name", "email": "not-an-email"},
    )
    assert res_email.status_code == 400
    assert res_email.get_json()["error"]["code"] == "VALIDATION_ERROR"

    # 3. Create initial supplier
    res_init = client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "NutriAsia Inc."},
    )
    assert res_init.status_code == 201

    # 4. Duplicate name exact match rejected (409)
    res_dup = client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "NutriAsia Inc."},
    )
    assert res_dup.status_code == 409
    assert res_dup.get_json()["error"]["code"] == "SUPPLIER_NAME_EXISTS"

    # 5. Case-insensitive duplicate collision rejected (409)
    res_case_dup = client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "nutriasia inc."},
    )
    assert res_case_dup.status_code == 409
    assert res_case_dup.get_json()["error"]["code"] == "SUPPLIER_NAME_EXISTS"


# ==============================================================================
# 3. Supplier Update Tests
# ==============================================================================

def test_supplier_update_succeeds_and_checks_name_conflicts(client):
    data = setup_sample_suppliers()
    owner_token = get_supplier_token_for_role(client, "OWNER")
    staff_token = get_supplier_token_for_role(client, "STAFF")

    s1 = data["s1"]  # San Miguel Foods Inc.
    s2 = data["s2"]  # Universal Robina Corp

    # 1. Partial update succeeds
    res_up = client.patch(
        f"/api/suppliers/{s1.id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "phone": "+63 917 000 9999",
            "contact_person": "Jane Doe",
        },
    )
    assert res_up.status_code == 200
    assert res_up.get_json()["data"]["phone"] == "+63 917 000 9999"
    assert res_up.get_json()["data"]["contact_person"] == "Jane Doe"
    assert res_up.get_json()["data"]["name"] == "San Miguel Foods Inc."  # preserved

    # 2. Updating self with same name does not collide
    res_self = client.patch(
        f"/api/suppliers/{s1.id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "san miguel foods inc."},
    )
    assert res_self.status_code == 200

    # 3. Updating to collide with s2 rejected (409)
    res_col = client.patch(
        f"/api/suppliers/{s1.id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "universal robina corp"},
    )
    assert res_col.status_code == 409
    assert res_col.get_json()["error"]["code"] == "SUPPLIER_NAME_EXISTS"

    # 4. STAFF update rejected (403)
    res_staff = client.patch(
        f"/api/suppliers/{s1.id}",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"phone": "0999-999-9999"},
    )
    assert res_staff.status_code == 403


# ==============================================================================
# 4. Status Toggle & Lifecycle Tests
# ==============================================================================

def test_supplier_status_toggle_and_preserves_historical_entity(client):
    data = setup_sample_suppliers()
    owner_token = get_supplier_token_for_role(client, "OWNER")
    staff_token = get_supplier_token_for_role(client, "STAFF")
    s1 = data["s1"]

    # 1. STAFF cannot change status (403)
    res_staff = client.patch(
        f"/api/suppliers/{s1.id}/status",
        headers={"Authorization": f"Bearer {staff_token}"},
        json={"is_active": False},
    )
    assert res_staff.status_code == 403

    # 2. OWNER deactivates supplier
    res_deact = client.patch(
        f"/api/suppliers/{s1.id}/status",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": False},
    )
    assert res_deact.status_code == 200
    assert res_deact.get_json()["data"]["is_active"] is False

    # Historical supplier entity remains present in DB
    db_supp = db.session.get(Supplier, s1.id)
    assert db_supp is not None
    assert db_supp.is_active is False

    # 3. Reactivate supplier
    res_react = client.patch(
        f"/api/suppliers/{s1.id}/status",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": True},
    )
    assert res_react.status_code == 200
    assert res_react.get_json()["data"]["is_active"] is True


# ==============================================================================
# 5. Audit Logging Tests
# ==============================================================================

def test_supplier_audit_logging_tracks_actions(client):
    owner_token = get_supplier_token_for_role(client, "OWNER")

    # 1. Create supplier
    res_c = client.post(
        "/api/suppliers",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "Del Monte Philippines", "contact_person": "Carlos P."},
    )
    assert res_c.status_code == 201
    supp_id = res_c.get_json()["data"]["id"]

    audit_c = AuditLog.query.filter_by(entity_type="Supplier", entity_id=supp_id, action="SUPPLIER_CREATED").first()
    assert audit_c is not None
    assert "Del Monte Philippines" in audit_c.description

    # 2. Update supplier
    client.patch(
        f"/api/suppliers/{supp_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"address": "Bukidnon, Philippines"},
    )
    audit_u = AuditLog.query.filter_by(entity_type="Supplier", entity_id=supp_id, action="SUPPLIER_UPDATED").first()
    assert audit_u is not None

    # 3. Deactivate supplier
    client.patch(
        f"/api/suppliers/{supp_id}/status",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"is_active": False},
    )
    audit_s = AuditLog.query.filter_by(entity_type="Supplier", entity_id=supp_id, action="SUPPLIER_STATUS_CHANGED").first()
    assert audit_s is not None
    assert "deactivated" in audit_s.description
