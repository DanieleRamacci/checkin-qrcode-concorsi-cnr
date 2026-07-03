from datetime import date, datetime

from psycopg2.extras import RealDictCursor

from db import get_db_connection
from utils.candidati import importa_candidati_da_api
from utils.notifications import add_notification
from utils.stato import get_stato_corrente, set_stato_corrente


class CandidateNotFound(Exception):
    pass


class CandidateActionBlocked(Exception):
    pass


def _iso(value):
    return value.isoformat() if isinstance(value, (date, datetime)) else value


def _document_expired(value) -> bool:
    if not value:
        return True
    if isinstance(value, (date, datetime)):
        parsed = value.date() if isinstance(value, datetime) else value
    else:
        try:
            parsed = datetime.strptime(str(value), "%d/%m/%Y").date()
        except ValueError:
            return True
    return parsed < date.today()


def _candidate_dto(row) -> dict:
    data = dict(row)
    return {
        "uid": data["uid"],
        "first_name": data.get("first_name"),
        "last_name": data.get("last_name"),
        "document_number": data.get("document_number"),
        "document_expired": _document_expired(data.get("document_date")),
        "checkin_effettuato": bool(data.get("checkin_effettuato")),
        "reset_password_richiesto": bool(data.get("reset_password_richiesto")),
        "reset_password_effettuato": bool(data.get("reset_password_effettuato")),
        "reset_password_richiesto_at": _iso(
            data.get("reset_password_richiesto_at")
        ),
        "reset_password_effettuato_at": _iso(
            data.get("reset_password_effettuato_at")
        ),
    }


def list_candidates(
    session_id: str,
    *,
    query: str = "",
    checkin: str = "all",
    reset: str = "all",
) -> list[dict]:
    where = ["session_id = %s"]
    params = [session_id]
    if query:
        like = f"%{query.lower()}%"
        where.append(
            "(LOWER(first_name) LIKE %s OR LOWER(last_name) LIKE %s "
            "OR LOWER(document_number) LIKE %s)"
        )
        params.extend([like, like, like])
    if checkin in {"yes", "no"}:
        where.append("COALESCE(checkin_effettuato, FALSE) = %s")
        params.append(checkin == "yes")
    if reset == "requested":
        where.append("COALESCE(reset_password_richiesto, FALSE) = TRUE")
    elif reset == "completed":
        where.append("COALESCE(reset_password_effettuato, FALSE) = TRUE")

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT uid, first_name, last_name, document_number,
                       document_date,
                       COALESCE(checkin_effettuato, FALSE) AS checkin_effettuato,
                       COALESCE(reset_password_richiesto, FALSE)
                           AS reset_password_richiesto,
                       reset_password_richiesto_at,
                       COALESCE(reset_password_effettuato, FALSE)
                           AS reset_password_effettuato,
                       reset_password_effettuato_at
                  FROM candidati
                 WHERE {" AND ".join(where)}
              ORDER BY last_name, first_name, uid
                """,
                params,
            )
            return [_candidate_dto(row) for row in cursor.fetchall()]


def _get_candidate(session_id: str, uid: str) -> dict:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT uid, first_name, last_name, document_number,
                       document_date,
                       COALESCE(checkin_effettuato, FALSE) AS checkin_effettuato,
                       COALESCE(reset_password_richiesto, FALSE)
                           AS reset_password_richiesto,
                       reset_password_richiesto_at,
                       COALESCE(reset_password_effettuato, FALSE)
                           AS reset_password_effettuato,
                       reset_password_effettuato_at
                  FROM candidati
                 WHERE session_id = %s AND uid = %s
                """,
                (session_id, uid),
            )
            row = cursor.fetchone()
    if not row:
        raise CandidateNotFound(uid)
    return _candidate_dto(row)


def toggle_candidate_checkin(
    session_id: str,
    uid: str,
    actor_email: str,
) -> dict:
    if get_stato_corrente(session_id) != "checkin_avviato":
        raise CandidateActionBlocked("Il check-in non è attivo.")
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE candidati
                   SET checkin_effettuato =
                       NOT COALESCE(checkin_effettuato, FALSE)
                 WHERE session_id = %s AND uid = %s
                """,
                (session_id, uid),
            )
            if cursor.rowcount != 1:
                raise CandidateNotFound(uid)
        conn.commit()
    return _get_candidate(session_id, uid)


def update_reset_password(
    session_id: str,
    uid: str,
    *,
    operation: str,
    actor_email: str,
) -> dict:
    if operation not in {
        "request",
        "cancel_request",
        "complete",
        "undo_complete",
    }:
        raise CandidateActionBlocked("Operazione reset non valida.")
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            if operation == "request":
                cursor.execute(
                    """
                    UPDATE candidati
                       SET reset_password_richiesto = TRUE,
                           reset_password_richiesto_at = NOW(),
                           reset_password_richiesto_by = %s,
                           reset_password_effettuato = FALSE,
                           reset_password_effettuato_at = NULL,
                           reset_password_effettuato_by = NULL
                     WHERE session_id = %s AND uid = %s
                    """,
                    (actor_email, session_id, uid),
                )
            elif operation == "cancel_request":
                cursor.execute(
                    """
                    UPDATE candidati
                       SET reset_password_richiesto = FALSE,
                           reset_password_richiesto_at = NULL,
                           reset_password_richiesto_by = NULL
                     WHERE session_id = %s AND uid = %s
                    """,
                    (session_id, uid),
                )
            elif operation == "complete":
                cursor.execute(
                    """
                    UPDATE candidati
                       SET reset_password_effettuato = TRUE,
                           reset_password_effettuato_at = NOW(),
                           reset_password_effettuato_by = %s,
                           reset_password_richiesto = FALSE,
                           reset_password_richiesto_at = NULL,
                           reset_password_richiesto_by = NULL
                     WHERE session_id = %s AND uid = %s
                    """,
                    (actor_email, session_id, uid),
                )
            else:
                cursor.execute(
                    """
                    UPDATE candidati
                       SET reset_password_effettuato = FALSE,
                           reset_password_effettuato_at = NULL,
                           reset_password_effettuato_by = NULL
                     WHERE session_id = %s AND uid = %s
                    """,
                    (session_id, uid),
                )
            if cursor.rowcount != 1:
                raise CandidateNotFound(uid)
        conn.commit()
    add_notification(
        session_id,
        "reset",
        payload=f"Reset password: {operation} ({uid})",
        author_email=actor_email,
    )
    return _get_candidate(session_id, uid)


def import_candidates(
    session_id: str,
    *,
    user_email: str,
    access_token: str,
) -> dict:
    result = importa_candidati_da_api(session_id, user_email, access_token)
    if result.get("success") and get_stato_corrente(session_id) == "configurata":
        set_stato_corrente(
            session_id,
            "candidati_scaricati",
            utente=user_email,
        )
    return result
