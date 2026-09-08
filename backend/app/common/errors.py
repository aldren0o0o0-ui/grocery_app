from typing import Any, Dict, Tuple
from flask import jsonify, Response


class AppError(Exception):
    """Base application exception supporting error code and HTTP status code."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def api_error(code: str, message: str, status_code: int = 400) -> Tuple[Response, int]:
    """Generates standard API error envelope response."""
    return (
        jsonify(
            {
                "error": {
                    "code": code,
                    "message": message,
                }
            }
        ),
        status_code,
    )
