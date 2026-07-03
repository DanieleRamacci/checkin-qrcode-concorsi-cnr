from flask import Blueprint, jsonify, request, send_file, session

from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils.authorization import session_access_required
from utils.liste_service import (
    ListOperationError,
    generate_lists,
    get_download_path,
    get_latest_list,
    send_latest_list,
)


liste_api_bp = Blueprint("api_v1_liste", __name__)


@liste_api_bp.get("/sessioni/<session_id>/lists/latest")
@api_auth_required
@session_access_required()
def lists_latest(session_id):
    result = get_latest_list(session_id)
    if not result:
        return error_response("list_not_found", "Lista non trovata.", 404)
    return jsonify(result)


@liste_api_bp.post("/sessioni/<session_id>/lists/generate")
@api_auth_required
@session_access_required()
def lists_generate(session_id):
    try:
        return jsonify(
            generate_lists(session_id, actor_email=session["user_email"])
        )
    except ListOperationError as error:
        return error_response("list_operation_failed", str(error), 409)


@liste_api_bp.get("/sessioni/<session_id>/lists/download")
@api_auth_required
@session_access_required()
def lists_download(session_id):
    try:
        path, filename = get_download_path(
            session_id,
            request.args.get("type", ""),
        )
    except ListOperationError as error:
        return error_response("list_not_found", str(error), 404)
    return send_file(path, as_attachment=True, download_name=filename)


@liste_api_bp.post("/sessioni/<session_id>/lists/send")
@api_auth_required
@session_access_required()
def lists_send(session_id):
    payload = request.get_json(silent=True) or {}
    recipients = payload.get("recipients")
    if recipients is not None and not isinstance(recipients, list):
        return error_response(
            "validation_error",
            "Il campo recipients deve essere una lista.",
            422,
            details={"recipients": "Formato non valido."},
        )
    try:
        return jsonify(
            send_latest_list(
                session_id,
                actor_email=session["user_email"],
                recipients=recipients,
            )
        )
    except ListOperationError as error:
        return error_response("list_operation_failed", str(error), 409)
