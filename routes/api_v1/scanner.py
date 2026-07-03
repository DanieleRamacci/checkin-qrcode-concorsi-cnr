from flask import Blueprint, jsonify, request

from routes.api_v1.csrf import csrf_exempt
from routes.api_v1.errors import error_response
from utils.devices_service import DeviceUnauthorized
from utils.scanner_service import (
    ScannerCandidateNotFound,
    ScannerWorkflowBlocked,
    checkin_candidate,
    verify_candidate,
)


scanner_api_bp = Blueprint("api_v1_scanner", __name__)


def _scanner_payload():
    data = request.get_json(silent=True) or {}
    values = (
        str(data.get("session_id") or "").strip(),
        str(data.get("uid") or "").strip(),
        str(data.get("device_token") or "").strip(),
    )
    if not all(values):
        return None, error_response(
            "validation_error",
            "Parametri scanner mancanti.",
            422,
        )
    return values, None


def _execute(operation):
    values, error = _scanner_payload()
    if error:
        return error
    try:
        return jsonify(operation(*values))
    except DeviceUnauthorized:
        return error_response(
            "device_unauthorized",
            "Dispositivo non autorizzato.",
            403,
        )
    except ScannerCandidateNotFound:
        return error_response("candidate_not_found", "Candidato non trovato.", 404)
    except ScannerWorkflowBlocked as blocked:
        return error_response("checkin_not_active", str(blocked), 409)


@scanner_api_bp.post("/scanner/verify-candidate")
@csrf_exempt
def scanner_verify_candidate():
    return _execute(verify_candidate)


@scanner_api_bp.post("/scanner/checkin-candidate")
@csrf_exempt
def scanner_checkin_candidate():
    return _execute(checkin_candidate)
