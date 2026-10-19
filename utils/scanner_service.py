from datetime import date, datetime

from psycopg2.extras import RealDictCursor

from db import get_db_connection
from utils.devices_service import authorize_device
from utils.stato import get_stato_corrente
from utils.candidati_service import update_candidate_note


class ScannerCandidateNotFound(Exception):
    pass


class ScannerWorkflowBlocked(Exception):
    def __init__(self, message: str, current_state: str | None = None):
        super().__init__(message)
        self.current_state = current_state


def _expired(value) -> bool:
    if not value:
        return True
    if isinstance(value, datetime):
        parsed = value.date()
    elif isinstance(value, date):
        parsed = value
    else:
        try:
            parsed = datetime.strptime(str(value), "%d/%m/%Y").date()
        except ValueError:
            return True
    return parsed < date.today()


def verify_candidate(session_id: str, uid: str, device_token: str) -> dict:
    authorize_device(session_id, device_token)
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT uid, first_name, last_name, document_number,
                       document_date, checkin_at, checkin_source,
                       COALESCE(checkin_effettuato, FALSE) AS checkin_effettuato
                  FROM candidati
                 WHERE session_id = %s AND uid = %s
                """,
                (session_id, uid),
            )
            row = cursor.fetchone()
    if not row:
        raise ScannerCandidateNotFound(uid)
    result = dict(row)
    result["document_expired"] = _expired(result.pop("document_date", None))
    result["checkin_effettuato"] = bool(result["checkin_effettuato"])
    value = result.get("checkin_at")
    result["checkin_at"] = value.isoformat() if value else None
    return result


def checkin_candidate(session_id: str, uid: str, device_token: str) -> dict:
    authorize_device(session_id, device_token)
    if get_stato_corrente(session_id) != "checkin_avviato":
        raise ScannerWorkflowBlocked("Il check-in non è attivo.", get_stato_corrente(session_id))
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE candidati
                   SET checkin_effettuato = TRUE,
                       checkin_at = CASE WHEN COALESCE(checkin_effettuato, FALSE) THEN checkin_at ELSE NOW() END,
                       checkin_source = CASE WHEN COALESCE(checkin_effettuato, FALSE) THEN checkin_source ELSE 'scanner' END
                 WHERE session_id = %s AND uid = %s
                """,
                (session_id, uid),
            )
            if cursor.rowcount != 1:
                raise ScannerCandidateNotFound(uid)
        conn.commit()
    return verify_candidate(session_id, uid, device_token)


def session_summary(session_id: str, device_token: str) -> dict:
    authorize_device(session_id, device_token)
    with get_db_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT session_string, stato_corrente FROM sessioni WHERE session_id = %s", (session_id,))
        session_row = cursor.fetchone()
        if not session_row:
            raise ScannerCandidateNotFound(session_id)
        cursor.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE COALESCE(checkin_effettuato, FALSE)) FROM candidati WHERE session_id = %s", (session_id,))
        total, present = cursor.fetchone()
    return {"session_id": session_id, "name": session_row[0], "current_state": session_row[1], "candidate_count": total, "checked_in_count": present}


def search_candidates(session_id: str, device_token: str, query: str) -> list[dict]:
    authorize_device(session_id, device_token)
    normalized = " ".join((query or "").lower().split())
    if len(normalized) < 2:
        raise ValueError("La ricerca deve contenere almeno due caratteri.")
    with get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            """SELECT uid, first_name, last_name, document_number, document_date,
                      COALESCE(checkin_effettuato, FALSE) AS checkin_effettuato
                 FROM candidati WHERE session_id = %s
             ORDER BY last_name, first_name LIMIT 1000""",
            (session_id,),
        )
        rows = [dict(row) for row in cursor.fetchall()]
    digits_query = "".join(normalized.split())
    tokens = normalized.split()
    matches = []
    for row in rows:
        name = (row.get("first_name") or "").lower()
        surname = (row.get("last_name") or "").lower()
        document = "".join((row.get("document_number") or "").lower().split())
        is_match = row["uid"].lower() == normalized
        is_match = is_match or (len(tokens) == 1 and (tokens[0] in name or tokens[0] in surname))
        is_match = is_match or (len(tokens) > 1 and all(token in (name + " " + surname) for token in tokens))
        is_match = is_match or (digits_query and document.startswith(digits_query))
        if is_match:
            matches.append({"uid": row["uid"], "first_name": row["first_name"], "last_name": row["last_name"], "document_number": row["document_number"], "document_expired": _expired(row["document_date"]), "checkin_effettuato": bool(row["checkin_effettuato"])})
    return matches[:10]


def update_note_from_device(session_id: str, uid: str, device_token: str, note: str, actor_email: str | None = None) -> dict:
    authorize_device(session_id, device_token)
    if not isinstance(note, str) or len(note) > 2000:
        raise ValueError("La nota deve essere testuale e non superare 2000 caratteri.")
    return update_candidate_note(session_id, uid, note=note, actor_email=actor_email or "")
