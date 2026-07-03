from datetime import date, datetime

from psycopg2.extras import RealDictCursor

from db import get_db_connection
from utils.devices_service import authorize_device
from utils.stato import get_stato_corrente


class ScannerCandidateNotFound(Exception):
    pass


class ScannerWorkflowBlocked(Exception):
    pass


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
                       document_date,
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
    return result


def checkin_candidate(session_id: str, uid: str, device_token: str) -> dict:
    authorize_device(session_id, device_token)
    if get_stato_corrente(session_id) != "checkin_avviato":
        raise ScannerWorkflowBlocked("Il check-in non è attivo.")
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE candidati
                   SET checkin_effettuato = TRUE
                 WHERE session_id = %s AND uid = %s
                """,
                (session_id, uid),
            )
            if cursor.rowcount != 1:
                raise ScannerCandidateNotFound(uid)
        conn.commit()
    return verify_candidate(session_id, uid, device_token)
