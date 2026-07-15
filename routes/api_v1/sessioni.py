from datetime import date, datetime

from flask import Blueprint, jsonify, session
from psycopg2.extras import RealDictCursor

from db import get_db_connection
from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils.authorization import commission_access_required, session_access_required
from utils.oidc import ensure_fresh_access_token
from utils.sessioni import get_sessioni_internamente


sessioni_api_bp = Blueprint("api_v1_sessioni", __name__)


def _json_value(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _session_dto(row) -> dict:
    result = {key: _json_value(value) for key, value in dict(row).items()}
    is_owner = bool(result.pop("is_owner", True))
    for field in ("candidate_count", "checked_in_count", "device_count"):
        result[field] = int(result.get(field) or 0)
    result["visibility_reason"] = "owner" if is_owner else "admin"
    result["capabilities"] = ["configure", "manage"]
    return result


def list_sessioni(commission_id: str) -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT s.session_id,
                       s.commission_id,
                       s.nome AS name,
                       s.giorno AS date,
                       s.ora AS time,
                       s.luogo AS location,
                       s.stato_corrente AS current_state,
                       COUNT(DISTINCT c.uid) AS candidate_count,
                       COUNT(DISTINCT c.uid)
                           FILTER (WHERE c.checkin_effettuato) AS checked_in_count,
                       COUNT(DISTINCT d.id) AS device_count
                  FROM sessioni AS s
             LEFT JOIN candidati AS c ON c.session_id = s.session_id
             LEFT JOIN dispositivi AS d ON d.session_id = s.session_id
                 WHERE s.commission_id = %s
              GROUP BY s.session_id, s.commission_id, s.nome, s.giorno,
                       s.ora, s.luogo, s.stato_corrente, s.data_esame
              ORDER BY s.data_esame NULLS LAST, s.ora, s.nome
                """,
                (commission_id,),
            )
            return [_session_dto(row) for row in cursor.fetchall()]


def get_sessione(session_id: str, user_email: str | None = None) -> dict | None:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT s.session_id,
                       s.commission_id,
                       s.nome AS name,
                       s.giorno AS date,
                       s.ora AS time,
                       s.luogo AS location,
                       s.stato_corrente AS current_state,
                       BOOL_OR(owner.user_email IS NOT NULL) AS is_owner,
                       COUNT(DISTINCT c.uid) AS candidate_count,
                       COUNT(DISTINCT c.uid)
                           FILTER (WHERE c.checkin_effettuato) AS checked_in_count,
                       COUNT(DISTINCT d.id) AS device_count
                  FROM sessioni AS s
             LEFT JOIN commissions AS owner
                    ON owner.commission_id = s.commission_id
                   AND owner.user_email = %s
             LEFT JOIN candidati AS c ON c.session_id = s.session_id
             LEFT JOIN dispositivi AS d ON d.session_id = s.session_id
                 WHERE s.session_id = %s
              GROUP BY s.session_id, s.commission_id, s.nome, s.giorno,
                       s.ora, s.luogo, s.stato_corrente
                """,
                (user_email or "", session_id),
            )
            row = cursor.fetchone()
    return _session_dto(row) if row else None


@sessioni_api_bp.get("/bandi/<commission_id>/sessioni")
@api_auth_required
@commission_access_required()
def sessioni_index(commission_id):
    return jsonify(
        commission_id=commission_id,
        items=list_sessioni(commission_id),
    )


@sessioni_api_bp.get("/sessioni/<session_id>")
@api_auth_required
@session_access_required()
def sessione_detail(session_id):
    sessione = get_sessione(session_id, session["user_email"])
    if not sessione:
        return error_response(
            "session_not_found",
            "Sessione non trovata.",
            404,
        )
    return jsonify(sessione)


@sessioni_api_bp.post("/bandi/<commission_id>/sessioni/sync")
@api_auth_required
@commission_access_required()
def sessioni_sync(commission_id):
    token = ensure_fresh_access_token(skew_sec=60)
    if not token:
        return error_response(
            "reauthentication_required",
            "Sessione OIDC scaduta.",
            401,
        )
    result = get_sessioni_internamente(
        commission_id,
        token,
        session["user_email"],
        timeout_s=(5, 90),
        retries=0,
    )
    if result == "UNAUTHORIZED":
        return error_response(
            "reauthentication_required",
            "Sessione OIDC scaduta.",
            401,
        )
    if result == -1:
        return error_response(
            "external_service_unavailable",
            "Sincronizzazione sessioni fallita.",
            502,
        )
    return jsonify(success=True, inserted=result)
