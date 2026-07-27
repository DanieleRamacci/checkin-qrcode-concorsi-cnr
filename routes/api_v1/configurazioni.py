import re
from datetime import date, datetime

from flask import Blueprint, jsonify, request, session

from db import get_db_connection
from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils.bando_service import list_expert_emails, request_bando_configuration
from utils import authorization
from utils.authorization import commission_access_required, session_access_required
from utils.sessioni import (
    get_bando_config,
    get_sessione_by_id,
    get_sessione_config,
    save_bando_config,
    save_sessione_config,
)
from utils.stato import get_stato_corrente, set_stato_corrente


configurazioni_api_bp = Blueprint("api_v1_configurazioni", __name__)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
BANDO_FIELDS = {
    "email_referente",
    "email_segretario",
    "telefono_segretario",
    "durata_prova_minuti",
    "data_accesso_piattaforma",
    "commissione_members",
    "session_assignments",
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
    "email_esperto_remoto",
    "informatici_sede",
}
SESSION_FIELDS = {
    "nome_informatico_sede",
    "email_informatico_sede",
    "telefono_informatico_sede",
    "email_esperto_remoto",
    "informatici_sede",
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
    normalized = _normalize_email(email)
    if not normalized:
        return None
    options = _rdp_options(config)
    if not options:
        return (
            "Nessun RDP disponibile da Selezioni Online per il bando. "
            "Verificare la fonte dati prima di impostare il referente."
        )
    allowed = {_normalize_email(option["email"]) for option in options}
    if normalized not in allowed:
        return "Selezionare uno degli RDP disponibili per il bando."
    return None


def _secretary_selection_error(config: dict, email: str) -> str | None:
    normalized = _normalize_email(email)
    if not normalized:
        return None
    options = _secretary_options(config)
    if not options:
        return (
            "Nessun segretario disponibile da Selezioni Online per il bando. "
            "Verificare la fonte dati prima di impostare il segretario."
        )
    allowed = {_normalize_email(option["email"]) for option in options}
    if normalized not in allowed:
        return "Selezionare uno dei segretari disponibili per il bando."
    return None


def _normalize_sede_technicians(value) -> tuple[list[dict], dict[str, str]]:
    if value in (None, ""):
        return [], {}
    if not isinstance(value, list):
        return [], {"informatici_sede": "È richiesto un elenco di informatici in sede."}

    errors = {}
    technicians = []
    primary_count = 0
    for index, item in enumerate(value):
        field = f"informatici_sede[{index}]"
        if not isinstance(item, dict):
            errors[field] = "Riga non valida."
            continue
        nome = str(item.get("nome") or "").strip()
        email = str(item.get("email") or "").strip()
        telefono = str(item.get("telefono") or "").strip()
        principale = bool(item.get("principale"))
        if not (nome or email or telefono):
            continue
        if not email:
            errors[f"{field}.email"] = "Indicare l'email dell'informatico in sede."
        elif len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
            errors[f"{field}.email"] = "Indirizzo email non valido."
        if principale:
            primary_count += 1
        technicians.append(
            {
                "nome": nome,
                "email": email,
                "telefono": telefono,
                "principale": principale,
            }
        )

    if primary_count > 1:
        errors["informatici_sede"] = "Selezionare un solo informatico in sede principale."
    elif technicians and primary_count == 0:
        technicians[0]["principale"] = True
    return technicians, errors


def _primary_sede_technician(config: dict) -> dict:
    technicians = [
        item for item in (config.get("informatici_sede") or [])
        if isinstance(item, dict) and _normalize_email(item.get("email"))
    ]
    if not technicians:
        return {}
    return next((item for item in technicians if item.get("principale")), technicians[0])


def _list_session_assignments(commission_id: str) -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT s.session_id, s.nome, s.giorno, s.ora, s.luogo,
                       sc.nome_informatico_sede,
                       sc.email_informatico_sede,
                       sc.telefono_informatico_sede,
                       sc.email_esperto_remoto,
                       sc.informatici_sede
                  FROM sessioni AS s
             LEFT JOIN sessione_config AS sc
                    ON sc.session_id = s.session_id
                 WHERE s.commission_id = %s
              ORDER BY s.data_esame NULLS LAST, s.ora, s.nome
                """,
                (commission_id,),
            )
            rows = cursor.fetchall()
    import json as _json

    result = []
    for row in rows:
        try:
            informatici_sede = _json.loads(row[9] or "[]")
        except (TypeError, ValueError):
            informatici_sede = []
        result.append(
            {
                "session_id": row[0],
                "nome": row[1],
                "giorno": row[2],
                "ora": row[3],
                "luogo": row[4],
                "nome_informatico_sede": row[5] or "",
                "email_informatico_sede": row[6] or "",
                "telefono_informatico_sede": row[7] or "",
                "email_esperto_remoto": row[8] or "",
                "informatici_sede": informatici_sede,
            }
        )
    return result


def _session_ids_for_commission(commission_id: str) -> set[str]:
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT session_id FROM sessioni WHERE commission_id = %s",
                (commission_id,),
            )
            return {row[0] for row in cursor.fetchall()}


def _normalize_session_assignments(value, commission_id: str) -> tuple[list[dict], dict[str, str]]:
    if value in (None, ""):
        return [], {}
    if not isinstance(value, list):
        return [], {"session_assignments": "È richiesto un elenco di assegnazioni sessione."}

    allowed_session_ids = _session_ids_for_commission(commission_id)
    assignments = []
    errors = {}
    for index, item in enumerate(value):
        field = f"session_assignments[{index}]"
        if not isinstance(item, dict):
            errors[field] = "Riga non valida."
            continue
        session_id = str(item.get("session_id") or "").strip()
        if session_id not in allowed_session_ids:
            errors[f"{field}.session_id"] = "Sessione non valida per questo bando."
            continue

        email_esperto = str(item.get("email_esperto_remoto") or "").strip()
        if email_esperto and (
            len(email_esperto) > 254 or not EMAIL_PATTERN.fullmatch(email_esperto)
        ):
            errors[f"{field}.email_esperto_remoto"] = "Indirizzo email non valido."

        informatici_sede, sede_errors = _normalize_sede_technicians(
            item.get("informatici_sede")
        )
        errors.update({f"{field}.{key}": message for key, message in sede_errors.items()})
        primary = _primary_sede_technician({"informatici_sede": informatici_sede})
        assignments.append(
            {
                "session_id": session_id,
                "email_esperto_remoto": email_esperto,
                "nome_informatico_sede": str(
                    item.get("nome_informatico_sede") or primary.get("nome") or ""
                ).strip(),
                "email_informatico_sede": str(
                    item.get("email_informatico_sede") or primary.get("email") or ""
                ).strip(),
                "telefono_informatico_sede": str(
                    item.get("telefono_informatico_sede") or primary.get("telefono") or ""
                ).strip(),
                "informatici_sede": informatici_sede,
            }
        )
    return assignments, errors


def _session_completion_errors(session_id: str, merged_session_config: dict) -> dict[str, str]:
    """Validazioni minime per avanzare una sessione da iniziale a configurata."""
    errors = {}
    if not _normalize_email(merged_session_config.get("email_informatico_sede")):
        errors["email_informatico_sede"] = (
            "Indicare l'email dell'informatico in sede prima di proseguire."
        )

    sessione = get_sessione_by_id(session_id)
    if not sessione:
        errors["session_id"] = "Sessione non trovata."
        return errors

    if not _normalize_email(merged_session_config.get("email_esperto_remoto")):
        errors["email_esperto_remoto"] = (
            "Selezionare l'esperto informatico da remoto prima di proseguire."
        )
    return errors


@configurazioni_api_bp.get("/bandi/<commission_id>/config")
@api_auth_required
def bando_config_get(commission_id):
    if not authorization.can_access_commission(
        session["user_email"],
        commission_id,
        allow_referente=True,
        profile_mode=request.args.get("mode"),
    ):
        return error_response("forbidden", "Operazione non autorizzata.", 403)
    config = get_bando_config(commission_id) or {}
    return jsonify(
        commission_id=commission_id,
        expert_options=list_expert_emails(),
        rdp_options=_rdp_options(config),
        secretary_options=_secretary_options(config),
        session_assignments=_list_session_assignments(commission_id),
        **_serialize(config),
    )


@configurazioni_api_bp.put("/bandi/<commission_id>/config")
@api_auth_required
@commission_access_required(allow_referente=True)
def bando_config_put(commission_id):
    data, errors = _payload(BANDO_FIELDS, BANDO_READONLY_FIELDS)
    session_assignments = []
    if data is not None and "session_assignments" in data:
        session_assignments, assignment_errors = _normalize_session_assignments(
            data.pop("session_assignments"),
            commission_id,
        )
        errors.update(assignment_errors)
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
        if selection_error:
            return error_response(
                "validation_error",
                "Dati di configurazione non validi.",
                422,
                details={"email_referente": selection_error},
            )
    if "email_segretario" in data:
        selection_error = _secretary_selection_error(current, data.get("email_segretario"))
        if selection_error:
            return error_response(
                "validation_error",
                "Dati di configurazione non validi.",
                422,
                details={"email_segretario": selection_error},
            )
    merged = {**current, **data}
    save_bando_config(
        commission_id,
        merged.get("email_referente"),
        None,
        merged.get("email_segretario"),
        merged.get("telefono_segretario"),
        merged.get("durata_prova_minuti"),
        merged.get("commissione_members"),
        configured_by=session["user_email"],
        data_accesso_piattaforma=merged.get("data_accesso_piattaforma"),
        informatici_sede=[],
    )
    for assignment in session_assignments:
        current_session_config = get_sessione_config(assignment["session_id"]) or {}
        merged_session_config = {**current_session_config, **assignment}
        save_sessione_config(
            assignment["session_id"],
            merged_session_config.get("nome_informatico_sede"),
            merged_session_config.get("email_informatico_sede"),
            merged_session_config.get("telefono_informatico_sede"),
            merged_session_config.get("data_accesso_piattaforma"),
            email_esperto_remoto=merged_session_config.get("email_esperto_remoto"),
            informatici_sede=merged_session_config.get("informatici_sede"),
        )
    return jsonify(
        commission_id=commission_id,
        session_assignments=_list_session_assignments(commission_id),
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
def sessione_config_get(session_id):
    if not authorization.can_access_session(
        session["user_email"],
        session_id,
        profile_mode=request.args.get("mode"),
    ):
        return error_response("forbidden", "Operazione non autorizzata.", 403)
    config = get_sessione_config(session_id) or {}
    return jsonify(session_id=session_id, **_serialize(config))


@configurazioni_api_bp.put("/sessioni/<session_id>/config")
@api_auth_required
@session_access_required()
def sessione_config_put(session_id):
    data, errors = _payload(SESSION_FIELDS)
    if data is not None and "informatici_sede" in data:
        data["informatici_sede"], sede_errors = _normalize_sede_technicians(
            data.get("informatici_sede")
        )
        errors.update(sede_errors)
    if errors:
        return error_response(
            "validation_error",
            "Dati di configurazione non validi.",
            422,
            details=errors,
        )
    current = get_sessione_config(session_id) or {}
    merged = {**current, **data}
    is_initial_state = get_stato_corrente(session_id) == "iniziale"
    if is_initial_state:
        completion_errors = _session_completion_errors(session_id, merged)
        if completion_errors:
            status = 404 if "session_id" in completion_errors else 422
            return error_response(
                "validation_error",
                "Configurazione sessione incompleta.",
                status,
                details=completion_errors,
            )

    save_sessione_config(
        session_id,
        merged.get("nome_informatico_sede"),
        merged.get("email_informatico_sede"),
        merged.get("telefono_informatico_sede"),
        merged.get("data_accesso_piattaforma"),
        email_esperto_remoto=merged.get("email_esperto_remoto"),
        informatici_sede=merged.get("informatici_sede"),
    )
    if is_initial_state:
        set_stato_corrente(
            session_id,
            "configurata",
            utente=session["user_email"],
        )
    return jsonify(
        session_id=session_id,
        **_serialize(get_sessione_config(session_id) or merged),
    )
