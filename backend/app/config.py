import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-development-secret")

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # JWT configuration
    _base_secret = os.getenv("SECRET_KEY") or "grocery-sme-development-secret-key"
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or f"{_base_secret}-jwt-signature-salt-32b"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "15"))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "7"))
    )
    JWT_COOKIE_NAME = os.getenv("JWT_COOKIE_NAME", "refresh_token")
    JWT_COOKIE_SECURE = os.getenv("JWT_COOKIE_SECURE", "false").lower() in ("true", "1", "yes")
    JWT_COOKIE_SAMESITE = os.getenv("JWT_COOKIE_SAMESITE", "Lax")
    JWT_COOKIE_PATH = "/api/auth"

    # Business timezone for operational day boundaries
    BUSINESS_TIMEZONE = os.getenv("BUSINESS_TIMEZONE", "Asia/Manila")