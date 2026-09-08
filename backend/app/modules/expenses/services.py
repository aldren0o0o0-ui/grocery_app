from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from app.common.errors import AppError
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.expenses.models import Expense, ExpenseCategory
from app.modules.expenses.repository import ExpenseCategoryRepository, ExpenseRepository
from app.modules.expenses.schemas import (
    validate_category_create_input,
    validate_category_update_input,
    validate_expense_create_input,
    validate_expense_update_input,
)
from app.modules.users.models import User


class ExpenseCategoryService:
    """Service governing expense category lifecycle and management."""

    @classmethod
    def get_category(cls, category_id: int) -> ExpenseCategory:
        cat = ExpenseCategoryRepository.get_by_id(category_id)
        if not cat:
            raise AppError("EXPENSE_CATEGORY_NOT_FOUND", f"Expense category with ID {category_id} not found.", 404)
        return cat

    @classmethod
    def list_categories(
        cls,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[ExpenseCategory]:
        return ExpenseCategoryRepository.list_categories(is_active=is_active, search=search)

    @classmethod
    def create_category(cls, data: Dict[str, Any], actor: User) -> ExpenseCategory:
        name, description = validate_category_create_input(data)

        # Case-insensitive duplicate check
        existing = ExpenseCategoryRepository.get_by_name(name)
        if existing:
            raise AppError("EXPENSE_CATEGORY_NAME_EXISTS", f"Expense category '{name}' already exists.", 400)

        try:
            cat = ExpenseCategory(name=name, description=description, is_active=True)
            db.session.add(cat)
            db.session.flush()

            audit = AuditLog(
                user_id=actor.id,
                action="EXPENSE_CATEGORY_CREATED",
                entity_type="ExpenseCategory",
                entity_id=cat.id,
                description=f"Expense category '{cat.name}' created by {actor.email}.",
            )
            db.session.add(audit)
            db.session.commit()
            return cat
        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def update_category(cls, category_id: int, data: Dict[str, Any], actor: User) -> ExpenseCategory:
        cat = cls.get_category(category_id)
        updates = validate_category_update_input(data)

        new_name = updates.get("name")
        if new_name and new_name.lower() != cat.name.lower():
            existing = ExpenseCategoryRepository.get_by_name(new_name)
            if existing and existing.id != cat.id:
                raise AppError("EXPENSE_CATEGORY_NAME_EXISTS", f"Expense category '{new_name}' already exists.", 400)
            cat.name = new_name

        if "description" in updates:
            cat.description = updates["description"]

        try:
            audit = AuditLog(
                user_id=actor.id,
                action="EXPENSE_CATEGORY_UPDATED",
                entity_type="ExpenseCategory",
                entity_id=cat.id,
                description=f"Expense category '{cat.name}' updated by {actor.email}.",
            )
            db.session.add(audit)
            db.session.commit()
            return cat
        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def set_status(cls, category_id: int, is_active: bool, actor: User) -> ExpenseCategory:
        cat = cls.get_category(category_id)
        cat.is_active = is_active

        try:
            audit = AuditLog(
                user_id=actor.id,
                action="EXPENSE_CATEGORY_STATUS_CHANGED",
                entity_type="ExpenseCategory",
                entity_id=cat.id,
                description=(
                    f"Expense category '{cat.name}' status changed to "
                    f"{'ACTIVE' if is_active else 'INACTIVE'} by {actor.email}."
                ),
            )
            db.session.add(audit)
            db.session.commit()
            return cat
        except Exception:
            db.session.rollback()
            raise


class ExpenseService:
    """Service governing operating expense creation, updates, and querying."""

    @classmethod
    def get_expense(cls, expense_id: int) -> Expense:
        exp = ExpenseRepository.get_by_id(expense_id)
        if not exp:
            raise AppError("EXPENSE_NOT_FOUND", f"Expense with ID {expense_id} not found.", 404)
        return exp

    @classmethod
    def list_expenses(
        cls,
        category_id: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        created_by: Optional[int] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Expense], int]:
        return ExpenseRepository.list_expenses(
            category_id=category_id,
            date_from=date_from,
            date_to=date_to,
            created_by=created_by,
            search=search,
            page=page,
            per_page=per_page,
        )

    @classmethod
    def create_expense(cls, data: Dict[str, Any], actor: User) -> Expense:
        validated = validate_expense_create_input(data)

        # Check target category exists and is active
        category = ExpenseCategoryRepository.get_by_id(validated["category_id"])
        if not category:
            raise AppError(
                "EXPENSE_CATEGORY_NOT_FOUND",
                f"Expense category with ID {validated['category_id']} not found.",
                404,
            )

        if not category.is_active:
            raise AppError(
                "EXPENSE_CATEGORY_INACTIVE",
                f"Cannot record expense under inactive category '{category.name}'.",
                400,
            )

        try:
            expense = Expense(
                category_id=category.id,
                amount=validated["amount"],
                expense_date=validated["expense_date"],
                description=validated["description"],
                created_by=actor.id,
            )
            db.session.add(expense)
            db.session.flush()

            audit = AuditLog(
                user_id=actor.id,
                action="EXPENSE_CREATED",
                entity_type="Expense",
                entity_id=expense.id,
                description=(
                    f"Expense #{expense.id} recorded by {actor.email}: "
                    f"₱{expense.amount:.2f} under '{category.name}' on {expense.expense_date}."
                ),
            )
            db.session.add(audit)
            db.session.commit()

            return cls.get_expense(expense.id)
        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def update_expense(cls, expense_id: int, data: Dict[str, Any], actor: User) -> Expense:
        expense = cls.get_expense(expense_id)
        updates = validate_expense_update_input(data)

        if "category_id" in updates:
            new_cat_id = updates["category_id"]
            if new_cat_id != expense.category_id:
                category = ExpenseCategoryRepository.get_by_id(new_cat_id)
                if not category:
                    raise AppError(
                        "EXPENSE_CATEGORY_NOT_FOUND",
                        f"Expense category with ID {new_cat_id} not found.",
                        404,
                    )
                if not category.is_active:
                    raise AppError(
                        "EXPENSE_CATEGORY_INACTIVE",
                        f"Cannot assign expense to inactive category '{category.name}'.",
                        400,
                    )
                expense.category_id = category.id

        if "amount" in updates:
            expense.amount = updates["amount"]

        if "expense_date" in updates:
            expense.expense_date = updates["expense_date"]

        if "description" in updates:
            expense.description = updates["description"]

        try:
            category_name = expense.category.name if expense.category else f"ID #{expense.category_id}"
            audit = AuditLog(
                user_id=actor.id,
                action="EXPENSE_UPDATED",
                entity_type="Expense",
                entity_id=expense.id,
                description=(
                    f"Expense #{expense.id} updated by {actor.email}: "
                    f"₱{expense.amount:.2f} under '{category_name}' on {expense.expense_date}."
                ),
            )
            db.session.add(audit)
            db.session.commit()

            return cls.get_expense(expense.id)
        except Exception:
            db.session.rollback()
            raise
