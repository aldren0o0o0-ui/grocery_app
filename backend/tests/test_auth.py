import time
from datetime import timedelta
import pytest
from werkzeug.security import generate_password_hash
from sqlalchemy import select

from app.extensions import db
from app.modules.auth.models import Role
from app.modules.auth.tokens import generate_access_token
from app.modules.audit.models import AuditLog
from app.modules.users.models import User


@pytest.fixture(autouse=True)
def setup_roles(app):
    with app.app_context():
        for role_name in ["OWNER", "ADMIN", "CASHIER", "STAFF"]:
            existing = db.session.execute(select(Role).filter_by(name=role_name)).scalar_one_or_none()
            if not existing:
                db.session.add(Role(name=role_name, description=f"{role_name} role"))
        db.session.commit()


def create_test_user(email, password, role_name="STAFF", is_active=True):
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
    # Eagerly access attribute so it remains cached on the detached instance
    _ = user.role.name
    return user



def test_successful_login_for_all_roles(client):
    roles = ["OWNER", "ADMIN", "CASHIER", "STAFF"]
    for role_name in roles:
        email = f"{role_name.lower()}@test.com"
        create_test_user(email, "Password123", role_name=role_name)

        res = client.post("/api/auth/login", json={"email": email, "password": "Password123"})
        assert res.status_code == 200
        data = res.get_json()
        assert "access_token" in data
        assert data["user"]["role"] == role_name
        assert data["user"]["email"] == email
        assert "password" not in data["user"]
        assert "password_hash" not in data["user"]

        # Verify HttpOnly refresh cookie is set
        set_cookie = res.headers.get("Set-Cookie", "")
        assert "refresh_token=" in set_cookie
        assert "HttpOnly" in set_cookie


def test_login_email_normalization(client):
    create_test_user("normalized@test.com", "Password123")

    # Pass uppercase and surrounding whitespace
    res = client.post("/api/auth/login", json={"email": "  NORMALIZED@TEST.COM  ", "password": "Password123"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["email"] == "normalized@test.com"


def test_login_invalid_email(client):
    res = client.post("/api/auth/login", json={"email": "nonexistent@test.com", "password": "Password123"})
    assert res.status_code == 401
    data = res.get_json()
    assert data["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_wrong_password(client):
    create_test_user("user1@test.com", "CorrectPassword123")
    res = client.post("/api/auth/login", json={"email": "user1@test.com", "password": "WrongPassword"})
    assert res.status_code == 401
    data = res.get_json()
    assert data["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_inactive_user(client):
    create_test_user("inactive@test.com", "Password123", is_active=False)
    res = client.post("/api/auth/login", json={"email": "inactive@test.com", "password": "Password123"})
    assert res.status_code == 403
    data = res.get_json()
    assert data["error"]["code"] == "INACTIVE_USER"


def test_protected_endpoint_without_token(client):
    res = client.get("/api/users/me")
    assert res.status_code == 401
    assert res.get_json()["error"]["code"] == "UNAUTHORIZED"


def test_protected_endpoint_with_invalid_token(client):
    res = client.get("/api/users/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert res.status_code == 401
    assert res.get_json()["error"]["code"] == "INVALID_TOKEN"


def test_protected_endpoint_with_valid_token(client):
    user = create_test_user("active_me@test.com", "Password123", role_name="CASHIER")
    login_res = client.post("/api/auth/login", json={"email": "active_me@test.com", "password": "Password123"})
    token = login_res.get_json()["access_token"]

    res = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["email"] == "active_me@test.com"
    assert data["user"]["role"] == "CASHIER"
    assert "password_hash" not in data["user"]


def test_refresh_token_flow(client):
    create_test_user("refresh_user@test.com", "Password123")
    login_res = client.post("/api/auth/login", json={"email": "refresh_user@test.com", "password": "Password123"})
    initial_token = login_res.get_json()["access_token"]

    # Call refresh (cookies are maintained by test client)
    refresh_res = client.post("/api/auth/refresh")
    assert refresh_res.status_code == 200
    data = refresh_res.get_json()
    assert "access_token" in data
    assert data["user"]["email"] == "refresh_user@test.com"
    assert "password_hash" not in data["user"]

    # Verify new token works on protected endpoint
    new_token = data["access_token"]
    me_res = client.get("/api/users/me", headers={"Authorization": f"Bearer {new_token}"})
    assert me_res.status_code == 200


def test_refresh_token_missing_cookie(client):
    # Brand new test client with no cookies
    res = client.post("/api/auth/refresh")
    assert res.status_code == 401
    assert res.get_json()["error"]["code"] == "INVALID_TOKEN"


def test_logout_clears_cookie(client):
    create_test_user("logout_user@test.com", "Password123")
    login_res = client.post("/api/auth/login", json={"email": "logout_user@test.com", "password": "Password123"})
    token = login_res.get_json()["access_token"]

    # Logout
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200
    set_cookie = logout_res.headers.get("Set-Cookie", "")
    assert 'refresh_token=""' in set_cookie or "refresh_token=;" in set_cookie or "Max-Age=0" in set_cookie

    # Refresh after logout should now fail
    subsequent_refresh = client.post("/api/auth/refresh")
    assert subsequent_refresh.status_code == 401


def test_change_password_success(client):
    user = create_test_user("chg_pw@test.com", "OldPassword123")
    login_res = client.post("/api/auth/login", json={"email": "chg_pw@test.com", "password": "OldPassword123"})
    token = login_res.get_json()["access_token"]

    # Change password
    chg_res = client.patch(
        "/api/users/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "OldPassword123", "new_password": "NewSecurePass456"},
    )
    assert chg_res.status_code == 200
    assert chg_res.get_json()["message"] == "Password updated successfully."

    # Verify old password fails
    old_login = client.post("/api/auth/login", json={"email": "chg_pw@test.com", "password": "OldPassword123"})
    assert old_login.status_code == 401

    # Verify new password succeeds
    new_login = client.post("/api/auth/login", json={"email": "chg_pw@test.com", "password": "NewSecurePass456"})
    assert new_login.status_code == 200


def test_change_password_wrong_current(client):
    create_test_user("wrong_curr@test.com", "Password123")
    login_res = client.post("/api/auth/login", json={"email": "wrong_curr@test.com", "password": "Password123"})
    token = login_res.get_json()["access_token"]

    res = client.patch(
        "/api/users/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "IncorrectPassword", "new_password": "NewSecurePass456"},
    )
    assert res.status_code == 400
    assert res.get_json()["error"]["code"] == "PASSWORD_MISMATCH"


def test_change_password_validation_and_identical(client):
    create_test_user("validate_pw@test.com", "Password123")
    login_res = client.post("/api/auth/login", json={"email": "validate_pw@test.com", "password": "Password123"})
    token = login_res.get_json()["access_token"]

    # Identical password
    res_identical = client.patch(
        "/api/users/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Password123", "new_password": "Password123"},
    )
    assert res_identical.status_code == 400
    assert res_identical.get_json()["error"]["code"] == "PASSWORD_VALIDATION_FAILED"

    # Too short (<8 chars)
    res_short = client.patch(
        "/api/users/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Password123", "new_password": "short"},
    )
    assert res_short.status_code == 400
    assert res_short.get_json()["error"]["code"] == "PASSWORD_VALIDATION_FAILED"


def test_rbac_decorators(app):
    from flask import g
    from app.modules.auth.decorators import require_roles

    with app.app_context():
        owner = create_test_user("rbac_owner@test.com", "Password123", role_name="OWNER")
        admin = create_test_user("rbac_admin@test.com", "Password123", role_name="ADMIN")
        cashier = create_test_user("rbac_cashier@test.com", "Password123", role_name="CASHIER")
        staff = create_test_user("rbac_staff@test.com", "Password123", role_name="STAFF")

        with app.test_request_context():
            @require_roles("OWNER", "ADMIN")
            def protected_view():
                return "SUCCESS", 200

            # 1. Unauthenticated -> 401
            g.current_user = None
            res, code = protected_view()
            assert code == 401
            assert res.get_json()["error"]["code"] == "UNAUTHORIZED"

            # 2. OWNER -> 200
            g.current_user = owner
            res, code = protected_view()
            assert code == 200
            assert res == "SUCCESS"

            # 3. ADMIN -> 200
            g.current_user = admin
            res, code = protected_view()
            assert code == 200
            assert res == "SUCCESS"

            # 4. CASHIER -> 403
            g.current_user = cashier
            res, code = protected_view()
            assert code == 403
            assert res.get_json()["error"]["code"] == "FORBIDDEN"

            # 5. STAFF -> 403
            g.current_user = staff
            res, code = protected_view()
            assert code == 403
            assert res.get_json()["error"]["code"] == "FORBIDDEN"




def test_audit_logs_recorded(client):
    user = create_test_user("audit_test@test.com", "Password123", role_name="STAFF")

    # Login audit
    login_res = client.post("/api/auth/login", json={"email": "audit_test@test.com", "password": "Password123"})
    token = login_res.get_json()["access_token"]

    # Password change audit
    client.patch(
        "/api/users/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "Password123", "new_password": "NewAuditPass123"},
    )

    # Logout audit
    client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})

    # Verify audit logs in database
    logs = db.session.execute(
        select(AuditLog).filter_by(user_id=user.id).order_by(AuditLog.created_at.asc())
    ).scalars().all()

    actions = [log.action for log in logs]
    assert "LOGIN_SUCCESS" in actions
    assert "PASSWORD_CHANGED" in actions
    assert "LOGOUT" in actions
    # Confirm no sensitive details in audit descriptions
    for log in logs:
        assert "Password123" not in (log.description or "")
        assert "NewAuditPass123" not in (log.description or "")
