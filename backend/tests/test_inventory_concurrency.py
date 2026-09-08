import threading
import time
from decimal import Decimal
import pytest
from sqlalchemy import select

from app.common.errors import AppError
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Role
from app.modules.categories.models import Category
from app.modules.inventory.models import StockMovement
from app.modules.inventory.services import InventoryService
from app.modules.products.models import Product
from app.modules.users.models import User


@pytest.fixture(autouse=True)
def cleanup_concurrency_data(app):
    yield
    with app.app_context():
        AuditLog.query.filter(AuditLog.entity_type.in_(["Product", "Category", "StockMovement"])).delete()
        StockMovement.query.delete()
        Product.query.delete()
        Category.query.delete()
        User.query.filter_by(email="conc_tester@test.com").delete()
        db.session.commit()


def test_concurrent_competing_stock_deductions_prevent_negative_stock(app):
    """Verifies that PostgreSQL row-level locking (with_for_update) serializes concurrent deductions.

    Initial stock: 10.000
    Thread 1 attempts to deduct: 7.000
    Thread 2 attempts to deduct: 6.000
    Total requested: 13.000 > 10.000

    Expected result:
    - Exactly one deduction succeeds.
    - The competing deduction fails with INSUFFICIENT_STOCK.
    - Final stock is never negative (either 3.000 or 4.000).
    - Exactly one movement record exists.
    """
    with app.app_context():
        role = db.session.execute(select(Role).filter_by(name="OWNER")).scalar_one()
        user = db.session.execute(select(User).filter_by(email="conc_tester@test.com")).scalar_one_or_none()
        if not user:
            user = User(
                role_id=role.id,
                first_name="Conc",
                last_name="Tester",
                email="conc_tester@test.com",
                password_hash="pwd",
                is_active=True,
            )
            db.session.add(user)

        cat = Category(name="Concurrency Pantry", is_active=True)
        db.session.add(cat)
        db.session.commit()

        product = Product(
            category_id=cat.id,
            name="Limited Stock Butter 200g",
            sku="BTR-LTD-200G",
            unit="pcs",
            cost_price=Decimal("2.00"),
            selling_price=Decimal("3.50"),
            stock_quantity=Decimal("10.000"),
            reorder_level=Decimal("2.000"),
            is_active=True,
        )
        db.session.add(product)
        db.session.commit()

        product_id = product.id
        user_id = user.id

    results = []
    barrier = threading.Barrier(2)

    def perform_deduction(qty: Decimal, thread_id: int):
        with app.app_context():
            # Ensure fresh session for thread
            actor = db.session.get(User, user_id)
            try:
                # Wait for both threads to be ready to execute simultaneously
                barrier.wait(timeout=5)
                InventoryService.deduct_stock(
                    product_id=product_id,
                    quantity=qty,
                    movement_type="SALE",
                    actor=actor,
                    reference_type="CONCURRENCY_TEST",
                    reference_id=thread_id,
                    remarks=f"Thread {thread_id} deduction",
                )
                results.append({"thread": thread_id, "status": "SUCCESS", "error": None})
            except AppError as e:
                results.append({"thread": thread_id, "status": "ERROR", "error": e.code})
            except Exception as e:
                results.append({"thread": thread_id, "status": "EXCEPTION", "error": str(e)})
            finally:
                db.session.remove()

    t1 = threading.Thread(target=perform_deduction, args=(Decimal("7.000"), 1))
    t2 = threading.Thread(target=perform_deduction, args=(Decimal("6.000"), 2))

    t1.start()
    t2.start()

    t1.join(timeout=10)
    t2.join(timeout=10)

    assert len(results) == 2

    successes = [r for r in results if r["status"] == "SUCCESS"]
    errors = [r for r in results if r["status"] == "ERROR"]

    # Exactly one transaction succeeded, and the second failed with INSUFFICIENT_STOCK
    assert len(successes) == 1
    assert len(errors) == 1
    assert errors[0]["error"] == "INSUFFICIENT_STOCK"

    with app.app_context():
        final_product = db.session.get(Product, product_id)
        # Verify final stock is never negative
        assert final_product.stock_quantity >= Decimal("0.000")
        assert final_product.stock_quantity in (Decimal("3.000"), Decimal("4.000"))

        movements = StockMovement.query.filter_by(product_id=product_id).all()
        assert len(movements) == 1
        assert movements[0].quantity_after == final_product.stock_quantity
