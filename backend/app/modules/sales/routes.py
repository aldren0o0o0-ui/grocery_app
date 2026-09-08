from datetime import date
from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, select

from app.common.errors import AppError, api_error
from app.extensions import db
from app.modules.auth.decorators import jwt_required, require_roles
from app.modules.products.models import Product
from app.modules.sales.schemas import (
    pos_product_schema,
    sale_schema,
    sale_summary_schema,
)
from app.modules.sales.services import SalesService

sales_bp = Blueprint("sales", __name__, url_prefix="/api/sales")


def parse_query_date(val: str, field_name: str) -> date:
    try:
        return date.fromisoformat(val.strip())
    except (ValueError, AttributeError):
        raise AppError("VALIDATION_ERROR", f"Invalid date format for '{field_name}'. Expected YYYY-MM-DD.", 400)


@sales_bp.get("/products")
@jwt_required()
@require_roles("OWNER", "CASHIER")
def get_pos_products():
    """Returns active products for POS product search and barcode lookup."""
    try:
        search = request.args.get("search", default="", type=str).strip()
        category_id = request.args.get("category_id", default=None, type=int)
        page = request.args.get("page", default=1, type=int)
        per_page = request.args.get("per_page", default=50, type=int)

        query = select(Product).filter(Product.is_active.is_(True))
        count_query = select(func.count(Product.id)).filter(Product.is_active.is_(True))

        if category_id:
            query = query.filter(Product.category_id == category_id)
            count_query = count_query.filter(Product.category_id == category_id)

        if search:
            search_term = f"%{search}%"
            # Prioritize exact barcode / SKU match or substring name / SKU / barcode
            search_filter = (
                (Product.barcode == search)
                | (Product.sku.ilike(search))
                | Product.name.ilike(search_term)
                | Product.sku.ilike(search_term)
                | Product.barcode.ilike(search_term)
            )
            query = query.filter(search_filter)
            count_query = count_query.filter(search_filter)

        total = db.session.execute(count_query).scalar_one()

        offset = (page - 1) * per_page
        query = query.order_by(Product.name.asc()).offset(offset).limit(per_page)
        products = list(db.session.execute(query).scalars().all())

        return jsonify({
            "products": [pos_product_schema(p) for p in products],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": (total + per_page - 1) // per_page if per_page > 0 else 1,
            },
        }), 200

    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while searching POS products.", 500)


@sales_bp.post("")
@jwt_required()
@require_roles("OWNER", "CASHIER")
def checkout_sale():
    """Executes atomic POS checkout transaction."""
    try:
        data = request.get_json() or {}
        sale = SalesService.checkout(data, g.current_user)
        is_owner = (g.current_user.role.name == "OWNER")
        return jsonify({"sale": sale_schema(sale, is_owner=is_owner)}), 201
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred during sale checkout.", 500)


@sales_bp.get("")
@jwt_required()
@require_roles("OWNER", "CASHIER")
def list_sales():
    """Returns paginated sales history with role-based scoping."""
    try:
        page = request.args.get("page", default=1, type=int)
        per_page = request.args.get("per_page", default=20, type=int)
        search = request.args.get("search", default=None, type=str)
        status = request.args.get("status", default=None, type=str)
        payment_method = request.args.get("payment_method", default=None, type=str)

        date_from_raw = request.args.get("date_from", default=None, type=str)
        date_to_raw = request.args.get("date_to", default=None, type=str)

        date_from = parse_query_date(date_from_raw, "date_from") if date_from_raw else None
        date_to = parse_query_date(date_to_raw, "date_to") if date_to_raw else None

        # CASHIER can view own sales only; OWNER can view all or filter by cashier_id
        is_owner = (g.current_user.role.name == "OWNER")
        if not is_owner:
            cashier_id = g.current_user.id
        else:
            cashier_id = request.args.get("cashier_id", default=None, type=int)

        sales, total = SalesService.list_sales(
            cashier_id=cashier_id,
            status=status,
            payment_method=payment_method,
            date_from=date_from,
            date_to=date_to,
            search=search,
            page=page,
            per_page=per_page,
        )

        pages = (total + per_page - 1) // per_page if per_page > 0 else 1
        return jsonify({
            "sales": [sale_summary_schema(s) for s in sales],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": pages,
            },
        }), 200

    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching sales.", 500)


@sales_bp.get("/<int:sale_id>")
@jwt_required()
@require_roles("OWNER", "CASHIER")
def get_sale_detail(sale_id: int):
    """Retrieves full sale receipt breakdown with role-based cost price exposure."""
    try:
        sale = SalesService.get_sale(sale_id)

        # CASHIER may only access own sales
        is_owner = (g.current_user.role.name == "OWNER")
        if not is_owner and sale.cashier_id != g.current_user.id:
            return api_error("FORBIDDEN", "You are not authorized to view sales from other cashiers.", 403)

        return jsonify({"sale": sale_schema(sale, is_owner=is_owner)}), 200

    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred while fetching sale details.", 500)
