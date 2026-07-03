from flask import Blueprint, jsonify, request, session

from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils.authorization import session_access_required
from utils.candidati_service import (
    CandidateActionBlocked,
    CandidateNotFound,
    import_candidates,
    list_candidates,
    toggle_candidate_checkin,
    update_reset_password,
)
from utils.oidc import ensure_fresh_access_token
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, get_user_roles


candidati_api_bp = Blueprint("api_v1_candidati", __name__)


@candidati_api_bp.get("/sessioni/<session_id>/candidati")
@api_auth_required
@session_access_required(allowed_roles={ROLE_ESPERTO, ROLE_ADMIN})
def candidati_index(session_id):
    return jsonify(
        session_id=session_id,
        items=list_candidates(
            session_id,
            query=(request.args.get("q") or "").strip(),
            checkin=request.args.get("checkin", "all"),
            reset=request.args.get("reset", "all"),
        ),
    )


@candidati_api_bp.post("/sessioni/<session_id>/candidati/import")
@api_auth_required
@session_access_required()
def candidati_import(session_id):
    token = ensure_fresh_access_token(skew_sec=60)
    if not token:
        return error_response(
            "reauthentication_required",
            "Sessione OIDC scaduta.",
            401,
        )
    result = import_candidates(
        session_id,
        user_email=session["user_email"],
        access_token=token,
    )
    if not result.get("success"):
        return error_response(
            "candidate_import_failed",
            result.get("message") or "Importazione candidati fallita.",
            502,
        )
    return jsonify(result)


@candidati_api_bp.post(
    "/sessioni/<session_id>/candidati/<uid>/toggle-checkin"
)
@api_auth_required
@session_access_required()
def candidato_toggle_checkin(session_id, uid):
    try:
        return jsonify(
            toggle_candidate_checkin(
                session_id,
                uid,
                actor_email=session["user_email"],
            )
        )
    except CandidateNotFound:
        return error_response("candidate_not_found", "Candidato non trovato.", 404)
    except CandidateActionBlocked as error:
        return error_response("candidate_action_blocked", str(error), 409)


@candidati_api_bp.post(
    "/sessioni/<session_id>/candidati/<uid>/reset-password"
)
@api_auth_required
@session_access_required(allowed_roles={ROLE_ESPERTO, ROLE_ADMIN})
def candidato_reset_password(session_id, uid):
    operation = (request.get_json(silent=True) or {}).get("operation", "request")
    roles = get_user_roles(session["user_email"])
    if operation == "complete" and not roles.intersection(
        {ROLE_ESPERTO, ROLE_ADMIN}
    ):
        return error_response("forbidden", "Operazione non autorizzata.", 403)
    try:
        return jsonify(
            update_reset_password(
                session_id,
                uid,
                operation=operation,
                actor_email=session["user_email"],
            )
        )
    except CandidateNotFound:
        return error_response("candidate_not_found", "Candidato non trovato.", 404)
    except CandidateActionBlocked as error:
        return error_response("candidate_action_blocked", str(error), 409)
