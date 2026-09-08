from flask import Flask

from .config import Config
from .extensions import db, migrate, cors
from .commands import register_commands

# Register all domain models for Flask-SQLAlchemy and Alembic discovery
from . import modules  # noqa: F401

from sqlalchemy import text

def create_app():
    app = Flask(__name__)

    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)

    register_commands(app)

    # Register blueprints
    from .modules.auth.routes import auth_bp
    from .modules.users.routes import users_bp
    from .modules.categories.routes import categories_bp
    from .modules.products.routes import products_bp
    from .modules.inventory.routes import inventory_bp
    from .modules.suppliers.routes import suppliers_bp
    from .modules.purchasing.routes import purchasing_bp
    from .modules.sales.routes import sales_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(suppliers_bp)
    app.register_blueprint(purchasing_bp)
    app.register_blueprint(sales_bp)

    raw_frontend_url = app.config.get("FRONTEND_URL", "http://localhost:5173")
    origins = [o.strip() for o in raw_frontend_url.split(",") if o.strip()]
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

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "message": "Grocery SME API is running"
        }, 200

    @app.get("/api/health/database")
    def database_health():
        try:
            db.session.execute(text("SELECT 1"))

            return {
                "status": "ok",
                "database": "connected"
            }, 200

        except Exception:
            return {
                "status": "error",
                "database": "disconnected"
            }, 500

    return app

