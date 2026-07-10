from datetime import date, datetime

from flask import Blueprint, jsonify, session
from psycopg2.extras import RealDictCursor

from db import get_db_connection
from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils.authorization import commission_access_required
from utils.commissioni import get_commissioni_sincronizzate_with_status
from utils.roles import ROLE_ADMIN, get_user_roles
from utils.jconon_service import fetch_referente_bandi, sync_bando_metadata
from utils.oidc import ensure_fresh_access_token
from utils.sessioni import get_bando_config


bandi_api_bp = Blueprint("api_v1_bandi", __name__)


def _json_value(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _serialize(row) -> dict:
    return {key: _json_value(value) for key, value in dict(row).items()}


def list_bandi(user_email: str, *, include_all: bool = False) -> list[dict]:
    ownership_filter = "" if include_all else "WHERE c.user_email = %s"
    params = () if include_all else (user_email,)
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT c.commission_id,
                       MAX(c.titolo) AS title,
                       BOOL_OR(b.commission_id IS NOT NULL) AS configured,
                       MAX(b.email_referente) AS referente_email,
                       MAX(b.email_esperto_remoto) AS esperto_remoto_email,
                       COALESCE(MAX(b.config_status), 'da_configurare') AS config_status,
                       BOOL_OR(COALESCE(b.expert_assigned, FALSE)) AS expert_assigned,
                       BOOL_OR(COALESCE(b.required_data_complete, FALSE)) AS required_data_complete,
                       COUNT(DISTINCT s.session_id) AS session_count,
                       MAX(COALESCE(s.data_sync, c.data_sync)) AS last_sync
                  FROM commissions AS c
             LEFT JOIN bando_config AS b
                    ON b.commission_id = c.commission_id
             LEFT JOIN sessioni AS s
                    ON s.commission_id = c.commission_id
                   AND s.user_email = c.user_email
                       {ownership_filter}
              GROUP BY c.commission_id
              ORDER BY MAX(c.titolo), c.commission_id
                """,
                params,
            )
            rows = cursor.fetchall()

    return [
        {
            **_serialize(row),
            "session_count": int(row["session_count"] or 0),
            "configured": bool(row["configured"]),
            "config_status": row.get("config_status") or "da_configurare",
            "expert_assigned": bool(row.get("expert_assigned")),
            "required_data_complete": bool(row.get("required_data_complete")),
            "capabilities": ["configure", "view"],
        }
        for row in rows
    ]


def get_bando(commission_id: str) -> dict | None:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT c.commission_id,
                       MAX(c.titolo) AS title,
                       BOOL_OR(b.commission_id IS NOT NULL) AS configured,
                       MAX(b.email_referente) AS referente_email,
                       MAX(b.email_esperto_remoto) AS esperto_remoto_email,
                       COALESCE(MAX(b.config_status), 'da_configurare') AS config_status,
                       BOOL_OR(COALESCE(b.expert_assigned, FALSE)) AS expert_assigned,
                       BOOL_OR(COALESCE(b.required_data_complete, FALSE)) AS required_data_complete,
                       COUNT(DISTINCT s.session_id) AS session_count,
                       MAX(COALESCE(s.data_sync, c.data_sync)) AS last_sync
                  FROM commissions AS c
             LEFT JOIN bando_config AS b
                    ON b.commission_id = c.commission_id
             LEFT JOIN sessioni AS s
                    ON s.commission_id = c.commission_id
                   AND s.user_email = c.user_email
                 WHERE c.commission_id = %s
              GROUP BY c.commission_id
                """,
                (commission_id,),
            )
            row = cursor.fetchone()
            if not row:
                # Nessun segretario ha ancora sincronizzato questo bando in
                # `commissions`: se esiste una relazione RDP/referente
                # recuperiamo comunque titolo e stato configurazione da lì,
                # invece di rispondere 404 a chi è autorizzato.
                cursor.execute(
                    """
                    SELECT r.commission_id,
                           MAX(r.nome) AS title,
                           BOOL_OR(b.commission_id IS NOT NULL) AS configured,
                           MAX(b.email_referente) AS referente_email,
                           MAX(b.email_esperto_remoto) AS esperto_remoto_email,
                           COALESCE(MAX(b.config_status), 'da_configurare') AS config_status,
                           BOOL_OR(COALESCE(b.expert_assigned, FALSE)) AS expert_assigned,
                           BOOL_OR(COALESCE(b.required_data_complete, FALSE)) AS required_data_complete,
                           0 AS session_count,
                           MAX(COALESCE(b.configured_at, r.synced_at)) AS last_sync
                      FROM bando_referenti AS r
                 LEFT JOIN bando_config AS b
                        ON b.commission_id = r.commission_id
                     WHERE r.commission_id = %s
                  GROUP BY r.commission_id
                    """,
                    (commission_id,),
                )
                row = cursor.fetchone()
    if not row:
        return None
    return {
        **_serialize(row),
        "session_count": int(row["session_count"] or 0),
        "configured": bool(row["configured"]),
        "config_status": row.get("config_status") or "da_configurare",
        "expert_assigned": bool(row.get("expert_assigned")),
        "required_data_complete": bool(row.get("required_data_complete")),
        "capabilities": ["configure", "view"],
    }


@bandi_api_bp.get("/bandi")
@api_auth_required
def bandi_index():
    email = session["user_email"]
    roles = get_user_roles(email)
    return jsonify(
        items=list_bandi(email, include_all=ROLE_ADMIN in roles),
        sync_error=None,
        sync_source="db",
    )


@bandi_api_bp.post("/bandi/sync")
@api_auth_required
def bandi_sync():
    email = session["user_email"]
    token = ensure_fresh_access_token(skew_sec=60)
    if not token:
        return error_response(
            "reauthentication_required",
            "Sessione OIDC scaduta.",
            401,
        )
    result = get_commissioni_sincronizzate_with_status(token, email)
    if result.get("unauthorized"):
        return error_response(
            "reauthentication_required",
            "Sessione OIDC scaduta.",
            401,
        )
    roles = get_user_roles(email)
    return jsonify(
        items=list_bandi(email, include_all=ROLE_ADMIN in roles),
        sync_error=result.get("sync_error"),
        sync_source=result.get("sync_source"),
    )


@bandi_api_bp.post("/referenti/bandi/sync")
@api_auth_required
def referente_bandi_sync():
    email = session["user_email"]
    token = ensure_fresh_access_token(skew_sec=60)
    if not token:
        return error_response(
            "reauthentication_required",
            "Sessione OIDC scaduta.",
            401,
        )
    result = fetch_referente_bandi(token, email)
    if not result["success"]:
        return error_response(
            "external_service_unavailable",
            result["message"],
            502,
        )
    return jsonify(
        items=result["items"],
        sync_error=None,
        sync_source="remote",
    )


@bandi_api_bp.get("/bandi/<commission_id>")
@api_auth_required
@commission_access_required(allow_referente=True)
def bando_detail(commission_id):
    bando = get_bando(commission_id)
    if not bando:
        return error_response("bando_not_found", "Bando non trovato.", 404)
    config = get_bando_config(commission_id) or {}
    bando["rdps"] = config.get("rdp_members") or [
        {"name": name}
        for name in config.get("rdp_nomi", [])
        if name
    ]
    bando["commissioners"] = config.get("commissione_members", [])
    bando["metadata_fetched_at"] = _json_value(config.get("fetched_at"))
    return jsonify(bando)


@bandi_api_bp.post("/bandi/<commission_id>/sync-meta")
@api_auth_required
@commission_access_required(allow_referente=True)
def bando_sync_metadata(commission_id):
    token = ensure_fresh_access_token(skew_sec=60)
    if not token:
        return error_response(
            "reauthentication_required",
            "Sessione OIDC scaduta.",
            401,
        )
    result = sync_bando_metadata(commission_id, token)
    if not result["success"]:
        return error_response(
            "external_service_unavailable",
            result["message"],
            502,
        )
    return jsonify(result)
