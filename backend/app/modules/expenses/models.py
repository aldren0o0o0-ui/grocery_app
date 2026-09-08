from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.common.models import TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User


class ExpenseCategory(TimestampMixin, db.Model):
    __tablename__ = "expense_categories"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="ck_expense_categories_name_not_empty"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    # Relationships
    expenses: Mapped[List["Expense"]] = relationship("Expense", back_populates="category")

    def __repr__(self) -> str:
        return f"<ExpenseCategory id={self.id} name='{self.name}'>"


class Expense(TimestampMixin, db.Model):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_expenses_amount_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("expense_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expense_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    created_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Relationships
    category: Mapped["ExpenseCategory"] = relationship("ExpenseCategory", back_populates="expenses")
    creator: Mapped["User"] = relationship("User", back_populates="expenses")

    def __repr__(self) -> str:
        return f"<Expense id={self.id} category_id={self.category_id} amount={self.amount}>"
