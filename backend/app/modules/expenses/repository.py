from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.modules.expenses.models import Expense, ExpenseCategory


class ExpenseCategoryRepository:
    """Repository handling database operations for ExpenseCategory entities."""

    @staticmethod
    def get_by_id(category_id: int) -> Optional[ExpenseCategory]:
        return db.session.get(ExpenseCategory, category_id)

    @staticmethod
    def get_by_name(name: str) -> Optional[ExpenseCategory]:
        clean = name.strip().lower()
        stmt = select(ExpenseCategory).filter(func.lower(ExpenseCategory.name) == clean)
        return db.session.execute(stmt).scalar_one_or_none()

    @staticmethod
    def list_categories(
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[ExpenseCategory]:
        stmt = select(ExpenseCategory)

        if is_active is not None:
            stmt = stmt.filter(ExpenseCategory.is_active.is_(is_active))

        if search:
            search_term = f"%{search.strip().lower()}%"
            stmt = stmt.filter(func.lower(ExpenseCategory.name).like(search_term))

        stmt = stmt.order_by(ExpenseCategory.name.asc())
        return list(db.session.execute(stmt).scalars().all())

    @staticmethod
    def save(category: ExpenseCategory, commit: bool = True) -> ExpenseCategory:
        db.session.add(category)
        if commit:
            db.session.commit()
        return category


class ExpenseRepository:
    """Repository handling database operations for Expense entities."""

    @staticmethod
    def get_by_id(expense_id: int) -> Optional[Expense]:
        stmt = (
            select(Expense)
            .options(
                joinedload(Expense.category),
                joinedload(Expense.creator),
            )
            .filter_by(id=expense_id)
        )
        return db.session.execute(stmt).scalar_one_or_none()

    @staticmethod
    def list_expenses(
        category_id: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        created_by: Optional[int] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Expense], int]:
        stmt = (
            select(Expense)
            .options(
                joinedload(Expense.category),
                joinedload(Expense.creator),
            )
        )
        count_stmt = select(func.count(Expense.id))

        if category_id is not None:
            stmt = stmt.filter(Expense.category_id == category_id)
            count_stmt = count_stmt.filter(Expense.category_id == category_id)

        if date_from is not None:
            stmt = stmt.filter(Expense.expense_date >= date_from)
            count_stmt = count_stmt.filter(Expense.expense_date >= date_from)

        if date_to is not None:
            stmt = stmt.filter(Expense.expense_date <= date_to)
            count_stmt = count_stmt.filter(Expense.expense_date <= date_to)

        if created_by is not None:
            stmt = stmt.filter(Expense.created_by == created_by)
            count_stmt = count_stmt.filter(Expense.created_by == created_by)

        if search:
            search_term = f"%{search.strip().lower()}%"
            # Match in expense description or category name
            search_filter = (
                func.lower(func.coalesce(Expense.description, "")).like(search_term)
                | func.lower(ExpenseCategory.name).like(search_term)
            )
            stmt = stmt.join(Expense.category).filter(search_filter)
            count_stmt = count_stmt.join(Expense.category).filter(search_filter)

        total = db.session.execute(count_stmt).scalar_one()

        offset = (page - 1) * per_page
        stmt = stmt.order_by(Expense.expense_date.desc(), Expense.created_at.desc(), Expense.id.desc()).offset(offset).limit(per_page)

        items = list(db.session.execute(stmt).scalars().all())
        return items, total

    @staticmethod
    def save(expense: Expense, commit: bool = True) -> Expense:
        db.session.add(expense)
        if commit:
            db.session.commit()
        return expense
