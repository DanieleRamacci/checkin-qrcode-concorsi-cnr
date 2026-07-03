from flask import Blueprint, current_app, jsonify, request, session

from routes.api_v1.auth import api_auth_required
from routes.api_v1.csrf import csrf_exempt
from routes.api_v1.errors import error_response
from utils.authorization import session_access_required
from utils.devices_service import (
    DeviceNotFound,
    DeviceUnauthorized,
    create_registration_token,
    disconnect_device,
    heartbeat_device,
    list_devices,
    register_device,
    verify_devices_connected,
)


devices_api_bp = Blueprint("api_v1_devices", __name__)


def _device_payload():
    data = request.get_json(silent=True) or {}
    session_id = str(data.get("session_id") or "").strip()
    device_token = str(data.get("device_token") or "").strip()
    if not session_id or not device_token:
        return None, error_response(
            "validation_error",
            "Parametri dispositivo mancanti.",
            422,
        )
    return (session_id, device_token), None


@devices_api_bp.get("/sessioni/<session_id>/devices")
@api_auth_required
@session_access_required()
def devices_index(session_id):
    return jsonify(session_id=session_id, items=list_devices(session_id))


@devices_api_bp.post("/sessioni/<session_id>/devices/registration-token")
@api_auth_required
@session_access_required()
def devices_registration_token(session_id):
    return jsonify(
        session_id=session_id,
        registration_token=create_registration_token(
            session_id,
            current_app.secret_key,
        ),
    )


@devices_api_bp.post("/sessioni/<session_id>/devices/verify")
@api_auth_required
@session_access_required()
def devices_verify(session_id):
    result = verify_devices_connected(session_id, session.get("user_email"))
    return jsonify(session_id=session_id, **result)


@devices_api_bp.post("/devices/register")
@csrf_exempt
def devices_register():
    data = request.get_json(silent=True) or {}
    session_id = str(data.get("session_id") or "").strip()
    token = str(data.get("registration_token") or data.get("token") or "").strip()
    if not session_id or not token:
        return error_response(
            "validation_error",
            "Sessione o token di registrazione mancanti.",
            422,
        )
    try:
        device_token = register_device(
            session_id,
            token,
            secret_key=current_app.secret_key,
            operator_email=session.get("user_email"),
            ip_address=request.remote_addr,
            user_agent=request.user_agent.string,
            device_name=str(data.get("device_name") or "").strip() or None,
        )
    except DeviceUnauthorized:
        return error_response(
            "device_unauthorized",
            "Token di registrazione non valido o scaduto.",
            403,
        )
    except DeviceNotFound:
        return error_response("session_not_found", "Sessione non trovata.", 404)
    return jsonify(device_token=device_token), 201


@devices_api_bp.post("/devices/ping")
@csrf_exempt
def devices_ping():
    values, error = _device_payload()
    if error:
        return error
    try:
        heartbeat_device(*values)
    except DeviceUnauthorized:
        return error_response(
            "device_unauthorized",
            "Dispositivo non autorizzato.",
            403,
        )
    return jsonify(success=True)


@devices_api_bp.post("/devices/disconnect")
@csrf_exempt
def devices_disconnect():
    values, error = _device_payload()
    if error:
        return error
    try:
        disconnect_device(*values)
    except DeviceUnauthorized:
        return error_response(
            "device_unauthorized",
            "Dispositivo non autorizzato.",
            403,
        )
    return jsonify(success=True)
