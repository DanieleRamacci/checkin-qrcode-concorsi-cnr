from http import HTTPStatus

from flask import current_app, g, jsonify
from werkzeug.exceptions import HTTPException


def error_response(
    code: str,
    message: str,
    status: int,
    *,
    details: dict | None = None,
):
    response = jsonify(
        {
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "request_id": getattr(g, "request_id", ""),
            }
        }
    )
    response.status_code = status
    return response


def register_error_handlers(blueprint):
    @blueprint.errorhandler(HTTPException)
    def handle_http_error(error):
        code = error.name.lower().replace(" ", "_")
        return error_response(code, error.description, error.code)

    @blueprint.errorhandler(Exception)
    def handle_unexpected_error(error):
        current_app.logger.exception("Errore non gestito API v1", exc_info=error)
        return error_response(
            "internal_error",
            HTTPStatus.INTERNAL_SERVER_ERROR.phrase,
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )
