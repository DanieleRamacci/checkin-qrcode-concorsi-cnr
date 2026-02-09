from flask import Blueprint, render_template, session, request
from routes.auth import login_required
from db import get_db_connection
from utils.notifications import get_notifications
from utils.stato import get_stato_corrente, SESSION_STATES


notifiche_bp = Blueprint("notifiche", __name__)


@notifiche_bp.route("/sessione/<session_id>/notifiche-frammento")
@login_required
def notifiche_frammento(session_id):
    user_email = session.get("user_email")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1
                FROM sessioni s
                JOIN commissions c ON c.commission_id = s.commission_id
                WHERE s.session_id = %s AND c.user_email = %s
                LIMIT 1
                """,
                (session_id, user_email),
            )
            if not cur.fetchone():
                return "Utente non autorizzato", 403

    notifiche = get_notifications(session_id, limit=50)
    latest = notifiche[0] if notifiche else None
    notifiche_chrono = list(reversed(notifiche))
    stato_corrente = get_stato_corrente(session_id)
    prev_state = None
    next_state = None
    if stato_corrente in SESSION_STATES:
        idx = SESSION_STATES.index(stato_corrente)
        if idx > 0:
            prev_state = SESSION_STATES[idx - 1]
        if idx + 1 < len(SESSION_STATES):
            next_state = SESSION_STATES[idx + 1]

    return render_template(
        "frammenti/notifiche.html",
        session_id=session_id,
        notifiche=notifiche_chrono,
        latest=latest,
        stato_corrente=stato_corrente,
        prev_state=prev_state,
        next_state=next_state
    )


@notifiche_bp.route("/sessione/<session_id>/notifiche", methods=["POST"])
@login_required
def invia_messaggio(session_id):
    testo = (request.form.get("message") or "").strip()
    if not testo:
        return notifiche_frammento(session_id)

    user_email = session.get("user_email")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 1
                FROM sessioni s
                JOIN commissions c ON c.commission_id = s.commission_id
                WHERE s.session_id = %s AND c.user_email = %s
                LIMIT 1
            """, (session_id, user_email))
            if not cur.fetchone():
                return ("Utente non autorizzato", 403)

    from utils.notifications import add_notification
    add_notification(session_id, "message", payload=testo, author_email=user_email)
    return notifiche_frammento(session_id)
