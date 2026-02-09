from flask import Blueprint, render_template, request, redirect, url_for, session
from routes.auth import login_required
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, role_required
from db import get_db_connection
from psycopg2.extras import RealDictCursor


admin_permessi_bp = Blueprint('admin_permessi', __name__)

ALLOWED_ROLES = {ROLE_ADMIN, ROLE_ESPERTO}


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

    return render_template(
        "admin_permessi.html",
        ruoli=ruoli,
        allowed_roles=sorted(ALLOWED_ROLES)
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
