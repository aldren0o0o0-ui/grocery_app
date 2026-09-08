from typing import Any, Dict, Optional
from app.common.errors import AppError
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.suppliers.models import Supplier
from app.modules.suppliers.repository import SupplierRepository
from app.modules.suppliers.schemas import supplier_schema, validate_supplier_input
from app.modules.users.models import User


class SupplierService:
    """Service governing business logic, normalization, and atomic mutations for Suppliers."""

    @staticmethod
    def get_supplier(supplier_id: int) -> Dict[str, Any]:
        """Retrieves a single supplier by ID."""
        row = SupplierRepository.get_by_id(supplier_id)
        if not row:
            raise AppError("SUPPLIER_NOT_FOUND", f"Supplier with ID {supplier_id} not found.", 404)
        supplier, purchase_count = row
        return supplier_schema(supplier, purchase_count)

    @staticmethod
    def list_suppliers(
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Retrieves paginated suppliers list."""
        items, total, pages = SupplierRepository.list_suppliers(
            page=page,
            per_page=per_page,
            search=search,
            is_active=is_active,
        )
        return {
            "items": [supplier_schema(s, count) for s, count in items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages,
            },
        }

    @staticmethod
    def create_supplier(data: Dict[str, Any], actor: User) -> Dict[str, Any]:
        """Creates a new supplier within an atomic transaction with audit logging."""
        clean_data = validate_supplier_input(data, is_update=False)

        # Check case-insensitive uniqueness
        existing = SupplierRepository.find_by_name(clean_data["name"])
        if existing:
            raise AppError(
                "SUPPLIER_NAME_EXISTS",
                f"A supplier with name '{clean_data['name']}' already exists.",
                409,
            )

        try:
            supplier = Supplier(
                name=clean_data["name"],
                contact_person=clean_data.get("contact_person"),
                phone=clean_data.get("phone"),
                email=clean_data.get("email"),
                address=clean_data.get("address"),
                is_active=True,
            )
            SupplierRepository.create(supplier)
            db.session.flush()

            audit = AuditLog(
                user_id=actor.id,
                action="SUPPLIER_CREATED",
                entity_type="Supplier",
                entity_id=supplier.id,
                description=f"Supplier '{supplier.name}' (ID: {supplier.id}) created.",
            )
            db.session.add(audit)

            db.session.commit()
            return supplier_schema(supplier, 0)
        except Exception:
            db.session.rollback()
            raise

    @staticmethod
    def update_supplier(supplier_id: int, data: Dict[str, Any], actor: User) -> Dict[str, Any]:
        """Updates supplier attributes with duplicate checking and audit logging."""
        row = SupplierRepository.get_by_id(supplier_id)
        if not row:
            raise AppError("SUPPLIER_NOT_FOUND", f"Supplier with ID {supplier_id} not found.", 404)
        supplier, purchase_count = row

        clean_data = validate_supplier_input(data, is_update=True)

        # Name conflict check excluding current supplier
        if "name" in clean_data:
            conflict = SupplierRepository.find_name_conflict(clean_data["name"], exclude_id=supplier.id)
            if conflict:
                raise AppError(
                    "SUPPLIER_NAME_EXISTS",
                    f"A supplier with name '{clean_data['name']}' already exists.",
                    409,
                )
            supplier.name = clean_data["name"]

        if "contact_person" in clean_data:
            supplier.contact_person = clean_data["contact_person"]
        if "phone" in clean_data:
            supplier.phone = clean_data["phone"]
        if "email" in clean_data:
            supplier.email = clean_data["email"]
        if "address" in clean_data:
            supplier.address = clean_data["address"]

        try:
            audit = AuditLog(
                user_id=actor.id,
                action="SUPPLIER_UPDATED",
                entity_type="Supplier",
                entity_id=supplier.id,
                description=f"Supplier '{supplier.name}' (ID: {supplier.id}) profile updated.",
            )
            db.session.add(audit)

            db.session.commit()
            return supplier_schema(supplier, purchase_count)
        except Exception:
            db.session.rollback()
            raise

    @staticmethod
    def set_supplier_status(supplier_id: int, is_active: bool, actor: User) -> Dict[str, Any]:
        """Activates or deactivates a supplier safely without physical deletion."""
        row = SupplierRepository.get_by_id(supplier_id)
        if not row:
            raise AppError("SUPPLIER_NOT_FOUND", f"Supplier with ID {supplier_id} not found.", 404)
        supplier, purchase_count = row

        supplier.is_active = is_active
        status_label = "activated" if is_active else "deactivated"

        try:
            audit = AuditLog(
                user_id=actor.id,
                action="SUPPLIER_STATUS_CHANGED",
                entity_type="Supplier",
                entity_id=supplier.id,
                description=f"Supplier '{supplier.name}' (ID: {supplier.id}) was {status_label}.",
            )
            db.session.add(audit)

            db.session.commit()
            return supplier_schema(supplier, purchase_count)
        except Exception:
            db.session.rollback()
            raise
