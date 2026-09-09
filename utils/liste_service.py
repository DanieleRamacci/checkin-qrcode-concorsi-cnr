import os
from datetime import date, datetime

from flask import current_app
from psycopg2.extras import RealDictCursor

from db import get_db_connection
from utils.liste import genera_liste_excel_csv, get_candidati_by_sessione_checkin
from utils.send_mail import send_notification_email
from utils.sessioni import get_sessione_by_id, get_sessione_config
from utils.stato import (
    SESSION_STATES,
    claim_transition,
    get_stato_corrente,
    set_stato_corrente,
)


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
                       num_presenti, generato_da, timestamp_creazione,
                       email_status, email_error
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


def _state_at_or_after(current_state: str | None, target_state: str) -> bool:
    try:
        return SESSION_STATES.index(current_state) >= SESSION_STATES.index(target_state)  # type: ignore[arg-type]
    except ValueError:
        return False


def _with_status(metadata: dict, *, status: str, message: str) -> dict:
    return {**metadata, "status": status, "message": message}


def _set_list_email_status(list_id: int, *, status: str, error: str | None) -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE liste_generate SET email_status = %s, email_error = %s WHERE id = %s",
                (status, error, list_id),
            )
        conn.commit()


def generate_lists(session_id: str, *, actor_email: str) -> dict:
    current_state = get_stato_corrente(session_id)
    if current_state == "liste_generate":
        metadata = get_latest_list(session_id)
        if metadata:
            return _with_status(
                metadata,
                status="already_generated",
                message="Liste candidati già generate.",
            )
        raise ListOperationError("Lo stato indica liste generate, ma i file non sono disponibili.")
    if _state_at_or_after(current_state, "liste_inviate"):
        metadata = get_latest_list(session_id)
        if metadata:
            return _with_status(
                metadata,
                status="already_sent",
                message="Liste candidati già inviate.",
            )
        raise ListOperationError("Lo stato indica liste inviate, ma i file non sono disponibili.")
    if current_state != "checkin_concluso":
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
    metadata = get_latest_list(session_id)
    if not metadata:
        raise ListOperationError("Lista generata ma non riletta correttamente.")
    return _with_status(
        metadata,
        status="generated",
        message="Liste candidati generate correttamente.",
    )


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


def _already_sent_response(metadata: dict, to_emails: list[str]) -> dict:
    email_status = metadata.get("email_status")
    return {
        "sent": email_status == "sent",
        "already_sent": True,
        "state_updated": True,
        "status": "already_sent",
        "message": "Liste candidati già rese disponibili all'informatico da remoto.",
        "email_status": email_status,
        "warning": (
            f"Email non inviata: {metadata.get('email_error') or 'errore email non specificato'}. "
            "L'informatico da remoto può comunque vedere e scaricare le liste dalla propria dashboard."
            if email_status == "failed"
            else None
        ),
        "recipients": to_emails,
    }


def send_latest_list(
    session_id: str,
    *,
    actor_email: str,
    recipients: list[str] | None = None,
) -> dict:
    metadata = get_latest_list(session_id)
    if not metadata:
        raise ListOperationError("Lista non trovata.")
    current_state = get_stato_corrente(session_id)
    sessione = get_sessione_by_id(session_id)
    if not sessione:
        raise ListOperationError("Sessione non trovata.")
    config = get_sessione_config(session_id) or {}
    to_emails = recipients or [
        email
        for email in [config.get("email_esperto_remoto")]
        if email
    ]
    if not to_emails:
        raise ListOperationError(
            "Esperto informatico da remoto non configurato per questa sessione."
        )
    if _state_at_or_after(current_state, "liste_inviate"):
        return _already_sent_response(metadata, to_emails)
    if current_state != "liste_generate":
        raise ListOperationError("Le liste non sono ancora pronte per l'invio.")

    # Transizione atomica prima dell'invio: se due richieste concorrenti
    # (doppio click, doppia tab) arrivano qui insieme, solo una vince la
    # race e invia davvero l'email; l'altra vede che lo stato e' gia'
    # avanzato e restituisce la risposta idempotente senza inviare di nuovo.
    claimed = claim_transition(session_id, "liste_generate", "liste_inviate", utente=actor_email)
    if not claimed:
        metadata = get_latest_list(session_id) or metadata
        return _already_sent_response(metadata, to_emails)

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
    # Lo stato e' gia' avanzato (claim_transition sopra): l'informatico da
    # remoto deve vedere le liste generate e scaricabili anche se la notifica
    # via email non e' partita.
    _set_list_email_status(
        metadata["id"],
        status="sent" if ok else "failed",
        error=None if ok else (error or "errore email non specificato"),
    )
    if not ok:
        return {
            "sent": False,
            "already_sent": False,
            "state_updated": True,
            "status": "available_email_failed",
            "email_status": "failed",
            "message": (
                "Liste candidati rese disponibili all'informatico da remoto. "
                "L'email di notifica non è stata inviata."
            ),
            "warning": error or "errore email non specificato",
            "recipients": to_emails,
        }
    return {
        "sent": True,
        "already_sent": False,
        "state_updated": True,
        "status": "sent",
        "email_status": "sent",
        "message": "Liste candidati inviate correttamente.",
        "warning": error,
        "recipients": to_emails,
    }
