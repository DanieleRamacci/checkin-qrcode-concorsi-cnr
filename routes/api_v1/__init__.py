from uuid import uuid4

from flask import Blueprint, g, jsonify, request

from routes.api_v1.csrf import validate_api_csrf
from routes.api_v1.errors import error_response, register_error_handlers


api_v1_bp = Blueprint("api_v1", __name__, url_prefix="/api/v1")
register_error_handlers(api_v1_bp)

from routes.api_v1.auth import auth_api_bp
from routes.api_v1.bandi import bandi_api_bp
from routes.api_v1.sessioni import sessioni_api_bp
from routes.api_v1.configurazioni import configurazioni_api_bp
from routes.api_v1.workflow import workflow_api_bp
from routes.api_v1.candidati import candidati_api_bp
from routes.api_v1.liste import liste_api_bp
from routes.api_v1.devices import devices_api_bp
from routes.api_v1.scanner import scanner_api_bp
from routes.api_v1.notifiche import notifiche_api_bp
from routes.api_v1.admin import admin_api_bp

api_v1_bp.register_blueprint(auth_api_bp)
api_v1_bp.register_blueprint(bandi_api_bp)
api_v1_bp.register_blueprint(sessioni_api_bp)
api_v1_bp.register_blueprint(configurazioni_api_bp)
api_v1_bp.register_blueprint(workflow_api_bp)
api_v1_bp.register_blueprint(candidati_api_bp)
api_v1_bp.register_blueprint(liste_api_bp)
api_v1_bp.register_blueprint(devices_api_bp)
api_v1_bp.register_blueprint(scanner_api_bp)
api_v1_bp.register_blueprint(notifiche_api_bp)
api_v1_bp.register_blueprint(admin_api_bp)


@api_v1_bp.before_request
def prepare_api_request():
    incoming_id = request.headers.get("X-Request-ID", "").strip()
    g.request_id = incoming_id[:128] if incoming_id else str(uuid4())
    return validate_api_csrf()


@api_v1_bp.after_request
def attach_request_id(response):
    response.headers["X-Request-ID"] = g.request_id
    return response


@api_v1_bp.get("/health")
def health():
    return jsonify(status="ok", request_id=g.request_id)


@api_v1_bp.route(
    "/<path:unmatched_path>",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
def api_not_found(unmatched_path):
    return error_response("not_found", "Risorsa API non trovata.", 404)
