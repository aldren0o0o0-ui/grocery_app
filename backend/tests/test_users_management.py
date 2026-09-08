import pytest
from sqlalchemy import select
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.modules.auth.models import Role
from app.modules.auth.tokens import generate_access_token
from app.modules.audit.models import AuditLog
from app.modules.users.models import User


@pytest.fixture(autouse=True)
def setup_roles(app):
    with app.app_context():
        for role_name in ["OWNER", "CASHIER", "STAFF"]:
            existing = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one_or_none()
            if not existing:
                db.session.add(Role(name=role_name, description=f"{role_name} role"))
        db.session.commit()


@pytest.fixture(autouse=True)
def cleanup_user_data(app):
    def clean():
        with app.app_context():
            test_emails = [
                "owner_mgr@test.com", "maria.staff@test.com", "juan.cashier@test.com",
                "regular_staff@test.com", "regular_cashier@test.com", "hacker@test.com",
                "owner_val@test.com", "short@test.com", "unique@test.com",
                "owner_list@test.com", "staff_list@test.com"
            ]
            for email in test_emails:
                u = db.session.execute(select(User).filter_by(email=email)).scalar_one_or_none()
                if u:
                    AuditLog.query.filter_by(user_id=u.id).delete()
                    AuditLog.query.filter_by(entity_type="User", entity_id=u.id).delete()
                    db.session.delete(u)
            db.session.commit()
    clean()
    yield
    clean()


def create_user_for_test(email, password, role_name="STAFF", is_active=True):
    role = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one()
    user = db.session.execute(select(User).filter_by(email=email.strip().lower())).scalar_one_or_none()
    if user:
        user.password_hash = generate_password_hash(password)
        user.role = role
        user.is_active = is_active
    else:
        user = User(
            role_id=role.id,
            first_name="Test",
            last_name="User",
            email=email,
            password_hash=generate_password_hash(password),
            is_active=is_active,
        )
        user.role = role
        db.session.add(user)
    db.session.commit()
    _ = user.role.name
    return user


def get_headers(user):
    token = generate_access_token(user)
    return {"Authorization": f"Bearer {token}"}


def test_owner_can_create_staff_and_cashier(client, app):
    with app.app_context():
        owner = create_user_for_test("owner_mgr@test.com", "Password123", role_name="OWNER")
        headers = get_headers(owner)

        # 1. Create Staff
        staff_payload = {
            "first_name": "Maria",
            "last_name": "Santos",
            "email": "maria.staff@test.com",
            "password": "StaffPassword123!",
            "role": "STAFF",
        }
        res_staff = client.post("/api/users", json=staff_payload, headers=headers)
        assert res_staff.status_code == 201
        staff_data = res_staff.get_json()["user"]
        assert staff_data["email"] == "maria.staff@test.com"
        assert staff_data["role"] == "STAFF"
        assert staff_data["first_name"] == "Maria"
        assert staff_data["is_active"] is True
        assert "password_hash" not in staff_data

        # 2. Create Cashier
        cashier_payload = {
            "first_name": "Juan",
            "last_name": "Dela Cruz",
            "email": "juan.cashier@test.com",
            "password": "CashierPassword123!",
            "role": "CASHIER",
        }
        res_cashier = client.post("/api/users", json=cashier_payload, headers=headers)
        assert res_cashier.status_code == 201
        cashier_data = res_cashier.get_json()["user"]
        assert cashier_data["email"] == "juan.cashier@test.com"
        assert cashier_data["role"] == "CASHIER"
        assert cashier_data["is_active"] is True

        # Verify audit logs
        audit_staff = db.session.execute(
            select(AuditLog).filter_by(entity_id=staff_data["id"], action="CREATE_STAFF")
        ).scalar_one_or_none()
        assert audit_staff is not None
        assert audit_staff.user_id == owner.id


def test_staff_and_cashier_cannot_create_users(client, app):
    with app.app_context():
        staff = create_user_for_test("regular_staff@test.com", "Password123", role_name="STAFF")
        cashier = create_user_for_test("regular_cashier@test.com", "Password123", role_name="CASHIER")

        payload = {
            "first_name": "Hacker",
            "last_name": "User",
            "email": "hacker@test.com",
            "password": "Password123!",
            "role": "OWNER",
        }

        # STAFF attempt -> 403
        res_staff = client.post("/api/users", json=payload, headers=get_headers(staff))
        assert res_staff.status_code == 403

        # CASHIER attempt -> 403
        res_cashier = client.post("/api/users", json=payload, headers=get_headers(cashier))
        assert res_cashier.status_code == 403


def test_duplicate_email_and_validation(client, app):
    with app.app_context():
        owner = create_user_for_test("owner_val@test.com", "Password123", role_name="OWNER")
        headers = get_headers(owner)

        # Short password (< 8 chars)
        res_short_pw = client.post(
            "/api/users",
            json={
                "first_name": "Short",
                "last_name": "Pass",
                "email": "short@test.com",
                "password": "short",
                "role": "STAFF",
            },
            headers=headers,
        )
        assert res_short_pw.status_code == 400

        # Duplicate email
        res1 = client.post(
            "/api/users",
            json={
                "first_name": "Unique",
                "last_name": "User",
                "email": "unique@test.com",
                "password": "Password123!",
                "role": "STAFF",
            },
            headers=headers,
        )
        assert res1.status_code == 201

        res2 = client.post(
            "/api/users",
            json={
                "first_name": "Duplicate",
                "last_name": "User",
                "email": "  UNIQUE@test.com  ",
                "password": "Password123!",
                "role": "CASHIER",
            },
            headers=headers,
        )
        assert res2.status_code == 409


def test_owner_can_list_and_toggle_status(client, app):
    with app.app_context():
        owner = create_user_for_test("owner_list@test.com", "Password123", role_name="OWNER")
        staff = create_user_for_test("staff_list@test.com", "Password123", role_name="STAFF")
        headers = get_headers(owner)

        # List users
        res_list = client.get("/api/users", headers=headers)
        assert res_list.status_code == 200
        data = res_list.get_json()["users"]
        assert any(u["email"] == "staff_list@test.com" for u in data)

        # Deactivate staff
        res_deact = client.patch(
            f"/api/users/{staff.id}/status",
            json={"is_active": False},
            headers=headers,
        )
        assert res_deact.status_code == 200
        assert res_deact.get_json()["user"]["is_active"] is False

        # Owner cannot deactivate self
        res_self = client.patch(
            f"/api/users/{owner.id}/status",
            json={"is_active": False},
            headers=headers,
        )
        assert res_self.status_code == 400
        assert res_self.get_json()["error"]["code"] == "CANNOT_DEACTIVATE_SELF"
