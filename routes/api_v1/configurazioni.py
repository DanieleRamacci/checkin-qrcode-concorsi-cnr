import re
from datetime import date, datetime

from flask import Blueprint, jsonify, request, session

from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils.bando_service import list_expert_emails, request_bando_configuration
from utils.authorization import commission_access_required, session_access_required
from utils.sessioni import (
    get_bando_config,
    get_sessione_config,
    save_bando_config,
    save_sessione_config,
)
from utils.stato import get_stato_corrente, set_stato_corrente


configurazioni_api_bp = Blueprint("api_v1_configurazioni", __name__)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
BANDO_FIELDS = {
    "email_referente",
    "email_esperto_remoto",
    "email_segretario",
    "telefono_segretario",
    "durata_prova_minuti",
    "commissione_members",
}
SESSION_FIELDS = {
    "nome_informatico_sede",
    "email_informatico_sede",
    "telefono_informatico_sede",
    "data_accesso_piattaforma",
}


def _serialize(value):
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _payload(allowed_fields: set[str]):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, {"body": "È richiesto un oggetto JSON."}

    errors = {
        field: "Campo non riconosciuto."
        for field in data
        if field not in allowed_fields
    }
    cleaned = {}
    for field, value in data.items():
        if field not in allowed_fields:
            continue
        if isinstance(value, str):
            value = value.strip()
        cleaned[field] = value

    for field in (name for name in allowed_fields if name.startswith("email_")):
        value = cleaned.get(field)
        if value and (
            len(value) > 254 or not EMAIL_PATTERN.fullmatch(str(value))
        ):
            errors[field] = "Indirizzo email non valido."
    return cleaned, errors


@configurazioni_api_bp.get("/bandi/<commission_id>/config")
@api_auth_required
@commission_access_required()
def bando_config_get(commission_id):
    config = get_bando_config(commission_id) or {}
    return jsonify(
        commission_id=commission_id,
        expert_options=list_expert_emails(),
        **_serialize(config),
    )


@configurazioni_api_bp.put("/bandi/<commission_id>/config")
@api_auth_required
@commission_access_required()
def bando_config_put(commission_id):
    data, errors = _payload(BANDO_FIELDS)
    if errors:
        return error_response(
            "validation_error",
            "Dati di configurazione non validi.",
            422,
            details=errors,
        )
    current = get_bando_config(commission_id) or {}
    merged = {**current, **data}
    save_bando_config(
        commission_id,
        merged.get("email_referente"),
        merged.get("email_esperto_remoto"),
        merged.get("email_segretario"),
        merged.get("telefono_segretario"),
        merged.get("durata_prova_minuti"),
        merged.get("commissione_members"),
        configured_by=session["user_email"],
    )
    return jsonify(
        commission_id=commission_id,
        **_serialize(get_bando_config(commission_id) or merged),
    )


@configurazioni_api_bp.post("/bandi/<commission_id>/request-config")
@api_auth_required
@commission_access_required()
def bando_config_request(commission_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_response(
            "validation_error",
            "Dati della richiesta non validi.",
            422,
            details={"body": "È richiesto un oggetto JSON."},
        )
    referente_email = str(data.get("email_referente") or "").strip()
    if (
        not referente_email
        or len(referente_email) > 254
        or not EMAIL_PATTERN.fullmatch(referente_email)
    ):
        return error_response(
            "validation_error",
            "Dati della richiesta non validi.",
            422,
            details={"email_referente": "Indirizzo email non valido."},
        )

    config_url = (
        request.url_root.rstrip("/")
        + f"/bandi/{commission_id}/config"
    )
    result = request_bando_configuration(
        commission_id,
        referente_email,
        session["user_email"],
        config_url,
    )
    if not result["success"]:
        return error_response(
            "notification_failed",
            result["message"],
            502,
            details={"email_referente": referente_email},
        )
    return jsonify(result)


@configurazioni_api_bp.get("/sessioni/<session_id>/config")
@api_auth_required
@session_access_required()
def sessione_config_get(session_id):
    config = get_sessione_config(session_id) or {}
    return jsonify(session_id=session_id, **_serialize(config))


@configurazioni_api_bp.put("/sessioni/<session_id>/config")
@api_auth_required
@session_access_required()
def sessione_config_put(session_id):
    data, errors = _payload(SESSION_FIELDS)
    if errors:
        return error_response(
            "validation_error",
            "Dati di configurazione non validi.",
            422,
            details=errors,
        )
    current = get_sessione_config(session_id) or {}
    merged = {**current, **data}
    save_sessione_config(
        session_id,
        merged.get("nome_informatico_sede"),
        merged.get("email_informatico_sede"),
        merged.get("telefono_informatico_sede"),
        merged.get("data_accesso_piattaforma"),
    )
    if get_stato_corrente(session_id) == "iniziale":
        set_stato_corrente(
            session_id,
            "configurata",
            utente=session["user_email"],
        )
    return jsonify(
        session_id=session_id,
        **_serialize(get_sessione_config(session_id) or merged),
    )
