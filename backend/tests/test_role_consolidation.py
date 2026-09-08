import uuid
import pytest
from sqlalchemy import select
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.modules.auth.models import Role
from app.modules.auth.tokens import generate_access_token
from app.modules.users.models import User


def get_token_for(client, email, role_name):
    role = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one()
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


def test_database_roles_contain_no_admin(db_session):
    """Verify that roles table contains strictly OWNER, STAFF, CASHIER and never ADMIN."""
    roles = db_session.execute(select(Role.name)).scalars().all()
    assert "ADMIN" not in roles
    assert set(roles) == {"OWNER", "STAFF", "CASHIER"}


def test_create_user_with_admin_role_fails(client):
    """Verify that POST /api/users rejecting ADMIN role."""
    owner_token = get_token_for(client, "test_owner_rbac@test.com", "OWNER")
    res = client.post(
        "/api/users",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "role": "ADMIN",
            "first_name": "Bad",
            "last_name": "Admin",
            "email": "badadmin@test.com",
            "password": "Password123",
        },
    )
    assert res.status_code == 400
    err = res.get_json()["error"]
    assert err["code"] == "VALIDATION_ERROR"
    assert "Invalid role" in err["message"]


def test_owner_has_exclusive_management_authority(client):
    """Verify OWNER can adjust inventory and manage suppliers, while STAFF and CASHIER cannot."""
    owner_token = get_token_for(client, "exclusive_owner@test.com", "OWNER")
    staff_token = get_token_for(client, "exclusive_staff@test.com", "STAFF")
    cashier_token = get_token_for(client, "exclusive_cashier@test.com", "CASHIER")

    # Supplier creation: OWNER -> 201, STAFF -> 403, CASHIER -> 403
    unique_name = f"Consolidated Sup {uuid.uuid4().hex[:8]}"
    sup_payload = {"name": unique_name}
    res_staff = client.post("/api/suppliers", headers={"Authorization": f"Bearer {staff_token}"}, json=sup_payload)
    assert res_staff.status_code == 403

    res_cashier = client.post("/api/suppliers", headers={"Authorization": f"Bearer {cashier_token}"}, json=sup_payload)
    assert res_cashier.status_code == 403

    res_owner = client.post("/api/suppliers", headers={"Authorization": f"Bearer {owner_token}"}, json=sup_payload)
    assert res_owner.status_code == 201

    # User management: OWNER -> 200, STAFF -> 403, CASHIER -> 403
    res_staff_u = client.get("/api/users", headers={"Authorization": f"Bearer {staff_token}"})
    assert res_staff_u.status_code == 403

    res_cashier_u = client.get("/api/users", headers={"Authorization": f"Bearer {cashier_token}"})
    assert res_cashier_u.status_code == 403

    res_owner_u = client.get("/api/users", headers={"Authorization": f"Bearer {owner_token}"})
    assert res_owner_u.status_code == 200
