import logging
import os
from pathlib import Path
from flask import Flask
from sqlalchemy import func

logger = logging.getLogger("grocery.init_db")


def auto_init_database(app: Flask) -> None:
    """Safely and idempotently ensure database tables, roles, and initial owner exist."""
    try:
        with app.app_context():
            db_uri = app.config.get("SQLALCHEMY_DATABASE_URI")
            if not db_uri:
                logger.warning("SQLALCHEMY_DATABASE_URI not set. Skipping database initialization.")
                return

            # 1. Ensure all tables are created using SQLAlchemy models
            from app.extensions import db
            try:
                db.create_all()
                logger.info("Database tables verified/created via db.create_all().")
            except BaseException as e:
                logger.warning("db.create_all note: %s", e)

            # 2. Seed standard roles (OWNER, STAFF, CASHIER)
            try:
                from app.commands import seed_roles_data
                seeded = seed_roles_data()
                if seeded:
                    logger.info("Seeded initial roles: %s", seeded)
            except BaseException as e:
                logger.error("Failed seeding roles: %s", e)

            # 3. Seed default expense categories
            try:
                from app.modules.expenses.models import ExpenseCategory

                defaults = [
                    {"name": "Rent", "description": "Store rental and lease payments"},
                    {"name": "Electricity", "description": "Utility bills for power and lighting"},
                    {"name": "Water", "description": "Utility bills for water supply"},
                    {"name": "Internet", "description": "Store telecommunications and broadband fees"},
                    {"name": "Transportation", "description": "Delivery, fuel, and logistics expenses"},
                    {"name": "Maintenance", "description": "Store repairs, equipment servicing, and upkeep"},
                    {"name": "Supplies", "description": "Packaging, bags, stationery, and consumables"},
                    {"name": "Miscellaneous", "description": "General petty cash and unforeseen operational expenses"},
                ]
                for d in defaults:
                    clean_name = d["name"].strip()
                    existing = db.session.execute(
                        db.select(ExpenseCategory).filter(func.lower(ExpenseCategory.name) == clean_name.lower())
                    ).scalar_one_or_none()
                    if not existing:
                        db.session.add(ExpenseCategory(name=clean_name, description=d["description"], is_active=True))
                db.session.commit()
            except BaseException as e:
                logger.error("Failed seeding expense categories: %s", e)

            # 4. Seed initial OWNER user if none exists
            try:
                from app.modules.auth.models import Role
                from app.modules.users.models import User
                from werkzeug.security import generate_password_hash

                owner_role = db.session.execute(db.select(Role).filter_by(name="OWNER")).scalar_one_or_none()
                if owner_role:
                    owner_count = db.session.execute(
                        db.select(func.count(User.id)).filter_by(role_id=owner_role.id)
                    ).scalar_one()

                    if owner_count == 0:
                        owner_email = os.getenv("DEFAULT_OWNER_EMAIL", "owner@gmail.com").strip().lower()
                        owner_password = os.getenv("DEFAULT_OWNER_PASSWORD", "Owner@123")
                        first_name = os.getenv("DEFAULT_OWNER_FIRST_NAME", "Store")
                        last_name = os.getenv("DEFAULT_OWNER_LAST_NAME", "Owner")

                        new_owner = User(
                            first_name=first_name,
                            last_name=last_name,
                            email=owner_email,
                            password_hash=generate_password_hash(owner_password),
                            role_id=owner_role.id,
                            is_active=True,
                        )
                        db.session.add(new_owner)
                        db.session.commit()
                        logger.info("Created default OWNER account: %s", owner_email)
            except BaseException as e:
                logger.error("Failed checking or creating initial owner: %s", e)

    except BaseException as e:
        logger.error("Top-level auto_init_database exception: %s", e)
