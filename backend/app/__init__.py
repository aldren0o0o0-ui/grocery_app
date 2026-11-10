import os
from pathlib import Path

from flask import Flask, send_from_directory
from sqlalchemy import text

from .config import Config
from .extensions import db, migrate, cors
from .commands import register_commands

# Register all domain models for Flask-SQLAlchemy and Alembic discovery
from . import modules  # noqa: F401


# React production build directory
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def create_app():
    app = Flask(__name__)

    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)

    register_commands(app)

    # Automatically run migrations & seed roles / initial owner if enabled
    if os.getenv("AUTO_INIT_DB", "true").lower() in ("true", "1", "yes"):
        try:
            from .init_db import auto_init_database
            auto_init_database(app)
        except BaseException as e:
            app.logger.error("Database auto-init caught error: %s", e)

    # Register blueprints
    from .modules.auth.routes import auth_bp
    from .modules.users.routes import users_bp
    from .modules.categories.routes import categories_bp
    from .modules.products.routes import products_bp
    from .modules.inventory.routes import inventory_bp
    from .modules.suppliers.routes import suppliers_bp
    from .modules.purchasing.routes import purchasing_bp
    from .modules.sales.routes import sales_bp
    from .modules.returns.routes import returns_bp
    from .modules.expenses.routes import expense_categories_bp, expenses_bp
    from .modules.dashboard.routes import dashboard_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(suppliers_bp)
    app.register_blueprint(purchasing_bp)
    app.register_blueprint(sales_bp)
    app.register_blueprint(returns_bp)
    app.register_blueprint(expense_categories_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(dashboard_bp)

    # ---------------------------------------------------------
    # CORS
    # ---------------------------------------------------------

    raw_frontend_url = app.config.get(
        "FRONTEND_URL",
        "http://localhost:5173",
    )

    origins = [
        origin.strip()
        for origin in raw_frontend_url.split(",")
        if origin.strip()
    ]

    if "http://localhost:5173" not in origins:
        origins.append("http://localhost:5173")

    if "http://127.0.0.1:5173" not in origins:
        origins.append("http://127.0.0.1:5173")

    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": origins,
            }
        },
        supports_credentials=True,
    )

    # ---------------------------------------------------------
    # API HEALTH
    # ---------------------------------------------------------

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "message": "Grocery SME API is running",
        }, 200

    @app.get("/api/health/database")
    def database_health():
        try:
            db.session.execute(text("SELECT 1"))
            from sqlalchemy import func
            from app.modules.users.models import User
            user_count = db.session.execute(db.select(func.count(User.id))).scalar_one()

            return {
                "status": "ok",
                "database": "connected",
                "users_count": user_count,
            }, 200

        except Exception as e:
            return {
                "status": "error",
                "database": "disconnected_or_uninitialized",
                "details": str(e),
            }, 500

    # ---------------------------------------------------------
    # REACT SPA
    # ---------------------------------------------------------

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def serve_react(path):
        # Never intercept API routes.
        if path.startswith("api/"):
            return {"error": "API route not found"}, 404

        index_file = FRONTEND_DIST / "index.html"
        if index_file.is_file():
            requested_file = FRONTEND_DIST / path
            if requested_file.is_file():
                return send_from_directory(FRONTEND_DIST, path)
            # React Router fallback
            return send_from_directory(FRONTEND_DIST, "index.html")

        # If frontend is not bundled with the backend (e.g. standalone API deployment)
        if not path:
            return {
                "status": "ok",
                "service": "Grocery SME Backend API",
                "message": "API is running. Access endpoints under /api",
                "health": "/api/health",
                "database": "/api/health/database",
            }, 200

        return {"error": "Not found"}, 404

    return app




# from flask import Flask

# from .config import Config
# from .extensions import db, migrate, cors
# from .commands import register_commands

# # Register all domain models for Flask-SQLAlchemy and Alembic discovery
# from . import modules  # noqa: F401

# from sqlalchemy import text

# def create_app():
#     app = Flask(__name__)

#     app.config.from_object(Config)

#     db.init_app(app)
#     migrate.init_app(app, db)

#     register_commands(app)

#     # Register blueprints
#     from .modules.auth.routes import auth_bp
#     from .modules.users.routes import users_bp
#     from .modules.categories.routes import categories_bp
#     from .modules.products.routes import products_bp
#     from .modules.inventory.routes import inventory_bp
#     from .modules.suppliers.routes import suppliers_bp
#     from .modules.purchasing.routes import purchasing_bp
#     from .modules.sales.routes import sales_bp
#     from .modules.returns.routes import returns_bp
#     from .modules.expenses.routes import expense_categories_bp, expenses_bp
#     from .modules.dashboard.routes import dashboard_bp

#     app.register_blueprint(auth_bp)
#     app.register_blueprint(users_bp)
#     app.register_blueprint(categories_bp)
#     app.register_blueprint(products_bp)
#     app.register_blueprint(inventory_bp)
#     app.register_blueprint(suppliers_bp)
#     app.register_blueprint(purchasing_bp)
#     app.register_blueprint(sales_bp)
#     app.register_blueprint(returns_bp)
#     app.register_blueprint(expense_categories_bp)
#     app.register_blueprint(expenses_bp)
#     app.register_blueprint(dashboard_bp)

#     raw_frontend_url = app.config.get("FRONTEND_URL", "http://localhost:5173")
#     origins = [o.strip() for o in raw_frontend_url.split(",") if o.strip()]
#     if "http://localhost:5173" not in origins:
#         origins.append("http://localhost:5173")
#     if "http://127.0.0.1:5173" not in origins:
#         origins.append("http://127.0.0.1:5173")

#     cors.init_app(
#         app,
#         resources={
#             r"/api/*": {
#                 "origins": origins,
#             }
#         },
#         supports_credentials=True,
#     )

#     @app.get("/api/health")
#     def health():
#         return {
#             "status": "ok",
#             "message": "Grocery SME API is running"
#         }, 200

#     @app.get("/api/health/database")
#     def database_health():
#         try:
#             db.session.execute(text("SELECT 1"))

#             return {
#                 "status": "ok",
#                 "database": "connected"
#             }, 200

#         except Exception:
#             return {
#                 "status": "error",
#                 "database": "disconnected"
#             }, 500

#     return app

