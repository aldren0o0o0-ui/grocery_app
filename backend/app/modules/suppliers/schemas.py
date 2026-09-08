import re
from typing import Any, Dict, Optional
from app.common.errors import AppError
from app.modules.suppliers.models import Supplier

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_REGEX = re.compile(r"^[0-9+\-()\s]{3,50}$")


def validate_supplier_input(data: Dict[str, Any], is_update: bool = False) -> Dict[str, Any]:
    """Validates and normalizes supplier input payload."""
    if not isinstance(data, dict):
        raise AppError("VALIDATION_ERROR", "Request body must be a JSON object.", 400)

    # Invariant: Forbidden fields
    for field in ("id", "created_at", "updated_at", "is_active"):
        if field in data:
            if field == "is_active":
                raise AppError(
                    "VALIDATION_ERROR",
                    "Supplier status cannot be modified here. Use the /status endpoint.",
                    400,
                )
            raise AppError("VALIDATION_ERROR", f"Field '{field}' cannot be modified.", 400)

    clean_data: Dict[str, Any] = {}

    # Supplier Name
    if not is_update or "name" in data:
        name_raw = data.get("name")
        if not name_raw or not isinstance(name_raw, str) or not name_raw.strip():
            raise AppError("VALIDATION_ERROR", "Supplier name is required and cannot be empty.", 400)
        if len(name_raw.strip()) > 200:
            raise AppError("VALIDATION_ERROR", "Supplier name cannot exceed 200 characters.", 400)
        clean_data["name"] = name_raw.strip()

    # Contact Person
    if "contact_person" in data:
        cp_raw = data.get("contact_person")
        if cp_raw is None or (isinstance(cp_raw, str) and not cp_raw.strip()):
            clean_data["contact_person"] = None
        elif isinstance(cp_raw, str):
            clean_cp = cp_raw.strip()
            if len(clean_cp) > 100:
                raise AppError("VALIDATION_ERROR", "Contact person cannot exceed 100 characters.", 400)
            clean_data["contact_person"] = clean_cp
        else:
            raise AppError("VALIDATION_ERROR", "Field 'contact_person' must be a string.", 400)

    # Phone Number
    if "phone" in data:
        phone_raw = data.get("phone")
        if phone_raw is None or (isinstance(phone_raw, str) and not phone_raw.strip()):
            clean_data["phone"] = None
        elif isinstance(phone_raw, str):
            clean_phone = phone_raw.strip()
            if len(clean_phone) > 50:
                raise AppError("VALIDATION_ERROR", "Phone number cannot exceed 50 characters.", 400)
            if not PHONE_REGEX.match(clean_phone):
                raise AppError("VALIDATION_ERROR", "Field 'phone' contains invalid characters.", 400)
            clean_data["phone"] = clean_phone
        else:
            raise AppError("VALIDATION_ERROR", "Field 'phone' must be a string.", 400)

    # Email
    if "email" in data:
        email_raw = data.get("email")
        if email_raw is None or (isinstance(email_raw, str) and not email_raw.strip()):
            clean_data["email"] = None
        elif isinstance(email_raw, str):
            clean_email = email_raw.strip().lower()
            if len(clean_email) > 255:
                raise AppError("VALIDATION_ERROR", "Email cannot exceed 255 characters.", 400)
            if not EMAIL_REGEX.match(clean_email):
                raise AppError("VALIDATION_ERROR", "Field 'email' must be a valid email address.", 400)
            clean_data["email"] = clean_email
        else:
            raise AppError("VALIDATION_ERROR", "Field 'email' must be a string.", 400)

    # Address
    if "address" in data:
        addr_raw = data.get("address")
        if addr_raw is None or (isinstance(addr_raw, str) and not addr_raw.strip()):
            clean_data["address"] = None
        elif isinstance(addr_raw, str):
            clean_data["address"] = addr_raw.strip()
        else:
            raise AppError("VALIDATION_ERROR", "Field 'address' must be a string.", 400)

    return clean_data


def supplier_schema(supplier: Supplier, purchase_count: int = 0) -> Dict[str, Any]:
    """Serializes a Supplier entity into a safe response dictionary."""
    return {
        "id": supplier.id,
        "name": supplier.name,
        "contact_person": supplier.contact_person,
        "phone": supplier.phone,
        "email": supplier.email,
        "address": supplier.address,
        "is_active": supplier.is_active,
        "purchase_count": purchase_count,
        "created_at": supplier.created_at.isoformat() if supplier.created_at else None,
        "updated_at": supplier.updated_at.isoformat() if supplier.updated_at else None,
    }
