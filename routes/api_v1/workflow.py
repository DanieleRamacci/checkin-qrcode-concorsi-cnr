from flask import Blueprint, jsonify, session

from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils import authorization
from utils.authorization import session_access_required
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO
from utils.workflow_service import (
    InvalidTransition,
    SessionNotFound,
    describe_workflow,
    execute_workflow_action,
    is_expert_action,
)


workflow_api_bp = Blueprint("api_v1_workflow", __name__)


@workflow_api_bp.get("/sessioni/<session_id>/state")
@api_auth_required
@session_access_required(allowed_roles={ROLE_ESPERTO, ROLE_ADMIN})
def workflow_state(session_id):
    try:
        return jsonify(describe_workflow(session_id))
    except SessionNotFound:
        return error_response("session_not_found", "Sessione non trovata.", 404)


@workflow_api_bp.post("/sessioni/<session_id>/actions/<action>")
@api_auth_required
def workflow_action(session_id, action):
    email = session["user_email"]
    allowed_roles = {ROLE_ESPERTO, ROLE_ADMIN} if is_expert_action(action) else ()
    if not authorization.can_access_session(
        email,
        session_id,
        allowed_roles=allowed_roles,
    ):
        return error_response("forbidden", "Operazione non autorizzata.", 403)
    try:
        result = execute_workflow_action(
            session_id,
            action,
            actor_email=email,
        )
    except SessionNotFound:
        return error_response("session_not_found", "Sessione non trovata.", 404)
    except InvalidTransition as error:
        return error_response(
            "invalid_transition",
            str(error),
            409,
        )
    return jsonify(result)
