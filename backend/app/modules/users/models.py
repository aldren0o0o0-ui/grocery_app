from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.common.models import TimestampMixin

if TYPE_CHECKING:
    from app.modules.auth.models import Role
    from app.modules.inventory.models import StockMovement
    from app.modules.purchasing.models import Purchase
    from app.modules.sales.models import Sale
    from app.modules.expenses.models import Expense
    from app.modules.audit.models import AuditLog


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
        index=True,
    )

    # Relationships
    role: Mapped["Role"] = relationship("Role", back_populates="users", lazy="joined")
    stock_movements: Mapped[List["StockMovement"]] = relationship("StockMovement", back_populates="creator")
    purchases: Mapped[List["Purchase"]] = relationship("Purchase", back_populates="creator")
    sales: Mapped[List["Sale"]] = relationship("Sale", back_populates="cashier")
    expenses: Mapped[List["Expense"]] = relationship("Expense", back_populates="creator")
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user")

    def __init__(self, **kwargs):
        if "email" in kwargs and kwargs["email"]:
            kwargs["email"] = kwargs["email"].strip().lower()
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<User id={self.id} email='{self.email}'>"
