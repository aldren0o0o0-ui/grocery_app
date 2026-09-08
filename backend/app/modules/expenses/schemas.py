from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional, Tuple

from app.common.errors import AppError
from app.modules.expenses.models import Expense, ExpenseCategory


def parse_money_decimal(val: Any, field_name: str = "amount") -> Decimal:
    """Parses and validates a monetary amount strictly as Decimal with maximum 2 decimal places."""
    if val is None or str(val).strip() == "":
        raise AppError("VALIDATION_ERROR", f"Field '{field_name}' is required.", 400)
    try:
        dec = Decimal(str(val).strip())
    except (InvalidOperation, TypeError, ValueError):
        raise AppError("INVALID_AMOUNT", f"Invalid numeric format for '{field_name}'.", 400)

    if dec.as_tuple().exponent < -2:
        raise AppError("INVALID_AMOUNT", f"'{field_name}' exceeds maximum 2 decimal places.", 400)

    if dec <= Decimal("0.00"):
        raise AppError("INVALID_AMOUNT", f"'{field_name}' must be greater than zero.", 400)

    return dec


def parse_expense_date(val: Any) -> date:
    """Parses and validates an expense business date, strictly disallowing future dates."""
    if val is None or str(val).strip() == "":
        raise AppError("VALIDATION_ERROR", "Field 'expense_date' is required.", 400)
    try:
        exp_date = date.fromisoformat(str(val).strip())
    except (ValueError, AttributeError):
        raise AppError("VALIDATION_ERROR", "Invalid date format for 'expense_date'. Expected YYYY-MM-DD.", 400)

    if exp_date > date.today():
        raise AppError("EXPENSE_DATE_IN_FUTURE", "Expense date cannot be in the future.", 400)

    return exp_date


def validate_category_create_input(data: Dict[str, Any]) -> Tuple[str, Optional[str]]:
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    name_raw = data.get("name")
    if not name_raw or not isinstance(name_raw, str) or not name_raw.strip():
        raise AppError("VALIDATION_ERROR", "Category 'name' is required and cannot be empty.", 400)

    name = name_raw.strip()

    desc_raw = data.get("description")
    description = None
    if desc_raw is not None:
        if not isinstance(desc_raw, str):
            raise AppError("VALIDATION_ERROR", "'description' must be a string.", 400)
        description = desc_raw.strip() or None

    return name, description


def validate_category_update_input(data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    updates = {}
    if "name" in data:
        name_raw = data.get("name")
        if not name_raw or not isinstance(name_raw, str) or not name_raw.strip():
            raise AppError("VALIDATION_ERROR", "Category 'name' cannot be blank.", 400)
        updates["name"] = name_raw.strip()

    if "description" in data:
        desc_raw = data.get("description")
        if desc_raw is not None and not isinstance(desc_raw, str):
            raise AppError("VALIDATION_ERROR", "'description' must be a string.", 400)
        updates["description"] = desc_raw.strip() if desc_raw else None

    if not updates:
        raise AppError("VALIDATION_ERROR", "No valid fields provided for category update.", 400)

    return updates


def validate_expense_create_input(data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    cat_id = data.get("category_id")
    if not cat_id or not isinstance(cat_id, int) or cat_id <= 0:
        raise AppError("VALIDATION_ERROR", "Valid integer 'category_id' is required.", 400)

    amount = parse_money_decimal(data.get("amount"), "amount")
    expense_date = parse_expense_date(data.get("expense_date"))

    desc_raw = data.get("description")
    description = None
    if desc_raw is not None:
        if not isinstance(desc_raw, str):
            raise AppError("VALIDATION_ERROR", "'description' must be a string.", 400)
        description = desc_raw.strip() or None

    return {
        "category_id": cat_id,
        "amount": amount,
        "expense_date": expense_date,
        "description": description,
    }


def validate_expense_update_input(data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    # Disallow client tampering with immutable system fields
    for forbidden_field in ("id", "created_by", "created_at", "updated_at"):
        if forbidden_field in data:
            raise AppError("VALIDATION_ERROR", f"Field '{forbidden_field}' cannot be modified.", 400)

    updates = {}
    if "category_id" in data:
        cat_id = data.get("category_id")
        if not cat_id or not isinstance(cat_id, int) or cat_id <= 0:
            raise AppError("VALIDATION_ERROR", "Valid integer 'category_id' is required.", 400)
        updates["category_id"] = cat_id

    if "amount" in data:
        updates["amount"] = parse_money_decimal(data.get("amount"), "amount")

    if "expense_date" in data:
        updates["expense_date"] = parse_expense_date(data.get("expense_date"))

    if "description" in data:
        desc_raw = data.get("description")
        if desc_raw is not None and not isinstance(desc_raw, str):
            raise AppError("VALIDATION_ERROR", "'description' must be a string.", 400)
        updates["description"] = desc_raw.strip() if desc_raw else None

    if not updates:
        raise AppError("VALIDATION_ERROR", "No valid fields provided for expense update.", 400)

    return updates


def expense_category_schema(category: ExpenseCategory) -> Dict[str, Any]:
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "is_active": category.is_active,
        "created_at": category.created_at.isoformat() if category.created_at else None,
        "updated_at": category.updated_at.isoformat() if category.updated_at else None,
    }


def expense_schema(expense: Expense) -> Dict[str, Any]:
    creator_info = None
    if expense.creator:
        creator_info = {
            "id": expense.creator.id,
            "name": f"{expense.creator.first_name} {expense.creator.last_name}".strip(),
            "email": expense.creator.email,
        }

    category_info = None
    if expense.category:
        category_info = {
            "id": expense.category.id,
            "name": expense.category.name,
            "is_active": expense.category.is_active,
        }

    return {
        "id": expense.id,
        "category_id": expense.category_id,
        "category": category_info,
        "amount": f"{expense.amount:.2f}",
        "description": expense.description,
        "expense_date": expense.expense_date.isoformat(),
        "created_by": expense.created_by,
        "creator": creator_info,
        "created_at": expense.created_at.isoformat() if expense.created_at else None,
        "updated_at": expense.updated_at.isoformat() if expense.updated_at else None,
    }


def expense_summary_schema(expense: Expense) -> Dict[str, Any]:
    category_name = expense.category.name if expense.category else "Unknown"
    creator_name = (
        f"{expense.creator.first_name} {expense.creator.last_name}".strip()
        if expense.creator
        else "Unknown"
    )
    return {
        "id": expense.id,
        "category_id": expense.category_id,
        "category_name": category_name,
        "amount": f"{expense.amount:.2f}",
        "description": expense.description,
        "expense_date": expense.expense_date.isoformat(),
        "created_by": expense.created_by,
        "creator_name": creator_name,
        "created_at": expense.created_at.isoformat() if expense.created_at else None,
    }
