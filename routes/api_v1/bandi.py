from datetime import date, datetime

from flask import Blueprint, jsonify, request, session
from psycopg2.extras import RealDictCursor

from db import get_db_connection
from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils import authorization
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


def _technical_bando_item(row, visibility_reason: str) -> dict:
    return {
        "commission_id": row["commission_id"],
        "title": row.get("title") or row["commission_id"],
        "configured": bool(row.get("configured")),
        "referente_email": row.get("referente_email"),
        "esperto_remoto_email": row.get("esperto_remoto_email"),
        "config_status": row.get("config_status") or "da_configurare",
        "expert_assigned": bool(row.get("expert_assigned")),
        "required_data_complete": bool(row.get("required_data_complete")),
        "session_count": int(row.get("session_count") or 0),
        "last_sync": _json_value(row.get("last_sync")),
        "visibility_reason": visibility_reason,
        "source_role": None,
        "access_active": True,
        "capabilities": ["view"],
    }


def _list_remote_expert_bandi(user_email: str) -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT b.commission_id,
                       MAX(c.titolo) AS title,
                       TRUE AS configured,
                       MAX(b.email_referente) AS referente_email,
                       MAX(b.email_esperto_remoto) AS esperto_remoto_email,
                       COALESCE(MAX(b.config_status), 'da_configurare') AS config_status,
                       BOOL_OR(COALESCE(b.expert_assigned, FALSE)) AS expert_assigned,
                       BOOL_OR(COALESCE(b.required_data_complete, FALSE)) AS required_data_complete,
                       COUNT(DISTINCT s.session_id) AS session_count,
                       MAX(COALESCE(s.data_sync, b.configured_at)) AS last_sync
                  FROM bando_config AS b
             LEFT JOIN commissions AS c
                    ON c.commission_id = b.commission_id
             LEFT JOIN sessioni AS s
                    ON s.commission_id = b.commission_id
                 WHERE LOWER(TRIM(COALESCE(b.email_esperto_remoto, ''))) = %s
              GROUP BY b.commission_id
              ORDER BY MAX(c.titolo), b.commission_id
                """,
                (user_email.strip().lower(),),
            )
            return [
                _technical_bando_item(row, "expert")
                for row in cursor.fetchall()
            ]


def _list_sede_bandi(user_email: str) -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT s.commission_id,
                       MAX(c.titolo) AS title,
                       BOOL_OR(b.commission_id IS NOT NULL) AS configured,
                       MAX(b.email_referente) AS referente_email,
                       MAX(b.email_esperto_remoto) AS esperto_remoto_email,
                       COALESCE(MAX(b.config_status), 'da_configurare') AS config_status,
                       BOOL_OR(COALESCE(b.expert_assigned, FALSE)) AS expert_assigned,
                       BOOL_OR(COALESCE(b.required_data_complete, FALSE)) AS required_data_complete,
                       COUNT(DISTINCT s.session_id) AS session_count,
                       MAX(COALESCE(s.data_sync, b.configured_at)) AS last_sync
                  FROM sessioni AS s
                  JOIN sessione_config AS sc
                    ON sc.session_id = s.session_id
             LEFT JOIN commissions AS c
                    ON c.commission_id = s.commission_id
             LEFT JOIN bando_config AS b
                    ON b.commission_id = s.commission_id
                 WHERE LOWER(TRIM(COALESCE(sc.email_informatico_sede, ''))) = %s
              GROUP BY s.commission_id
              ORDER BY MAX(c.titolo), s.commission_id
                """,
                (user_email.strip().lower(),),
            )
            return [
                _technical_bando_item(row, "sede")
                for row in cursor.fetchall()
            ]


def list_bandi(
    user_email: str,
    *,
    include_all: bool = False,
    mode: str | None = None,
) -> list[dict]:
    normalized_mode = authorization.normalize_operational_mode(mode)
    if normalized_mode == authorization.TECHNICAL_MODE_EXPERT and not include_all:
        return _list_remote_expert_bandi(user_email)
    if normalized_mode == authorization.TECHNICAL_MODE_SEDE and not include_all:
        return _list_sede_bandi(user_email)

    ownership_filter = "" if include_all else (
        "WHERE c.user_email = %s "
        "AND COALESCE(c.access_active, TRUE) "
        "AND UPPER(COALESCE(c.source_role, 'SEGRETARIO')) = 'SEGRETARIO'"
    )
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT c.commission_id,
                       MAX(c.titolo) AS title,
                       BOOL_OR(
                           c.user_email = %s
                           AND COALESCE(c.access_active, TRUE)
                           AND UPPER(COALESCE(c.source_role, 'SEGRETARIO')) = 'SEGRETARIO'
                       ) AS is_owner,
                       MAX(c.source_role) FILTER (WHERE c.user_email = %s) AS user_source_role,
                       BOOL_OR(COALESCE(c.access_active, TRUE)) FILTER (WHERE c.user_email = %s) AS user_access_active,
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
                       {ownership_filter}
              GROUP BY c.commission_id
              ORDER BY MAX(c.titolo), c.commission_id
                """,
                (user_email, user_email, user_email, *(() if include_all else (user_email,))),
            )
            rows = cursor.fetchall()

    items = []
    for row in rows:
        serialized = _serialize(row)
        is_owner = bool(serialized.pop("is_owner", False))
        user_source_role = serialized.pop("user_source_role", None)
        user_access_active = serialized.pop("user_access_active", None)
        items.append(
            {
                **serialized,
                "session_count": int(row["session_count"] or 0),
                "configured": bool(row["configured"]),
                "config_status": row.get("config_status") or "da_configurare",
                "expert_assigned": bool(row.get("expert_assigned")),
                "required_data_complete": bool(row.get("required_data_complete")),
                "visibility_reason": "owner" if is_owner else "admin",
                "source_role": user_source_role,
                "access_active": bool(user_access_active) if user_access_active is not None else is_owner,
                "capabilities": ["configure", "view"],
            }
        )
    return items


def get_bando(commission_id: str, user_email: str | None = None) -> dict | None:
    visibility_email = user_email or ""
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT c.commission_id,
                       MAX(c.titolo) AS title,
                       BOOL_OR(
                           c.user_email = %s
                           AND COALESCE(c.access_active, TRUE)
                           AND UPPER(COALESCE(c.source_role, 'SEGRETARIO')) = 'SEGRETARIO'
                       ) AS is_owner,
                       MAX(c.source_role) FILTER (WHERE c.user_email = %s) AS user_source_role,
                       BOOL_OR(COALESCE(c.access_active, TRUE)) FILTER (WHERE c.user_email = %s) AS user_access_active,
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
                 WHERE c.commission_id = %s
              GROUP BY c.commission_id
                """,
                (visibility_email, visibility_email, visibility_email, commission_id),
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
                           BOOL_OR(r.user_email = %s) AS is_referente,
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
                    (visibility_email.strip().lower(), commission_id),
                )
                row = cursor.fetchone()
    if not row:
        return None
    serialized = _serialize(row)
    is_owner = bool(serialized.pop("is_owner", False))
    is_referente = bool(serialized.pop("is_referente", False))
    user_source_role = serialized.pop("user_source_role", None)
    user_access_active = serialized.pop("user_access_active", None)
    visibility_reason = "owner" if is_owner else "referente" if is_referente else "admin"
    return {
        **serialized,
        "session_count": int(row["session_count"] or 0),
        "configured": bool(row["configured"]),
        "config_status": row.get("config_status") or "da_configurare",
        "expert_assigned": bool(row.get("expert_assigned")),
        "required_data_complete": bool(row.get("required_data_complete")),
        "visibility_reason": visibility_reason,
        "source_role": user_source_role,
        "access_active": bool(user_access_active) if user_access_active is not None else is_owner,
        "capabilities": ["configure", "view"],
    }


def _include_admin_view(user_email: str) -> bool:
    return request.args.get("mode") == "admin" and ROLE_ADMIN in get_user_roles(user_email)


def _include_all_for_mode(user_email: str, mode: str | None) -> bool:
    if ROLE_ADMIN not in get_user_roles(user_email):
        return False
    return mode in ("admin", "sede", "expert", "esperto")


@bandi_api_bp.get("/bandi")
@api_auth_required
def bandi_index():
    email = session["user_email"]
    mode = request.args.get("mode")
    return jsonify(
        items=list_bandi(
            email,
            include_all=_include_all_for_mode(email, mode),
            mode=mode,
        ),
        sync_error=None,
        sync_source="db",
    )


@bandi_api_bp.post("/bandi/sync")
@api_auth_required
def bandi_sync():
    email = session["user_email"]
    mode = request.args.get("mode")
    normalized_mode = authorization.normalize_operational_mode(mode)
    if normalized_mode in (
        authorization.TECHNICAL_MODE_EXPERT,
        authorization.TECHNICAL_MODE_SEDE,
    ):
        return jsonify(
            items=list_bandi(
                email,
                include_all=_include_all_for_mode(email, mode),
                mode=mode,
            ),
            sync_error=None,
            sync_source="db",
        )
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
    return jsonify(
        items=list_bandi(
            email,
            include_all=_include_admin_view(email),
            mode=mode,
        ),
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
def bando_detail(commission_id):
    mode = request.args.get("mode")
    if not authorization.can_access_commission(
        session["user_email"],
        commission_id,
        allow_referente=True,
        profile_mode=mode,
    ):
        return error_response("forbidden", "Operazione non autorizzata.", 403)
    bando = get_bando(commission_id, session["user_email"])
    if not bando:
        return error_response("bando_not_found", "Bando non trovato.", 404)
    normalized_mode = authorization.normalize_operational_mode(mode)
    if normalized_mode == authorization.TECHNICAL_MODE_EXPERT:
        bando["visibility_reason"] = (
            "expert"
            if authorization.is_assigned_remote_expert(
                session["user_email"],
                commission_id,
            )
            else "admin"
        )
    elif normalized_mode == authorization.TECHNICAL_MODE_SEDE:
        bando["visibility_reason"] = (
            "sede"
            if authorization.has_assigned_sede_session(
                session["user_email"],
                commission_id,
            )
            else "admin"
        )
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
