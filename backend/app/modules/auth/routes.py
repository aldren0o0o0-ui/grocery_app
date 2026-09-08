from flask import Blueprint, Response, current_app, jsonify, make_response, request

from app.common.errors import AppError, api_error
from app.modules.auth.decorators import jwt_required
from app.modules.auth.schemas import validate_login_input
from app.modules.auth.services import AuthService

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def set_refresh_cookie(response: Response, refresh_token: str) -> Response:
    cookie_name = current_app.config.get("JWT_COOKIE_NAME", "refresh_token")
    secure = current_app.config.get("JWT_COOKIE_SECURE", False)
    samesite = current_app.config.get("JWT_COOKIE_SAMESITE", "Lax")
    path = current_app.config.get("JWT_COOKIE_PATH", "/api/auth")
    max_age = int(current_app.config.get("JWT_REFRESH_TOKEN_EXPIRES").total_seconds())

    response.set_cookie(
        key=cookie_name,
        value=refresh_token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path=path,
    )
    return response


def clear_refresh_cookie(response: Response) -> Response:
    cookie_name = current_app.config.get("JWT_COOKIE_NAME", "refresh_token")
    path = current_app.config.get("JWT_COOKIE_PATH", "/api/auth")
    samesite = current_app.config.get("JWT_COOKIE_SAMESITE", "Lax")
    secure = current_app.config.get("JWT_COOKIE_SECURE", False)

    response.delete_cookie(
        key=cookie_name,
        path=path,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )
    return response


@auth_bp.post("/login")
def login():
    try:
        data = request.get_json() or {}
        email, password = validate_login_input(data)
        user_data, access_token, refresh_token = AuthService.login(email, password)

        resp = make_response(
            jsonify(
                {
                    "access_token": access_token,
                    "user": user_data,
                }
            ),
            200,
        )
        return set_refresh_cookie(resp, refresh_token)
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred during login.", 500)


@auth_bp.post("/refresh")
def refresh():
    try:
        cookie_name = current_app.config.get("JWT_COOKIE_NAME", "refresh_token")
        refresh_token = request.cookies.get(cookie_name)

        user_data, new_access_token, new_refresh_token = AuthService.refresh(refresh_token)

        resp = make_response(
            jsonify(
                {
                    "access_token": new_access_token,
                    "user": user_data,
                }
            ),
            200,
        )
        return set_refresh_cookie(resp, new_refresh_token)
    except AppError as e:
        return api_error(e.code, e.message, e.status_code)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred during token refresh.", 500)


@auth_bp.post("/logout")
@jwt_required(optional=True)
def logout():
    try:
        from flask import g
        current_user = getattr(g, "current_user", None)
        AuthService.logout(current_user)

        resp = make_response(jsonify({"message": "Successfully logged out."}), 200)
        return clear_refresh_cookie(resp)
    except Exception:
        return api_error("INTERNAL_ERROR", "An unexpected error occurred during logout.", 500)
