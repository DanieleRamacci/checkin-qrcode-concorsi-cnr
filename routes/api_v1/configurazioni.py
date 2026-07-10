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
    "data_accesso_piattaforma",
    "commissione_members",
}
BANDO_READONLY_FIELDS = {
    "commission_id",
    "commissione_nomi",
    "config_status",
    "configured_at",
    "configured_by",
    "expert_assigned",
    "expert_options",
    "fetched_at",
    "rdp_members",
    "rdp_nomi",
    "rdp_options",
    "required_data_complete",
    "secretary_options",
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


def _payload(allowed_fields: set[str], ignored_fields: set[str] | None = None):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, {"body": "È richiesto un oggetto JSON."}

    ignored_fields = ignored_fields or set()
    errors = {
        field: "Campo non riconosciuto."
        for field in data
        if field not in allowed_fields and field not in ignored_fields
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


def _normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _rdp_options(config: dict) -> list[dict]:
    options = []
    seen = set()
    for person in config.get("rdp_members") or []:
        if not isinstance(person, dict):
            continue
        email = _normalize_email(person.get("email"))
        if not email or email in seen:
            continue
        seen.add(email)
        options.append(
            {
                "nome": person.get("nome") or person.get("name") or email,
                "email": email,
            }
        )
    return options


def _secretary_options(config: dict) -> list[dict]:
    options = []
    seen = set()
    for person in config.get("commissione_members") or []:
        if not isinstance(person, dict):
            continue
        if (person.get("ruolo") or "").upper() != "SEGRETARIO":
            continue
        email = _normalize_email(person.get("email"))
        if not email or email in seen:
            continue
        seen.add(email)
        options.append(
            {
                "nome": person.get("nome") or person.get("name") or email,
                "email": email,
            }
        )
    return options


def _referente_selection_error(config: dict, email: str) -> str | None:
    options = _rdp_options(config)
    if not options:
        return None
    allowed = {_normalize_email(option["email"]) for option in options}
    if _normalize_email(email) not in allowed:
        return "Selezionare uno degli RDP disponibili per il bando."
    return None


@configurazioni_api_bp.get("/bandi/<commission_id>/config")
@api_auth_required
@commission_access_required(allow_referente=True)
def bando_config_get(commission_id):
    config = get_bando_config(commission_id) or {}
    return jsonify(
        commission_id=commission_id,
        expert_options=list_expert_emails(),
        rdp_options=_rdp_options(config),
        secretary_options=_secretary_options(config),
        **_serialize(config),
    )


@configurazioni_api_bp.put("/bandi/<commission_id>/config")
@api_auth_required
@commission_access_required(allow_referente=True)
def bando_config_put(commission_id):
    data, errors = _payload(BANDO_FIELDS, BANDO_READONLY_FIELDS)
    if errors:
        return error_response(
            "validation_error",
            "Dati di configurazione non validi.",
            422,
            details=errors,
        )
    current = get_bando_config(commission_id) or {}
    if "email_referente" in data:
        selection_error = _referente_selection_error(current, data.get("email_referente"))
        current_email = _normalize_email(current.get("email_referente"))
        new_email = _normalize_email(data.get("email_referente"))
        if selection_error and new_email != current_email:
            return error_response(
                "validation_error",
                "Dati di configurazione non validi.",
                422,
                details={"email_referente": selection_error},
            )
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
        data_accesso_piattaforma=merged.get("data_accesso_piattaforma"),
    )
    return jsonify(
        commission_id=commission_id,
        **_serialize(get_bando_config(commission_id) or merged),
    )


@configurazioni_api_bp.post("/bandi/<commission_id>/request-config")
@api_auth_required
@commission_access_required(allow_referente=True)
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
    config = get_bando_config(commission_id) or {}
    selection_error = _referente_selection_error(config, referente_email)
    if selection_error:
        return error_response(
            "validation_error",
            "Dati della richiesta non validi.",
            422,
            details={"email_referente": selection_error},
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
