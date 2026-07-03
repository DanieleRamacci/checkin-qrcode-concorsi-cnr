from datetime import date, datetime
from functools import wraps

from flask import Blueprint, jsonify, request, session
from psycopg2.extras import RealDictCursor

from db import get_db_connection
from routes.api_v1.auth import api_auth_required
from routes.api_v1.errors import error_response
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, get_user_roles


admin_api_bp = Blueprint("api_v1_admin", __name__)
ALLOWED_ROLES = {ROLE_ADMIN, ROLE_ESPERTO}


def admin_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if ROLE_ADMIN not in get_user_roles(session.get("user_email")):
            return error_response("forbidden", "Operazione non autorizzata.", 403)
        return view(*args, **kwargs)

    return wrapper


def _serialize(row):
    return {
        key: value.isoformat() if isinstance(value, (date, datetime)) else value
        for key, value in dict(row).items()
    }


def list_roles() -> list[dict]:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT user_email, role, created_by, created_at
                  FROM user_roles
              ORDER BY user_email, role
                """
            )
            return [_serialize(row) for row in cursor.fetchall()]


def list_logs(limit: int) -> dict[str, list[dict]]:
    queries = {
        "system_errors": """
            SELECT id, created_at, source, actor_email,
                   error_type, raw_error, context_json
              FROM system_error_log
          ORDER BY created_at DESC
             LIMIT %s
        """,
        "email_logs": """
            SELECT id, sent_at, prove_id, sent_by, subject,
                   to_emails, cc_emails, smtp_status
              FROM prove_emails_log
          ORDER BY sent_at DESC
             LIMIT %s
        """,
        "session_state_logs": """
            SELECT id, timestamp, session_id, stato, utente
              FROM session_state_log
          ORDER BY timestamp DESC
             LIMIT %s
        """,
        "exam_state_logs": """
            SELECT id, timestamp, prove_id, from_state,
                   to_state, utente, payload_json
              FROM prove_state_log
          ORDER BY timestamp DESC
             LIMIT %s
        """,
    }
    result = {}
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            for key, query in queries.items():
                cursor.execute(query, (limit,))
                result[key] = [_serialize(row) for row in cursor.fetchall()]
    return result


@admin_api_bp.get("/admin/roles")
@api_auth_required
@admin_required
def roles_index():
    return jsonify(items=list_roles())


@admin_api_bp.post("/admin/roles")
@api_auth_required
@admin_required
def roles_create():
    data = request.get_json(silent=True) or {}
    email = str(data.get("user_email") or "").strip().lower()
    role = str(data.get("role") or "").strip()
    errors = {}
    if "@" not in email:
        errors["user_email"] = "Email non valida."
    if role not in ALLOWED_ROLES:
        errors["role"] = "Ruolo non valido."
    if errors:
        return error_response(
            "validation_error",
            "Dati ruolo non validi.",
            422,
            details=errors,
        )
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO user_roles (user_email, role, created_by)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_email, role) DO NOTHING
                """,
                (email, role, session["user_email"]),
            )
        conn.commit()
    return jsonify(user_email=email, role=role), 201


@admin_api_bp.delete("/admin/roles/<path:email>/<role>")
@api_auth_required
@admin_required
def roles_delete(email, role):
    email = email.strip().lower()
    if role not in ALLOWED_ROLES:
        return error_response("role_not_found", "Ruolo non valido.", 404)
    if email == session["user_email"] and role == ROLE_ADMIN:
        return error_response(
            "self_admin_removal_forbidden",
            "Non puoi rimuovere il tuo ruolo amministratore.",
            409,
        )
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM user_roles WHERE user_email = %s AND role = %s",
                (email, role),
            )
            if cursor.rowcount != 1:
                return error_response("role_not_found", "Ruolo non trovato.", 404)
        conn.commit()
    return "", 204


@admin_api_bp.get("/admin/logs")
@api_auth_required
@admin_required
def logs_index():
    try:
        limit = max(1, min(int(request.args.get("limit", 200)), 1000))
    except ValueError:
        return error_response("validation_error", "Limite non valido.", 422)
    result = list_logs(limit)
    return jsonify(limit=limit, items=result["system_errors"], **result)
