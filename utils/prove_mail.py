import os
import logging
from flask import current_app
from db import get_db_connection
from utils.send_mail import send_notification_email

logger = logging.getLogger(__name__)


def _prove_docs_by_type(prove_id, doc_type):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT filename, version
                FROM prove_documents
                WHERE prove_id = %s AND doc_type = %s
                ORDER BY version DESC, created_at DESC
                """,
                (prove_id, doc_type),
            )
            return cur.fetchall()


def _prove_contacts(prove_id):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT prove_id, titolo, numero_bando, esperto_email, segretario_email
                FROM prove
                WHERE prove_id = %s
                """,
                (prove_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "prove_id": row[0],
                "titolo": row[1],
                "numero_bando": row[2],
                "esperto_email": row[3],
                "segretario_email": row[4],
            }


def _doc_abs_path(prove_id, filename):
    base_dir = current_app.config.get("FILES_BASE_DIR") or os.path.join(current_app.root_path, "files_liste")
    return os.path.join(base_dir, "prove", str(prove_id), filename)


def _log_email(prove_id, subject, to_emails, cc_emails, attachments, status, sent_by):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO prove_emails_log (prove_id, subject, to_emails, cc_emails, attachments, smtp_status, sent_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        prove_id,
                        subject,
                        ",".join(to_emails or []),
                        ",".join(cc_emails or []),
                        ",".join(attachments or []),
                        status,
                        sent_by,
                    ),
                )
            conn.commit()
    except Exception:
        logger.exception(
            "[prove_mail] impossibile registrare prove_emails_log prove_id=%s subject=%s status=%s",
            prove_id,
            subject,
            status,
        )


def send_template_moodle_to_segreteria(prove_id, sent_by):
    prova = _prove_contacts(prove_id)
    if not prova:
        return False, "Prova non trovata"

    to_emails = [e for e in [prova.get("segretario_email")] if e]
    cc_emails = [e for e in [prova.get("esperto_email")] if e]
    if not to_emails:
        return False, "Email segretario non valorizzata"

    doc_rows = _prove_docs_by_type(prove_id, "lista_convocati_moodle")
    attachments = []
    for filename, _ in doc_rows:
        abs_path = _doc_abs_path(prove_id, filename)
        if os.path.exists(abs_path):
            attachments.append(abs_path)

    if not attachments:
        return False, "Nessun documento lista_convocati_moodle disponibile"

    subject = f"[Prove] Candidati da caricare su piattaforma esami - {prova.get('numero_bando') or prova.get('titolo') or prove_id}"
    body = (
        "Buongiorno,\n\n"
        "in allegato la lista candidati convocati per il caricamento sulla piattaforma esami.\n\n"
        "Cordiali saluti,\n"
        "Sistema Check-in CNR"
    )

    if sent_by:
        cc_emails = list(dict.fromkeys(cc_emails + [sent_by]))
    ok, err = send_notification_email(
        to_emails,
        subject,
        body,
        attachments=attachments,
        cc_emails=cc_emails,
        reply_to=sent_by or None,
        actor_email=sent_by or None,
        source="prove_mail.send_template_moodle_to_segreteria",
    )
    status = "SENT" if ok else f"ERROR: {err}"
    _log_email(prove_id, subject, to_emails, cc_emails, [os.path.basename(a) for a in attachments], status, sent_by)
    return ok, err


def send_excel_presenti_to_segreteria(prove_id, sent_by):
    prova = _prove_contacts(prove_id)
    if not prova:
        return False, "Prova non trovata"

    to_emails = [e for e in [prova.get("segretario_email")] if e]
    cc_emails = [e for e in [prova.get("esperto_email")] if e]
    if not to_emails:
        return False, "Email segretario non valorizzata"

    doc_rows = _prove_docs_by_type(prove_id, "lista_presenti_excel")
    if not doc_rows:
        doc_rows = _prove_docs_by_type(prove_id, "excel_presenze_template")
    if not doc_rows:
        return False, "Nessun documento lista_presenti_excel / excel_presenze_template disponibile"

    filename = doc_rows[0][0]
    attachments = []
    abs_path = _doc_abs_path(prove_id, filename)
    if os.path.exists(abs_path):
        attachments.append(abs_path)
    if not attachments:
        return False, "File Excel presenti non trovato sul server"

    subject = f"[Prove] Excel presenti - {prova.get('numero_bando') or prova.get('titolo') or prove_id}"
    body = (
        "Buongiorno,\n\n"
        "in allegato il file Excel con i presenti.\n\n"
        "Cordiali saluti,\n"
        "Sistema Check-in CNR"
    )

    if sent_by:
        cc_emails = list(dict.fromkeys(cc_emails + [sent_by]))
    ok, err = send_notification_email(
        to_emails,
        subject,
        body,
        attachments=attachments,
        cc_emails=cc_emails,
        reply_to=sent_by or None,
        actor_email=sent_by or None,
        source="prove_mail.send_excel_presenti_to_segreteria",
    )
    status = "SENT" if ok else f"ERROR: {err}"
    _log_email(prove_id, subject, to_emails, cc_emails, [os.path.basename(a) for a in attachments], status, sent_by)
    return ok, err


def send_modelli_buste_to_segreteria(prove_id, sent_by):
    prova = _prove_contacts(prove_id)
    if not prova:
        return False, "Prova non trovata"

    to_emails = [e for e in [prova.get("segretario_email")] if e]
    cc_emails = [e for e in [prova.get("esperto_email")] if e]
    if not to_emails:
        return False, "Email segretario non valorizzata"

    attachments = []
    attachment_names = []
    for doc_type in ("template_busta_a_vuota", "template_busta_b_vuota", "template_busta_c_vuota", "template_buste_esame"):
        for filename, _ in _prove_docs_by_type(prove_id, doc_type):
            abs_path = _doc_abs_path(prove_id, filename)
            if os.path.exists(abs_path):
                attachments.append(abs_path)
                attachment_names.append(filename)

    if not attachments:
        return False, "Nessun modello busta disponibile da inviare"

    subject = f"[Prove] Modelli buste esame - {prova.get('numero_bando') or prova.get('titolo') or prove_id}"
    body = (
        "Buongiorno,\n\n"
        "in allegato i modelli buste esame (A/B/C).\n\n"
        "Cordiali saluti,\n"
        "Sistema Check-in CNR"
    )

    if sent_by:
        cc_emails = list(dict.fromkeys(cc_emails + [sent_by]))
    ok, err = send_notification_email(
        to_emails,
        subject,
        body,
        attachments=attachments,
        cc_emails=cc_emails,
        reply_to=sent_by or None,
        actor_email=sent_by or None,
        source="prove_mail.send_modelli_buste_to_segreteria",
    )
    status = "SENT" if ok else f"ERROR: {err}"
    _log_email(prove_id, subject, to_emails, cc_emails, attachment_names, status, sent_by)
    return ok, err
