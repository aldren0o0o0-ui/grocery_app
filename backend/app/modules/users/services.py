from werkzeug.security import check_password_hash, generate_password_hash
from sqlalchemy import select

from app.extensions import db
from app.common.errors import AppError
from app.modules.auth.models import Role
from app.modules.audit.models import AuditLog
from app.modules.users.models import User
from app.modules.users.repository import UserRepository


class UserService:
    @staticmethod
    def validate_password_policy(password: str) -> None:
        """Enforces Version 1 password policy: at least 8 characters, non-empty, non-whitespace."""
        if not password or not password.strip():
            raise AppError(
                "PASSWORD_VALIDATION_FAILED",
                "Password cannot be empty or contain only whitespace.",
                400,
            )
        if len(password) < 8:
            raise AppError(
                "PASSWORD_VALIDATION_FAILED",
                "Password must be at least 8 characters in length.",
                400,
            )

    @staticmethod
    def change_password(user: User, current_password: str, new_password: str) -> None:
        """Authenticates current password, validates new password, and atomically updates hash + audit log."""
        if not check_password_hash(user.password_hash, current_password):
            raise AppError(
                "PASSWORD_MISMATCH",
                "Current password does not match.",
                400,
            )

        UserService.validate_password_policy(new_password)

        if current_password == new_password:
            raise AppError(
                "PASSWORD_VALIDATION_FAILED",
                "New password must be different from current password.",
                400,
            )

        new_hash = generate_password_hash(new_password)
        UserRepository.update_password(user, new_hash)

        # Audit log inside same atomic transaction
        audit_entry = AuditLog(
            user_id=user.id,
            action="PASSWORD_CHANGED",
            entity_type="User",
            entity_id=user.id,
            description="User password successfully updated",
        )
        db.session.add(audit_entry)
        db.session.commit()

    @staticmethod
    def create_user(
        role_name: str,
        first_name: str,
        last_name: str,
        email: str,
        password: str,
        actor: Optional[User] = None,
    ) -> User:
        """Provisions a user account safely with the specified role."""
        normalized_email = email.strip().lower()
        if not normalized_email:
            raise AppError("INVALID_INPUT", "Email is required.", 400)

        if UserRepository.exists_by_email(normalized_email):
            raise AppError("EMAIL_ALREADY_EXISTS", f"User with email '{normalized_email}' already exists.", 409)

        UserService.validate_password_policy(password)

        clean_role_name = role_name.strip().upper()

        role = db.session.execute(
            select(Role).filter_by(name=clean_role_name)
        ).scalar_one_or_none()

        if not role:
            raise AppError("ROLE_NOT_FOUND", f"Role '{clean_role_name}' does not exist. Please run 'flask seed-roles' first.", 400)

        hashed_password = generate_password_hash(password)

        new_user = User(
            role_id=role.id,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            email=normalized_email,
            password_hash=hashed_password,
            is_active=True,
        )
        UserRepository.create(new_user)
        db.session.flush()

        audit_user_id = actor.id if actor else new_user.id
        description = (
            f"User '{normalized_email}' ({clean_role_name}) created by {actor.email}"
            if actor
            else f"User '{normalized_email}' ({clean_role_name}) provisioned via CLI"
        )

        audit = AuditLog(
            user_id=audit_user_id,
            action=f"CREATE_{clean_role_name}",
            entity_type="User",
            entity_id=new_user.id,
            description=description,
        )
        db.session.add(audit)
        db.session.commit()

        return new_user

    @staticmethod
    def create_owner(first_name: str, last_name: str, email: str, password: str) -> User:
        """Provisions an initial OWNER account safely."""
        return UserService.create_user("OWNER", first_name, last_name, email, password)

    @staticmethod
    def set_user_status(user_id: int, is_active: bool, actor: User) -> User:
        """Activates or deactivates a user account, preventing self-deactivation."""
        target_user = UserRepository.get_by_id(user_id)
        if not target_user:
            raise AppError("USER_NOT_FOUND", "User does not exist.", 404)

        if target_user.id == actor.id and not is_active:
            raise AppError("CANNOT_DEACTIVATE_SELF", "You cannot deactivate your own account.", 400)

        UserRepository.update_status(target_user, is_active)

        action = "USER_ACTIVATED" if is_active else "USER_DEACTIVATED"
        status_text = "Active" if is_active else "Inactive"
        audit = AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="User",
            entity_id=target_user.id,
            description=f"User '{target_user.email}' status changed to {status_text} by {actor.email}",
        )
        db.session.add(audit)
        db.session.commit()

        return target_user

    @staticmethod
    def list_users(
        role_name: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> list[User]:
        """Lists team users filtered by role, active status, or search query."""
        return UserRepository.list_users(
            role_name=role_name,
            is_active=is_active,
            search=search,
        )

