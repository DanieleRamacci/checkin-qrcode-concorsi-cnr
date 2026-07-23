import os
from datetime import date, datetime

from flask import Blueprint, jsonify, request, session
from psycopg2.extras import RealDictCursor

from db import get_db_connection
from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils import authorization
from utils.authorization import commission_access_required, session_access_required
from utils.oidc import ensure_fresh_access_token
from utils.roles import ROLE_ADMIN, get_user_roles
from utils.sessioni import get_sessioni_internamente


sessioni_api_bp = Blueprint("api_v1_sessioni", __name__)


def _session_sync_timeout() -> tuple[float, float]:
    def _env_float(name: str, default: float) -> float:
        try:
            return float(os.environ.get(name, default))
        except (TypeError, ValueError):
            return default

    return (
        _env_float("SESSIONI_SYNC_CONNECT_TIMEOUT", 5),
        _env_float("SESSIONI_SYNC_READ_TIMEOUT", 25),
    )


def _json_value(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _session_dto(row, mode: str | None = None) -> dict:
    result = {key: _json_value(value) for key, value in dict(row).items()}
    is_owner = bool(result.pop("is_owner", True))
    is_sede_assigned = bool(result.pop("is_sede_assigned", False))
    is_expert_assigned = bool(result.pop("is_expert_assigned", False))
    for field in ("candidate_count", "checked_in_count", "device_count"):
        result[field] = int(result.get(field) or 0)
    normalized_mode = authorization.normalize_operational_mode(mode)
    if normalized_mode == authorization.TECHNICAL_MODE_SEDE:
        result["visibility_reason"] = "sede" if is_sede_assigned else "admin"
    elif normalized_mode == authorization.TECHNICAL_MODE_EXPERT:
        result["visibility_reason"] = "expert" if is_expert_assigned else "admin"
    else:
        result["visibility_reason"] = "owner" if is_owner else "admin"
    result["capabilities"] = ["configure", "manage"]
    return result


def _admin_mode(user_email: str, mode: str | None) -> bool:
    return (
        authorization.normalize_operational_mode(mode) is not None
        and ROLE_ADMIN in get_user_roles(user_email)
    )


def list_sessioni(
    commission_id: str,
    *,
    user_email: str | None = None,
    mode: str | None = None,
) -> list[dict]:
    normalized_mode = authorization.normalize_operational_mode(mode)
    email = (user_email or "").strip().lower()
    sede_join = ""
    sede_where = ""
    if normalized_mode == authorization.TECHNICAL_MODE_SEDE and not _admin_mode(
        user_email or "",
        mode,
    ):
        sede_join = """
             JOIN sessione_config AS assigned_sc
               ON assigned_sc.session_id = s.session_id
        """
        sede_where = (
            " AND LOWER(TRIM(COALESCE(assigned_sc.email_informatico_sede, ''))) = %s"
        )

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT s.session_id,
                       s.commission_id,
                       s.nome AS name,
                       s.giorno AS date,
                       s.ora AS time,
                       s.luogo AS location,
                       s.stato_corrente AS current_state,
                       BOOL_OR(
                           LOWER(TRIM(COALESCE(sc.email_informatico_sede, ''))) = %s
                       ) AS is_sede_assigned,
                       BOOL_OR(
                           LOWER(TRIM(COALESCE(b.email_esperto_remoto, ''))) = %s
                       ) AS is_expert_assigned,
                       COUNT(DISTINCT c.uid) AS candidate_count,
                       COUNT(DISTINCT c.uid)
                           FILTER (WHERE c.checkin_effettuato) AS checked_in_count,
                       COUNT(DISTINCT d.id) AS device_count
                  FROM sessioni AS s
             {sede_join}
             LEFT JOIN sessione_config AS sc
                    ON sc.session_id = s.session_id
             LEFT JOIN bando_config AS b
                    ON b.commission_id = s.commission_id
             LEFT JOIN candidati AS c ON c.session_id = s.session_id
             LEFT JOIN dispositivi AS d ON d.session_id = s.session_id
                 WHERE s.commission_id = %s
                 {sede_where}
              GROUP BY s.session_id, s.commission_id, s.nome, s.giorno,
                       s.ora, s.luogo, s.stato_corrente, s.data_esame
              ORDER BY s.data_esame NULLS LAST, s.ora, s.nome
                """,
                (
                    email,
                    email,
                    commission_id,
                    *((email,) if sede_where else ()),
                ),
            )
            return [_session_dto(row, mode) for row in cursor.fetchall()]


def get_sessione(
    session_id: str,
    user_email: str | None = None,
    mode: str | None = None,
) -> dict | None:
    email = (user_email or "").strip().lower()
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
                       BOOL_OR(
                           LOWER(TRIM(COALESCE(sc.email_informatico_sede, ''))) = %s
                       ) AS is_sede_assigned,
                       BOOL_OR(
                           LOWER(TRIM(COALESCE(b.email_esperto_remoto, ''))) = %s
                       ) AS is_expert_assigned,
                       COUNT(DISTINCT c.uid) AS candidate_count,
                       COUNT(DISTINCT c.uid)
                           FILTER (WHERE c.checkin_effettuato) AS checked_in_count,
                       COUNT(DISTINCT d.id) AS device_count
                  FROM sessioni AS s
             LEFT JOIN commissions AS owner
                    ON owner.commission_id = s.commission_id
                   AND owner.user_email = %s
                   AND COALESCE(owner.access_active, TRUE)
                   AND UPPER(COALESCE(owner.source_role, 'SEGRETARIO')) = 'SEGRETARIO'
             LEFT JOIN sessione_config AS sc ON sc.session_id = s.session_id
             LEFT JOIN bando_config AS b ON b.commission_id = s.commission_id
             LEFT JOIN candidati AS c ON c.session_id = s.session_id
             LEFT JOIN dispositivi AS d ON d.session_id = s.session_id
                 WHERE s.session_id = %s
              GROUP BY s.session_id, s.commission_id, s.nome, s.giorno,
                       s.ora, s.luogo, s.stato_corrente
                """,
                (email, email, user_email or "", session_id),
            )
            row = cursor.fetchone()
    return _session_dto(row, mode) if row else None


@sessioni_api_bp.get("/bandi/<commission_id>/sessioni")
@api_auth_required
def sessioni_index(commission_id):
    mode = request.args.get("mode")
    if not authorization.can_access_commission(
        session["user_email"],
        commission_id,
        profile_mode=mode,
    ):
        return error_response("forbidden", "Operazione non autorizzata.", 403)
    return jsonify(
        commission_id=commission_id,
        items=list_sessioni(
            commission_id,
            user_email=session["user_email"],
            mode=mode,
        ),
    )


@sessioni_api_bp.get("/sessioni/<session_id>")
@api_auth_required
@session_access_required()
def sessione_detail(session_id):
    sessione = get_sessione(
        session_id,
        session["user_email"],
        mode=request.args.get("mode"),
    )
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
        timeout_s=_session_sync_timeout(),
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
