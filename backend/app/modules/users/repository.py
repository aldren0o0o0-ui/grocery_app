from typing import Optional
from sqlalchemy import select
from app.extensions import db
from app.modules.users.models import User


class UserRepository:
    @staticmethod
    def get_by_id(user_id: int) -> Optional[User]:
        return db.session.execute(
            select(User).filter_by(id=user_id)
        ).scalar_one_or_none()

    @staticmethod
    def get_by_email(email: str) -> Optional[User]:
        normalized = email.strip().lower()
        return db.session.execute(
            select(User).filter_by(email=normalized)
        ).scalar_one_or_none()

    @staticmethod
    def exists_by_email(email: str) -> bool:
        normalized = email.strip().lower()
        return (
            db.session.execute(
                select(User.id).filter_by(email=normalized)
            ).scalar_one_or_none()
            is not None
        )

    @staticmethod
    def create(user: User) -> User:
        db.session.add(user)
        return user

    @staticmethod
    def update_password(user: User, password_hash: str) -> None:
        user.password_hash = password_hash

    @staticmethod
    def update_status(user: User, is_active: bool) -> None:
        user.is_active = is_active

    @staticmethod
    def list_users(
        role_name: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> list[User]:
        from app.modules.auth.models import Role
        from sqlalchemy import or_

        stmt = select(User).join(User.role)

        if role_name:
            clean_role = role_name.strip().upper()
            if clean_role == "ADMIN":
                clean_role = "OWNER"
            if clean_role == "OWNER":
                stmt = stmt.filter(Role.name.in_(["OWNER", "ADMIN"]))
            else:
                stmt = stmt.filter(Role.name == clean_role)

        if is_active is not None:
            stmt = stmt.filter(User.is_active == is_active)

        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.filter(
                or_(
                    User.first_name.ilike(term),
                    User.last_name.ilike(term),
                    User.email.ilike(term),
                )
            )

        stmt = stmt.order_by(User.id.asc())
        return list(db.session.execute(stmt).scalars().all())
