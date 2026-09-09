from db import get_db_connection
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, get_user_roles
from utils.sessioni import get_sessione_config


def _display_name(email: str | None) -> str:
    if not email:
        return "-"
    local = email.split("@", 1)[0]
    return " ".join(part.capitalize() for part in local.replace("_", ".").split(".") if part) or email


def _author_role(session_id: str | None, email: str | None) -> str:
    normalized = (email or "").strip().lower()
    if not normalized:
        return "Sistema"
    config = (session_id and get_sessione_config(session_id)) or {}
    if normalized == (config.get("email_esperto_remoto") or "").strip().lower():
        return "Inf. remoto"
    if normalized == (config.get("email_informatico_sede") or "").strip().lower():
        return "Inf. sede"
    roles = get_user_roles(normalized)
    if ROLE_ADMIN in roles:
        return "Admin"
    if ROLE_ESPERTO in roles:
        return "Inf. remoto"
    return "Segretario"


def add_notification(session_id, notif_type, payload=None, author_email=None):
    if not session_id or not notif_type:
        return
    # Ruolo/nome autore calcolati e persistiti al momento della creazione:
    # riflettono la configurazione della sessione *in quel momento*, cosi'
    # una riassegnazione successiva (es. cambio informatico sede) non altera
    # retroattivamente chi risulta aver scritto i messaggi passati.
    author_display = _display_name(author_email)
    author_role = _author_role(session_id, author_email)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO session_notifications
                    (session_id, author_email, type, payload, author_display, author_role)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (session_id, author_email, notif_type, payload, author_display, author_role),
            )
        conn.commit()


def get_notifications(session_id, limit=20):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, session_id, author_email, type, payload, created_at,
                       author_display, author_role
                FROM session_notifications
                WHERE session_id = %s
                ORDER BY created_at DESC, id DESC
                LIMIT %s
                """,
                (session_id, limit),
            )
            rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "session_id": r[1],
            "author_email": r[2],
            "type": r[3],
            "payload": r[4],
            "created_at": r[5],
            # Righe storiche create prima dell'introduzione di queste colonne
            # non hanno un valore persistito: si ricalcola al volo solo in
            # quel caso, come unico fallback.
            "author_display": r[6] or _display_name(r[2]),
            "author_role": r[7] or _author_role(r[1], r[2]),
        }
        for r in rows
    ]
