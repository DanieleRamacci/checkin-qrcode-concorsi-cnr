import os
from datetime import date, datetime

from flask import current_app
from psycopg2.extras import RealDictCursor

from db import get_db_connection
from utils.liste import genera_liste_excel_csv, get_candidati_by_sessione_checkin
from utils.send_mail import send_notification_email
from utils.sessioni import get_bando_config, get_sessione_by_id
from utils.stato import get_stato_corrente, set_stato_corrente


class ListOperationError(Exception):
    pass


def _serialize(row) -> dict:
    return {
        key: value.isoformat() if isinstance(value, (date, datetime)) else value
        for key, value in dict(row).items()
    }


def get_latest_list(session_id: str) -> dict | None:
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT id, session_id, file_xlsx, file_csv_moodle,
                       num_presenti, generato_da, timestamp_creazione
                  FROM liste_generate
                 WHERE session_id = %s
              ORDER BY timestamp_creazione DESC, id DESC
                 LIMIT 1
                """,
                (session_id,),
            )
            row = cursor.fetchone()
    if not row:
        return None
    data = _serialize(row)
    data.pop("file_xlsx", None)
    data.pop("file_csv_moodle", None)
    data["downloads"] = {
        "xlsx": f"/api/v1/sessioni/{session_id}/lists/download?type=xlsx",
        "moodle_csv": (
            f"/api/v1/sessioni/{session_id}/lists/download?type=moodle_csv"
        ),
    }
    return data


def generate_lists(session_id: str, *, actor_email: str) -> dict:
    if get_stato_corrente(session_id) != "checkin_concluso":
        raise ListOperationError("Il check-in non è ancora concluso.")
    candidates = get_candidati_by_sessione_checkin(session_id)
    if not candidates:
        raise ListOperationError("Nessun candidato presente.")

    generated = genera_liste_excel_csv(session_id, candidates)
    # Riusa temporaneamente il generatore Moodle legacy per mantenere identico
    # il formato durante la coesistenza; verrà rimosso con il cutover Jinja.
    from routes.azioni import genera_moodle_csv_su_disco

    moodle = genera_moodle_csv_su_disco(session_id)
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO liste_generate (
                    session_id, file_xlsx, file_csv_moodle,
                    num_presenti, generato_da
                ) VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    session_id,
                    generated["file_xlsx"],
                    moodle["file_csv_moodle"],
                    moodle["num_presenti"],
                    actor_email,
                ),
            )
        conn.commit()
    set_stato_corrente(session_id, "liste_generate", utente=actor_email)
    return get_latest_list(session_id)


def get_download_path(session_id: str, file_type: str) -> tuple[str, str]:
    column = {
        "xlsx": "file_xlsx",
        "moodle_csv": "file_csv_moodle",
    }.get(file_type)
    if not column:
        raise ListOperationError("Tipo file non valido.")
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT {column}
                  FROM liste_generate
                 WHERE session_id = %s
              ORDER BY timestamp_creazione DESC, id DESC
                 LIMIT 1
                """,
                (session_id,),
            )
            row = cursor.fetchone()
    if not row:
        raise ListOperationError("Lista non trovata.")
    filename = os.path.basename(row[0])
    base_dir = current_app.config.get("FILES_BASE_DIR") or os.path.join(
        current_app.root_path,
        "files_liste",
    )
    path = os.path.join(base_dir, filename)
    if not os.path.isfile(path):
        raise ListOperationError("File non trovato.")
    return path, filename


def send_latest_list(
    session_id: str,
    *,
    actor_email: str,
    recipients: list[str] | None = None,
) -> dict:
    metadata = get_latest_list(session_id)
    if not metadata:
        raise ListOperationError("Lista non trovata.")
    sessione = get_sessione_by_id(session_id)
    if not sessione:
        raise ListOperationError("Sessione non trovata.")
    config = get_bando_config(sessione["commission_id"]) or {}
    to_emails = recipients or [
        email
        for email in [config.get("email_esperto_remoto")]
        if email
    ]
    if not to_emails:
        raise ListOperationError("Destinatario non configurato.")

    attachments = [
        get_download_path(session_id, "xlsx")[0],
        get_download_path(session_id, "moodle_csv")[0],
    ]
    ok, error = send_notification_email(
        to_emails,
        f"[Check-in] Lista esame – {sessione.get('nome', '')}",
        f"Presenti: {metadata['num_presenti']}",
        attachments=attachments,
        cc_emails=[actor_email],
        reply_to=actor_email,
        actor_email=actor_email,
        source="api_v1.lists.send",
    )
    set_stato_corrente(session_id, "liste_inviate", utente=actor_email)
    return {"sent": bool(ok), "warning": error, "recipients": to_emails}
