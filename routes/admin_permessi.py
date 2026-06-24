from flask import Blueprint, render_template, request, redirect, url_for, session
from routes.auth import login_required
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, role_required
from db import get_db_connection
from psycopg2.extras import RealDictCursor


admin_permessi_bp = Blueprint('admin_permessi', __name__)

ALLOWED_ROLES = {ROLE_ADMIN, ROLE_ESPERTO}
GLOBAL_ROLES = {ROLE_ADMIN}  # ruoli non-esperto gestiti nella sezione "Permessi globali"


@admin_permessi_bp.route('/admin/permessi', methods=['GET'])
@login_required
@role_required(ROLE_ADMIN)
def permessi_index():
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT user_email, role, created_by, created_at
                FROM user_roles
                ORDER BY user_email, role
            """)
            ruoli = cur.fetchall()

    esperti = [r for r in ruoli if r["role"] == ROLE_ESPERTO]
    altri   = [r for r in ruoli if r["role"] != ROLE_ESPERTO]

    return render_template(
        "admin_permessi.html",
        esperti=esperti,
        altri_ruoli=altri,
        global_roles=sorted(GLOBAL_ROLES),
    )


@admin_permessi_bp.route('/admin/permessi', methods=['POST'])
@login_required
@role_required(ROLE_ADMIN)
def permessi_add():
    user_email = (request.form.get("user_email") or "").strip().lower()
    role = (request.form.get("role") or "").strip()
    created_by = session.get("user_email")

    if not user_email or role not in ALLOWED_ROLES:
        return redirect(url_for("admin_permessi.permessi_index"))

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO user_roles (user_email, role, created_by)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_email, role) DO NOTHING
            """, (user_email, role, created_by))
        conn.commit()

    return redirect(url_for("admin_permessi.permessi_index"))


@admin_permessi_bp.route('/admin/permessi/remove', methods=['POST'])
@login_required
@role_required(ROLE_ADMIN)
def permessi_remove():
    user_email = (request.form.get("user_email") or "").strip().lower()
    role = (request.form.get("role") or "").strip()

    if not user_email or role not in ALLOWED_ROLES:
        return redirect(url_for("admin_permessi.permessi_index"))

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM user_roles
                WHERE user_email = %s AND role = %s
            """, (user_email, role))
        conn.commit()

    return redirect(url_for("admin_permessi.permessi_index"))


@admin_permessi_bp.route('/admin/logs', methods=['GET'])
@login_required
@role_required(ROLE_ADMIN)
def admin_logs():
    try:
        limit = max(1, min(int(request.args.get("limit", 200)), 1000))
    except ValueError:
        limit = 200

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT to_regclass('public.system_error_log') AS tbl")
            exists_system_error_log = cur.fetchone()["tbl"] is not None
            if exists_system_error_log:
                cur.execute(
                    """
                    SELECT id, created_at, source, actor_email, error_type, raw_error, context_json
                    FROM system_error_log
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                )
                system_errors = cur.fetchall()
            else:
                system_errors = []

            cur.execute(
                """
                SELECT id, sent_at, prove_id, sent_by, subject, to_emails, cc_emails, smtp_status
                FROM prove_emails_log
                ORDER BY sent_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            prove_email_log = cur.fetchall()

            cur.execute(
                """
                SELECT id, timestamp, session_id, stato, utente
                FROM session_state_log
                ORDER BY timestamp DESC
                LIMIT %s
                """,
                (limit,),
            )
            session_state_log = cur.fetchall()

            cur.execute(
                """
                SELECT id, timestamp, prove_id, from_state, to_state, utente, payload_json
                FROM prove_state_log
                ORDER BY timestamp DESC
                LIMIT %s
                """,
                (limit,),
            )
            prove_state_log = cur.fetchall()

    return render_template(
        "admin_logs.html",
        limit=limit,
        system_errors=system_errors,
        prove_email_log=prove_email_log,
        session_state_log=session_state_log,
        prove_state_log=prove_state_log,
    )
