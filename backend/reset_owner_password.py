import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from werkzeug.security import generate_password_hash

from app import create_app
from app.modules.auth.services import AuthService


def main():
    load_dotenv()
    password = "Owner@123"
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    engine = create_engine(database_url)
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET password_hash = :pw WHERE email = :email"),
            {"pw": generate_password_hash(password), "email": "owner@gmail.com"},
        )

    app = create_app()
    with app.app_context():
        user_data, _, _ = AuthService.login("owner@gmail.com", password)
        print(f"LOGIN_OK: {user_data['email']} | role={user_data['role']}")

    print(f"OWNER_PASSWORD={password}")


if __name__ == "__main__":
    main()
