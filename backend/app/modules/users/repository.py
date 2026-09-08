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
