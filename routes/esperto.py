from flask import Blueprint, render_template, session, redirect, url_for, abort
from routes.auth import login_required
from utils.commissioni import get_commissioni_sincronizzate
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, roles_required_any
from db import get_db_connection
from psycopg2.extras import RealDictCursor


esperto_bp = Blueprint('esperto', __name__)


@esperto_bp.route('/esperto')
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def dashboard_esperto():
    user_email = session.get('user_email')
    access_token = session.get('access_token')

    if not access_token or not user_email:
        return redirect(url_for('auth.login'))

    commissioni = get_commissioni_sincronizzate(access_token, user_email)
    if commissioni is None:
        session.clear()
        return redirect(url_for('auth.login'))

    return render_template(
        'dashboard_esperto.html',
        commissioni=commissioni,
        user_email=user_email,
        active_page="esperto"
    )


@esperto_bp.route('/sede')
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def dashboard_sede():
    user_email = session.get('user_email')
    access_token = session.get('access_token')

    if not access_token or not user_email:
        return redirect(url_for('auth.login'))

    commissioni = get_commissioni_sincronizzate(access_token, user_email)
    if commissioni is None:
        session.clear()
        return redirect(url_for('auth.login'))

    return render_template(
        'dashboard_sede.html',
        commissioni=commissioni,
        user_email=user_email,
        active_page="sede"
    )


@esperto_bp.route('/esperto/sessione/<session_id>')
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def gestione_sessione_esperto(session_id):
    user_email = session.get("user_email")
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT s.session_id, s.commission_id, s.nome, s.giorno, s.ora, s.luogo, s.stato_corrente
                FROM sessioni s
                JOIN commissions c ON c.commission_id = s.commission_id
                WHERE s.session_id = %s AND c.user_email = %s
                LIMIT 1
            """, (session_id, user_email))
            sessione = cur.fetchone()

    if not sessione:
        return abort(404)

    return render_template("gestione-concorso-esperto.html", sessione=sessione)


@esperto_bp.route('/sede/sessione/<session_id>')
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def gestione_sessione_sede(session_id):
    user_email = session.get("user_email")
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT s.session_id, s.commission_id, s.nome, s.giorno, s.ora, s.luogo, s.stato_corrente
                FROM sessioni s
                JOIN commissions c ON c.commission_id = s.commission_id
                WHERE s.session_id = %s AND c.user_email = %s
                LIMIT 1
            """, (session_id, user_email))
            sessione = cur.fetchone()

    if not sessione:
        return abort(404)

    return render_template("gestione-concorso-sede.html", sessione=sessione)
