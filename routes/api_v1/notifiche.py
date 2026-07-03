from datetime import date, datetime

from flask import Blueprint, jsonify, request, session

from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils.authorization import session_access_required
from utils.notifications import add_notification, get_notifications


notifiche_api_bp = Blueprint("api_v1_notifiche", __name__)


def _serialize(item):
    return {
        key: value.isoformat() if isinstance(value, (date, datetime)) else value
        for key, value in item.items()
    }


@notifiche_api_bp.get("/sessioni/<session_id>/notifications")
@api_auth_required
@session_access_required()
def notifications_index(session_id):
    try:
        limit = max(1, min(int(request.args.get("limit", 50)), 200))
    except ValueError:
        return error_response(
            "validation_error",
            "Il limite deve essere numerico.",
            422,
        )
    return jsonify(
        session_id=session_id,
        items=[
            _serialize(item)
            for item in get_notifications(session_id, limit=limit)
        ],
    )


@notifiche_api_bp.post("/sessioni/<session_id>/notifications")
@api_auth_required
@session_access_required()
def notifications_create(session_id):
    data = request.get_json(silent=True) or {}
    payload = str(data.get("payload") or "").strip()
    notification_type = str(data.get("type") or "message").strip()
    if not payload:
        return error_response(
            "validation_error",
            "Il messaggio è obbligatorio.",
            422,
            details={"payload": "Campo obbligatorio."},
        )
    add_notification(
        session_id,
        notification_type,
        payload=payload,
        author_email=session["user_email"],
    )
    return jsonify(created=True), 201
