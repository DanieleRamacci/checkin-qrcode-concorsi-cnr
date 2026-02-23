import os
import uuid
import json
import secrets
import csv
import re
import io
import shutil
import zipfile
import tempfile
from datetime import datetime, date, timedelta
from pathlib import Path
from flask import Blueprint, render_template, request, session, redirect, url_for, abort, current_app, send_file
from urllib.parse import quote_plus
from openpyxl import Workbook
from psycopg2.extras import RealDictCursor
from werkzeug.utils import secure_filename

from db import get_db_connection
from routes.auth import login_required
from utils.roles import (
    ROLE_ADMIN,
    ROLE_ESPERTO,
    roles_required_any,
    has_role,
)
from utils.prove_stato import (
    PROVE_STATES,
    ACTION_TO_STATE,
    transition_prova_state,
    ProveStateError,
    giorni_alla_prova,
    next_state_for,
)
from utils.prove_mail import (
    send_template_moodle_to_segreteria,
    send_excel_presenti_to_segreteria,
    send_modelli_buste_to_segreteria,
)
from utils.send_mail import send_notification_email


prove_bp = Blueprint("prove", __name__)

STATE_LABELS = {
    "bozza": "Bozza",
    "dettagli_completati": "Dettagli completati",
    "convocazioni_inviate": "Convocazioni inviate",
    "lista_candidati_da_acquisire": "Lista candidati da acquisire",
    "lista_candidati_acquisita": "Lista candidati acquisita",
    "template_moodle_da_inviare": "Candidati da caricare su piattaforma esami",
    "template_moodle_inviati": "Candidati caricati su piattaforma esami",
    "modelli_buste_inviati_al_segretario": "Modelli buste esame inviati al segretario",
    "excel_presenti_generato": "Excel presenti generato",
    "excel_presenti_inviato": "Excel presenti inviato",
    "lista_presenti_ricevuta": "Lista presenti ricevuta",
    "presenti_attivati_su_moodle": "Presenti attivati su Moodle",
    "buste_con_domande_ricevute": "Buste con domande ricevute",
    "domande_caricate": "Domande caricate",
    "estrazione_busta": "Estrazione busta",
    "busta_estratta": "Busta estratta",
    "prova_avviata": "Prova avviata",
    "prova_conclusa": "Prova conclusa",
    "inserire_data_valutazione_prova": "Inserire data valutazione prova",
    "prova_valutata": "Prova valutata",
}

STATE_HINTS = {
    "template_moodle_da_inviare": "Carica la lista convocati Moodle (CSV) e verifica i dati candidati prima dell'invio.",
    "template_moodle_inviati": "La lista convocati risulta inviata/caricata su piattaforma esami.",
    "modelli_buste_inviati_al_segretario": "Invia i modelli buste A/B/C al segretario.",
    "excel_presenti_generato": "Genera o aggiorna il file Excel presenze da lista convocati Moodle.",
    "excel_presenti_inviato": "Invia il file lista presenti Excel al destinatario previsto.",
    "buste_con_domande_ricevute": "Carica nella sezione Buste i tre file ricevuti (A/B/C).",
    "estrazione_busta": "Seleziona la busta estratta (A/B/C) prima di iniziare la prova.",
    "inserire_data_valutazione_prova": "Inserisci la data in cui è avvenuta la valutazione della prova.",
}

SENT_DOC_TYPES = {
    "lista_convocati_moodle",
    "excel_presenze_template",
    "template_buste_esame",
    "template_busta_a_vuota",
    "template_busta_b_vuota",
    "template_busta_c_vuota",
}

RECEIVED_DOC_TYPES = {
    "lista_presenti_excel",
    "busta_a_ricevuta",
    "busta_b_ricevuta",
    "busta_c_ricevuta",
}

MONTHS_IT = {
    1: "gennaio",
    2: "febbraio",
    3: "marzo",
    4: "aprile",
    5: "maggio",
    6: "giugno",
    7: "luglio",
    8: "agosto",
    9: "settembre",
    10: "ottobre",
    11: "novembre",
    12: "dicembre",
}

TIPOLOGIA_PROVA_OPTIONS = [
    "risposta_multipla",
    "risposta_aperta",
]

TEMPLATE_CATEGORIA_OPTIONS = [
    "risposta_multipla",
    "risposta_aperta",
]

GLOBAL_TEMPLATE_DOC_TYPES_ALLOWED = {
    "template_busta_a_vuota",
    "template_busta_b_vuota",
    "template_busta_c_vuota",
}

BACKUP_TABLES = [
    "prove",
    "prove_documents",
    "prove_state_log",
    "prove_external_tokens",
    "prove_emails_log",
    "prove_global_templates",
    "prove_support_staff",
]


def _user_email():
    return (session.get("user_email") or "").strip().lower()


def _is_admin(email):
    return has_role(email, ROLE_ADMIN)


def _can_edit(prova_row, email, is_admin):
    if is_admin:
        return True
    assigned = (prova_row.get("esperto_email") or "").strip().lower()
    if assigned and assigned == (email or "").lower():
        return True
    # Se non c'è ancora esperto assegnato, può intervenire il creatore del concorso.
    if not assigned and (prova_row.get("created_by") or "").strip().lower() == (email or "").lower():
        return True
    return False


def _can_view_prova(prova_row, email, is_admin):
    return _can_edit(prova_row, email, is_admin)


def _can_view_sensitive_docs(prova_row, email, is_admin):
    if is_admin:
        return True
    assigned = (prova_row.get("esperto_email") or "").strip().lower()
    return bool(assigned and assigned == (email or "").lower())


def _base_files_dir():
    base = current_app.config.get("FILES_BASE_DIR") or os.path.join(current_app.root_path, "files_liste")
    Path(base).mkdir(parents=True, exist_ok=True)
    return base


def _prove_doc_dir(prove_id):
    folder = os.path.join(_base_files_dir(), "prove", str(prove_id))
    Path(folder).mkdir(parents=True, exist_ok=True)
    return folder


def _prove_global_templates_dir():
    folder = os.path.join(_base_files_dir(), "prove", "_global_templates")
    Path(folder).mkdir(parents=True, exist_ok=True)
    return folder


def _save_document(prove_id, doc_type, file_storage, note, uploaded_by):
    if not file_storage or not file_storage.filename:
        raise ValueError("File mancante")

    original_name = secure_filename(file_storage.filename)
    if not original_name:
        raise ValueError("Nome file non valido")

    stem, ext = os.path.splitext(original_name)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(MAX(version), 0)
                FROM prove_documents
                WHERE prove_id = %s AND doc_type = %s
                """,
                (str(prove_id), doc_type),
            )
            current_max = cur.fetchone()[0] or 0
            new_version = int(current_max) + 1

            final_name = f"{stem}_v{new_version}{ext}"
            save_path = os.path.join(_prove_doc_dir(prove_id), final_name)
            file_storage.save(save_path)

            cur.execute(
                """
                INSERT INTO prove_documents (prove_id, doc_type, filename, version, note, uploaded_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (str(prove_id), doc_type, final_name, new_version, note, uploaded_by),
            )
        conn.commit()

    return {"filename": final_name, "version": new_version}


def _save_global_template(doc_type, template_categoria, file_storage, note, uploaded_by):
    if not file_storage or not file_storage.filename:
        raise ValueError("File mancante")

    original_name = secure_filename(file_storage.filename)
    if not original_name:
        raise ValueError("Nome file non valido")

    stem, ext = os.path.splitext(original_name)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(MAX(version), 0)
                FROM prove_global_templates
                WHERE doc_type = %s AND template_categoria = %s
                """,
                (doc_type, template_categoria),
            )
            current_max = cur.fetchone()[0] or 0
            new_version = int(current_max) + 1

            final_name = f"{stem}_v{new_version}{ext}"
            save_path = os.path.join(_prove_global_templates_dir(), final_name)
            file_storage.save(save_path)

            cur.execute(
                """
                INSERT INTO prove_global_templates (doc_type, template_categoria, filename, version, note, uploaded_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (doc_type, template_categoria, final_name, new_version, note, uploaded_by),
            )
        conn.commit()

    return {"filename": final_name, "version": new_version}


def _list_global_templates(doc_types=None):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if doc_types:
                cur.execute(
                    """
                    SELECT id, doc_type, template_categoria, filename, version, note, uploaded_by, created_at
                    FROM prove_global_templates
                    WHERE doc_type = ANY(%s)
                    ORDER BY doc_type ASC, version DESC, created_at DESC
                    """,
                    (doc_types,),
                )
            else:
                cur.execute(
                    """
                    SELECT id, doc_type, template_categoria, filename, version, note, uploaded_by, created_at
                    FROM prove_global_templates
                    ORDER BY doc_type ASC, version DESC, created_at DESC
                    """
                )
            return cur.fetchall()


def _get_docs_by_types(prove_id, doc_types):
    if not doc_types:
        return []
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, doc_type, filename, version, note, uploaded_by, created_at
                FROM prove_documents
                WHERE prove_id = %s AND doc_type = ANY(%s)
                ORDER BY created_at DESC, id DESC
                """,
                (str(prove_id), doc_types),
            )
            return cur.fetchall()


def _state_doc_types(stato_corrente):
    mapping = {
        "template_moodle_da_inviare": ["lista_convocati_moodle"],
        "template_moodle_inviati": ["lista_convocati_moodle"],
        "modelli_buste_inviati_al_segretario": ["template_busta_a_vuota", "template_busta_b_vuota", "template_busta_c_vuota", "template_buste_esame"],
        "excel_presenti_generato": ["excel_presenze_template"],
        "excel_presenti_inviato": ["lista_presenti_excel"],
        "lista_presenti_ricevuta": ["lista_presenti_excel"],
        "presenti_attivati_su_moodle": ["lista_presenti_excel"],
        "buste_con_domande_ricevute": ["busta_a_ricevuta", "busta_b_ricevuta", "busta_c_ricevuta"],
        "domande_caricate": ["busta_a_ricevuta", "busta_b_ricevuta", "busta_c_ricevuta"],
        "estrazione_busta": ["busta_a_ricevuta", "busta_b_ricevuta", "busta_c_ricevuta"],
        "busta_estratta": ["busta_a_ricevuta", "busta_b_ricevuta", "busta_c_ricevuta"],
        "inserire_data_valutazione_prova": [],
        "prova_valutata": [],
    }
    return mapping.get(stato_corrente, [])


def _doc_abs_path(prove_id, filename):
    return os.path.join(_prove_doc_dir(prove_id), filename)


def _safe_filename_part(value):
    raw = (value or "").strip()
    if not raw:
        return "-"
    return re.sub(r'[\\/:*?"<>|]+', "-", raw)


def _json_default_serializer(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return str(obj)


def _dump_backup_payload():
    payload = {
        "meta": {
            "created_at": datetime.now().isoformat(),
            "module": "prove",
            "version": 1,
        },
        "tables": {},
    }
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for table_name in BACKUP_TABLES:
                cur.execute(f"SELECT * FROM {table_name}")
                payload["tables"][table_name] = cur.fetchall()
    return payload


def _insert_rows(cur, table_name, rows):
    if not rows:
        return
    cols = list(rows[0].keys())
    cols_sql = ", ".join(cols)
    values_sql = ", ".join(["%s"] * len(cols))
    q = f"INSERT INTO {table_name} ({cols_sql}) VALUES ({values_sql})"
    for row in rows:
        cur.execute(q, tuple(row.get(c) for c in cols))


def _reset_serial_sequence(cur, table_name, id_col="id"):
    cur.execute(f"SELECT COALESCE(MAX({id_col}), 0) FROM {table_name}")
    max_id = cur.fetchone()[0] or 0
    if max_id <= 0:
        cur.execute("SELECT setval(pg_get_serial_sequence(%s, %s), 1, false)", (table_name, id_col))
    else:
        cur.execute("SELECT setval(pg_get_serial_sequence(%s, %s), %s, true)", (table_name, id_col, max_id))


def _split_docs(docs):
    sent = []
    received = []
    other = []
    for d in docs:
        dt = d.get("doc_type")
        if dt in SENT_DOC_TYPES:
            sent.append(d)
        elif dt in RECEIVED_DOC_TYPES:
            received.append(d)
        else:
            other.append(d)
    return sent, received, other


def _send_state_email(prove_id, sent_by, to_emails, cc_emails, subject, body, doc_ids):
    attachments = []
    attachment_names = []
    if doc_ids:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, filename
                    FROM prove_documents
                    WHERE prove_id = %s AND id = ANY(%s)
                    """,
                    (str(prove_id), doc_ids),
                )
                rows = cur.fetchall()
        selected_ids = {int(r["id"]) for r in rows}
        missing_ids = [str(x) for x in doc_ids if int(x) not in selected_ids]
        if missing_ids:
            current_app.logger.warning(
                "[prove_mail] prove_id=%s documenti non trovati per allegato doc_ids=%s",
                prove_id,
                ",".join(missing_ids),
            )
        for row in rows:
            abs_path = _doc_abs_path(prove_id, row["filename"])
            if os.path.exists(abs_path):
                attachments.append(abs_path)
                attachment_names.append(row["filename"])
            else:
                current_app.logger.warning(
                    "[prove_mail] prove_id=%s allegato non presente su disco filename=%s path=%s",
                    prove_id,
                    row["filename"],
                    abs_path,
                )

    merged_cc = list(dict.fromkeys([e.strip() for e in (cc_emails or []) if e.strip()] + [sent_by]))
    merged_to = list(dict.fromkeys([e.strip() for e in (to_emails or []) if e.strip()]))
    recipients = list(dict.fromkeys(merged_to + merged_cc))
    if not recipients:
        current_app.logger.warning("[prove_mail] prove_id=%s invio bloccato: nessun destinatario valido", prove_id)
        return False, "Nessun destinatario valido"

    current_app.logger.info(
        "[prove_mail] invio stato prove_id=%s sent_by=%s to=%s cc=%s allegati=%s",
        prove_id,
        sent_by,
        ",".join(merged_to) if merged_to else "-",
        ",".join(merged_cc) if merged_cc else "-",
        ",".join(attachment_names) if attachment_names else "-",
    )
    ok, err = send_notification_email(
        merged_to,
        subject,
        body,
        attachments=attachments,
        cc_emails=merged_cc,
        reply_to=sent_by or None,
    )
    smtp_status = "SENT" if ok else f"ERROR: {err}"
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prove_emails_log (prove_id, subject, to_emails, cc_emails, attachments, smtp_status, sent_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    str(prove_id),
                    subject,
                    ",".join(merged_to),
                    ",".join(merged_cc),
                    ",".join(attachment_names),
                    smtp_status,
                    sent_by,
                ),
            )
        conn.commit()
    return ok, err


def _get_prova_or_404(prove_id):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM prove WHERE prove_id = %s", (str(prove_id),))
            row = cur.fetchone()
            if not row:
                abort(404)
            return row


def _load_esperti_options():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT user_email
                FROM user_roles
                WHERE role IN (%s, %s)
                ORDER BY user_email
                """,
                (ROLE_ESPERTO, ROLE_ADMIN),
            )
            return [r[0] for r in cur.fetchall()]


def _list_prove(mine_only=False):
    email = _user_email()
    q = (request.args.get("q") or "").strip().lower()
    stato = (request.args.get("stato") or "").strip()
    data_da = (request.args.get("data_da") or "").strip()
    data_a = (request.args.get("data_a") or "").strip()
    esperto_email = (request.args.get("esperto_email") or "").strip().lower()

    where = []
    params = []

    if mine_only:
        where.append("LOWER(p.esperto_email) = %s")
        params.append(email)

    if q:
        like = f"%{q}%"
        where.append("(LOWER(COALESCE(p.numero_bando,'')) LIKE %s OR LOWER(COALESCE(p.titolo,'')) LIKE %s OR LOWER(COALESCE(p.luogo,'')) LIKE %s)")
        params.extend([like, like, like])

    if stato:
        where.append("p.stato_corrente = %s")
        params.append(stato)

    if data_da:
        where.append("p.data_prova >= %s")
        params.append(data_da)

    if data_a:
        where.append("p.data_prova <= %s")
        params.append(data_a)

    if esperto_email:
        where.append("LOWER(p.esperto_email) = %s")
        params.append(esperto_email)

    sql = """
        SELECT p.*
        FROM prove p
    """
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY p.data_prova ASC NULLS LAST, p.ora_prova ASC NULLS LAST, p.created_at DESC"

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    for r in rows:
        days_left = giorni_alla_prova(r.get("data_prova"))
        r["days_left"] = days_left
        r["countdown_alert"] = False
        r["upload_deadline"] = None
        r["upload_deadline_days"] = None
        r["upload_deadline_alert"] = False
        r["upload_deadline_overdue"] = False

        # Scadenza operativa caricamento candidati: 6 giorni prima della prova.
        data_prova = r.get("data_prova")
        if data_prova:
            upload_deadline = data_prova - timedelta(days=6)
            r["upload_deadline"] = upload_deadline
            days_to_upload = (upload_deadline - date.today()).days
            r["upload_deadline_days"] = days_to_upload

            missing_lista = not r.get("data_lista_candidati_acquisita")
            if missing_lista:
                # Mostra alert a ridosso della scadenza o se già scaduta.
                if days_to_upload <= 10:
                    r["upload_deadline_alert"] = True
                    r["upload_deadline_overdue"] = days_to_upload < 0

    return rows


def _generate_excel_presenze_template(prove_id, generated_by):
    docs = _get_docs_by_types(prove_id, ["lista_convocati_moodle"])
    if not docs:
        raise ValueError("Carica prima un documento lista_convocati_moodle.")

    source = docs[0]
    source_path = _doc_abs_path(prove_id, source["filename"])
    if not os.path.exists(source_path):
        raise ValueError("Il file lista_convocati_moodle non esiste sul server.")

    delimiter = ";"
    with open(source_path, "r", encoding="utf-8-sig", newline="") as f:
        sample = f.read(2048)
        if sample.count(",") > sample.count(";"):
            delimiter = ","
    with open(source_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        rows = list(reader)

    wb = Workbook()
    ws = wb.active
    ws.title = "Presenze"
    ws.append(["username", "firstname", "lastname", "email", "presente", "assente", "note"])
    for r in rows:
        ws.append([
            (r.get("username") or "").strip(),
            (r.get("firstname") or "").strip(),
            (r.get("lastname") or "").strip(),
            (r.get("email") or "").strip(),
            "",
            "",
            "",
        ])

    stem = os.path.splitext(source["filename"])[0]
    generated_name = f"{stem}_presenze_template.xlsx"
    tmp_path = os.path.join(_prove_doc_dir(prove_id), generated_name)
    wb.save(tmp_path)

    class _LocalFile:
        def __init__(self, path, filename):
            self.path = path
            self.filename = filename

        def save(self, target):
            with open(self.path, "rb") as src, open(target, "wb") as dst:
                dst.write(src.read())

    local_file = _LocalFile(tmp_path, generated_name)
    saved = _save_document(prove_id, "excel_presenze_template", local_file, "Generato automaticamente da lista_convocati_moodle", generated_by)
    try:
        os.remove(tmp_path)
    except OSError:
        pass
    return saved


def _import_global_template_to_prova(prove_id, template_row, uploaded_by):
    source_path = os.path.join(_prove_global_templates_dir(), template_row["filename"])
    if not os.path.exists(source_path):
        raise ValueError("File template globale non trovato sul server.")

    class _LocalFile:
        def __init__(self, path, filename):
            self.path = path
            self.filename = filename

        def save(self, target):
            with open(self.path, "rb") as src, open(target, "wb") as dst:
                dst.write(src.read())

    local_file = _LocalFile(source_path, template_row["filename"])
    note = f"Importato da deposito template globale (id={template_row['id']})"
    return _save_document(prove_id, template_row["doc_type"], local_file, note, uploaded_by)


@prove_bp.route("/prove/tutti")
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_tutti():
    rows = _list_prove(mine_only=False)
    return render_template(
        "prove/lista.html",
        prove_rows=rows,
        view_mode="tutti",
        states=PROVE_STATES,
        state_labels=STATE_LABELS,
        is_admin=_is_admin(_user_email()),
        global_templates=_list_global_templates(),
        template_categoria_options=TEMPLATE_CATEGORIA_OPTIONS,
    )


@prove_bp.route("/prove/miei")
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_miei():
    rows = _list_prove(mine_only=True)
    return render_template(
        "prove/lista.html",
        prove_rows=rows,
        view_mode="miei",
        states=PROVE_STATES,
        state_labels=STATE_LABELS,
        is_admin=_is_admin(_user_email()),
        global_templates=[],
        template_categoria_options=TEMPLATE_CATEGORIA_OPTIONS,
    )


@prove_bp.route("/prove/admin/backup/export", methods=["GET"])
@login_required
@roles_required_any([ROLE_ADMIN])
def prove_backup_export():
    payload = _dump_backup_payload()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"prove_backup_{ts}.zip"

    mem_zip = io.BytesIO()
    with zipfile.ZipFile(mem_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "db.json",
            json.dumps(payload, ensure_ascii=False, indent=2, default=_json_default_serializer),
        )
        prove_files_dir = os.path.join(_base_files_dir(), "prove")
        if os.path.exists(prove_files_dir):
            for root, _, files in os.walk(prove_files_dir):
                for fn in files:
                    abs_path = os.path.join(root, fn)
                    rel_path = os.path.relpath(abs_path, _base_files_dir())
                    zf.write(abs_path, arcname=os.path.join("files", rel_path))
    mem_zip.seek(0)
    return send_file(
        mem_zip,
        mimetype="application/zip",
        as_attachment=True,
        download_name=backup_name,
    )


@prove_bp.route("/prove/admin/backup/import", methods=["POST"])
@login_required
@roles_required_any([ROLE_ADMIN])
def prove_backup_import():
    file_obj = request.files.get("backup_file")
    if not file_obj or not file_obj.filename:
        return redirect(url_for("prove.prove_tutti", err="Seleziona un file backup .zip"))

    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = os.path.join(tmpdir, "backup.zip")
        file_obj.save(zip_path)
        extract_dir = os.path.join(tmpdir, "extract")
        os.makedirs(extract_dir, exist_ok=True)
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(extract_dir)
        except Exception as e:
            return redirect(url_for("prove.prove_tutti", err=f"Backup non valido: {e}"))

        db_json_path = os.path.join(extract_dir, "db.json")
        if not os.path.exists(db_json_path):
            return redirect(url_for("prove.prove_tutti", err="Backup incompleto: manca db.json"))

        try:
            with open(db_json_path, "r", encoding="utf-8") as f:
                payload = json.load(f)
        except Exception as e:
            return redirect(url_for("prove.prove_tutti", err=f"Impossibile leggere db.json: {e}"))

        tables = (payload or {}).get("tables") or {}
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        TRUNCATE TABLE
                          prove_support_staff,
                          prove_documents,
                          prove_state_log,
                          prove_external_tokens,
                          prove_emails_log,
                          prove_global_templates,
                          prove
                        RESTART IDENTITY CASCADE
                        """
                    )

                    # Ordine di restore: tabella root prima, poi dipendenze.
                    _insert_rows(cur, "prove", tables.get("prove", []))
                    _insert_rows(cur, "prove_documents", tables.get("prove_documents", []))
                    _insert_rows(cur, "prove_state_log", tables.get("prove_state_log", []))
                    _insert_rows(cur, "prove_external_tokens", tables.get("prove_external_tokens", []))
                    _insert_rows(cur, "prove_emails_log", tables.get("prove_emails_log", []))
                    _insert_rows(cur, "prove_global_templates", tables.get("prove_global_templates", []))
                    _insert_rows(cur, "prove_support_staff", tables.get("prove_support_staff", []))

                    # Allinea sequenze seriali.
                    for t in ("prove_documents", "prove_state_log", "prove_emails_log", "prove_global_templates", "prove_support_staff"):
                        _reset_serial_sequence(cur, t, "id")
                conn.commit()
        except Exception as e:
            return redirect(url_for("prove.prove_tutti", err=f"Restore DB fallito: {e}"))

        source_files_dir = os.path.join(extract_dir, "files", "prove")
        target_files_dir = os.path.join(_base_files_dir(), "prove")
        try:
            if os.path.exists(target_files_dir):
                shutil.rmtree(target_files_dir, ignore_errors=True)
            if os.path.exists(source_files_dir):
                shutil.copytree(source_files_dir, target_files_dir)
            else:
                os.makedirs(target_files_dir, exist_ok=True)
        except Exception as e:
            return redirect(url_for("prove.prove_tutti", err=f"Restore file fallito: {e}"))

    return redirect(url_for("prove.prove_tutti", ok="Backup importato con successo"))


@prove_bp.route("/prove/template-globali/upload", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_global_template_upload():
    doc_type = (request.form.get("doc_type") or "").strip()
    template_categoria = (request.form.get("template_categoria") or "").strip()
    note = (request.form.get("note") or "").strip() or None
    file_obj = request.files.get("file")
    if doc_type not in GLOBAL_TEMPLATE_DOC_TYPES_ALLOWED:
        return redirect(url_for("prove.prove_tutti", err="Nel deposito globale puoi caricare solo template buste A/B/C."))
    if template_categoria not in TEMPLATE_CATEGORIA_OPTIONS:
        return redirect(url_for("prove.prove_tutti", err="Categoria template non valida. Usa risposta_multipla o risposta_aperta."))
    try:
        _save_global_template(doc_type, template_categoria, file_obj, note, _user_email())
    except Exception as e:
        return redirect(url_for("prove.prove_tutti", err=str(e)))
    return redirect(url_for("prove.prove_tutti", ok="Template globale caricato"))


@prove_bp.route("/prove/template-globali/<int:template_id>/download")
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_global_template_download(template_id):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, doc_type, template_categoria, filename, created_at
                FROM prove_global_templates
                WHERE id = %s
                LIMIT 1
                """,
                (template_id,),
            )
            row = cur.fetchone()
    if not row:
        abort(404)
    abs_path = os.path.join(_prove_global_templates_dir(), row["filename"])
    if not os.path.exists(abs_path):
        abort(404)
    ext = Path(row["filename"]).suffix
    doc_type = _safe_filename_part(row.get("doc_type") or "template_globale")
    created_at = row.get("created_at") or datetime.now()
    mese = MONTHS_IT.get(created_at.month, str(created_at.month))
    data_it = f"{created_at.day:02d} {mese} {created_at.year}"
    download_name = f"Template globale - {doc_type} - {data_it}{ext}"
    return send_file(abs_path, as_attachment=True, download_name=download_name)


@prove_bp.route("/prove/<prove_id>/template-globali/<int:template_id>/import", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_import_global_template(prove_id, template_id):
    email = _user_email()
    is_admin = _is_admin(email)
    prova = _get_prova_or_404(prove_id)
    if not _can_edit(prova, email, is_admin):
        abort(403)
    section = (request.form.get("section") or "documenti").strip() or "documenti"
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, doc_type, template_categoria, filename, version, note, uploaded_by, created_at
                FROM prove_global_templates
                WHERE id = %s
                LIMIT 1
                """,
                (template_id,),
            )
            template_row = cur.fetchone()
    if not template_row:
        return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section=section, err="Template globale non trovato"))
    if template_row.get("doc_type") not in GLOBAL_TEMPLATE_DOC_TYPES_ALLOWED:
        return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section=section, err="Template globale non importabile nel concorso."))
    try:
        _import_global_template_to_prova(str(prove_id), template_row, email)
    except Exception as e:
        return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section=section, err=str(e)))
    return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section=section))


@prove_bp.route("/prove/nuova", methods=["GET"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_nuova_get():
    email = _user_email()
    is_admin = _is_admin(email)
    return render_template(
        "prove/nuova.html",
        user_email=email,
        is_admin=is_admin,
        esperti_options=_load_esperti_options(),
    )


@prove_bp.route("/prove/nuova", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_nuova_post():
    email = _user_email()
    is_admin = _is_admin(email)

    esperto_email_raw = (request.form.get("esperto_email") or "").strip().lower()
    if is_admin:
        esperto_email = esperto_email_raw
    else:
        # Non-admin: può assegnare solo sé stesso o lasciare non assegnato.
        if esperto_email_raw and esperto_email_raw != email:
            return redirect(url_for("prove.prove_nuova_get", err="Puoi assegnare solo te stesso come esperto informatico."))
        esperto_email = esperto_email_raw

    prove_id = str(uuid.uuid4())
    fields = {
        "prove_id": prove_id,
        "numero_bando": (request.form.get("numero_bando") or "").strip() or None,
        "titolo": (request.form.get("titolo") or "").strip() or None,
        "data_prova": (request.form.get("data_prova") or "").strip() or None,
        "ora_prova": (request.form.get("ora_prova") or "").strip() or None,
        "data_convocazione_test_piattaforma": (request.form.get("data_convocazione_test_piattaforma") or "").strip() or None,
        "luogo": (request.form.get("luogo") or "").strip() or None,
        "tipologia_prova_esame": (request.form.get("tipologia_prova_esame") or "").strip() or None,
        "note_tipologia_prova": (request.form.get("note_tipologia_prova") or "").strip() or None,
        "esperto_email": esperto_email or "",
        "referente_nome": (request.form.get("referente_nome") or "").strip() or None,
        "referente_email": (request.form.get("referente_email") or "").strip() or None,
        "segretario_nome": (request.form.get("segretario_nome") or "").strip() or None,
        "segretario_email": (request.form.get("segretario_email") or "").strip() or None,
        "segretario_telefono": (request.form.get("segretario_telefono") or "").strip() or None,
        "informatico_sede_telefono": (request.form.get("informatico_sede_telefono") or "").strip() or None,
        "candidati_tempo_aggiuntivo": (request.form.get("candidati_tempo_aggiuntivo") or "").strip() or None,
        "candidati_tempo_aggiuntivo_nomi": (request.form.get("candidati_tempo_aggiuntivo_nomi") or "").strip() or None,
        "stato_corrente": "bozza",
        "created_by": email,
    }

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prove (
                    prove_id, numero_bando, titolo, data_prova, ora_prova, luogo,
                    data_convocazione_test_piattaforma,
                    tipologia_prova_esame, note_tipologia_prova,
                    esperto_email, referente_nome, referente_email, segretario_nome,
                    segretario_email, segretario_telefono, informatico_sede_telefono, candidati_tempo_aggiuntivo, candidati_tempo_aggiuntivo_nomi, stato_corrente, created_by
                )
                VALUES (%(prove_id)s, %(numero_bando)s, %(titolo)s, %(data_prova)s, %(ora_prova)s, %(luogo)s,
                        %(data_convocazione_test_piattaforma)s,
                        %(tipologia_prova_esame)s, %(note_tipologia_prova)s,
                        %(esperto_email)s, %(referente_nome)s, %(referente_email)s, %(segretario_nome)s,
                        %(segretario_email)s, %(segretario_telefono)s, %(informatico_sede_telefono)s, %(candidati_tempo_aggiuntivo)s, %(candidati_tempo_aggiuntivo_nomi)s, %(stato_corrente)s, %(created_by)s)
                """,
                fields,
            )
        conn.commit()

    if not is_admin and not (esperto_email or "").strip():
        return redirect(url_for("prove.prove_tutti", ok="Concorso creato senza esperto assegnato: il dettaglio sarà visibile quando verrà assegnato un esperto o da admin."))
    return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="workflow"))


@prove_bp.route("/prove/<prove_id>")
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_dettaglio(prove_id):
    email = _user_email()
    is_admin = _is_admin(email)
    prova = _get_prova_or_404(prove_id)
    if not _can_view_prova(prova, email, is_admin):
        abort(403)
    can_edit = _can_edit(prova, email, is_admin)
    can_view_docs = _can_view_sensitive_docs(prova, email, is_admin)
    active_section = (request.args.get("section") or "dati")
    if active_section in ("documenti", "buste") and not can_view_docs:
        abort(403)

    next_state = next_state_for(prova.get("stato_corrente"))
    next_action = None
    for action_name, to_state in ACTION_TO_STATE.items():
        if to_state == next_state:
            next_action = action_name
            break
    codice_bando = (prova.get("numero_bando") or "").strip()
    selezioni_url = None
    if codice_bando:
        selezioni_url = f"https://selezionionline.cnr.it/jconon/search-call?filters-codice={quote_plus(codice_bando)}"
    esami_url = "https://esami.concorsi.cnr.it/"
    state_doc_types = _state_doc_types(prova.get("stato_corrente"))
    state_docs = _get_docs_by_types(prove_id, state_doc_types) if _can_view_sensitive_docs(prova, email, is_admin) else []
    busta_choice = (prova.get("busta_estratta_codice") or "").strip().upper()
    default_to = prova.get("segretario_email") or prova.get("referente_email") or ""
    default_cc = _user_email()

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            docs = []
            docs_inviati = []
            docs_ricevuti = []
            docs_altro = []
            buste_vuote = []
            buste_ricevute = []
            if can_view_docs:
                cur.execute(
                    """
                    SELECT id, doc_type, filename, version, note, uploaded_by, created_at
                    FROM prove_documents
                    WHERE prove_id = %s
                    ORDER BY created_at DESC, id DESC
                    """,
                    (str(prove_id),),
                )
                docs = cur.fetchall()
                docs_inviati, docs_ricevuti, docs_altro = _split_docs(docs)
                buste_vuote = [d for d in docs if d.get("doc_type") in ("template_busta_a_vuota", "template_busta_b_vuota", "template_busta_c_vuota", "template_buste_esame")]
                buste_ricevute = [d for d in docs if d.get("doc_type") in ("busta_a_ricevuta", "busta_b_ricevuta", "busta_c_ricevuta")]

            cur.execute(
                """
                SELECT id, from_state, to_state, timestamp, utente, payload_json
                FROM prove_state_log
                WHERE prove_id = %s
                ORDER BY timestamp DESC, id DESC
                """,
                (str(prove_id),),
            )
            state_log = cur.fetchall()

            cur.execute(
                """
                SELECT id, subject, to_emails, cc_emails, attachments, smtp_status, sent_at, sent_by
                FROM prove_emails_log
                WHERE prove_id = %s
                ORDER BY sent_at DESC, id DESC
                """,
                (str(prove_id),),
            )
            email_log = cur.fetchall()

            cur.execute(
                """
                SELECT token, expires_at, used_at, created_at
                FROM prove_external_tokens
                WHERE prove_id = %s AND scope = 'COMPILA_DETTAGLI'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (str(prove_id),),
            )
            latest_form_token = cur.fetchone()

            cur.execute(
                """
                SELECT id, nome, email, created_at
                FROM prove_support_staff
                WHERE prove_id = %s
                ORDER BY created_at ASC, id ASC
                """,
                (str(prove_id),),
            )
            support_staff_rows = cur.fetchall()

            global_templates = []
            if can_view_docs:
                cur.execute(
                    """
                    SELECT id, doc_type, template_categoria, filename, version, note, uploaded_by, created_at
                    FROM prove_global_templates
                    ORDER BY doc_type ASC, version DESC, created_at DESC
                    """
                )
                global_templates = cur.fetchall()

            global_templates_multipla = [t for t in global_templates if t.get("template_categoria") == "risposta_multipla"]
            global_templates_aperta = [t for t in global_templates if t.get("template_categoria") == "risposta_aperta"]

            global_templates_buste = [
                t for t in global_templates
                if t.get("doc_type") in ("template_busta_a_vuota", "template_busta_b_vuota", "template_busta_c_vuota")
            ]

    return render_template(
        "prove/dettaglio.html",
        prova=prova,
        can_edit=can_edit,
        is_admin=is_admin,
        docs=docs,
        docs_inviati=docs_inviati,
        docs_ricevuti=docs_ricevuti,
        docs_altro=docs_altro,
        buste_vuote=buste_vuote,
        buste_ricevute=buste_ricevute,
        state_log=state_log,
        email_log=email_log,
        support_staff_rows=support_staff_rows,
        global_templates=global_templates,
        global_templates_multipla=global_templates_multipla,
        global_templates_aperta=global_templates_aperta,
        global_templates_buste=global_templates_buste,
        tipologia_prova_options=TIPOLOGIA_PROVA_OPTIONS,
        states=PROVE_STATES,
        state_labels=STATE_LABELS,
        action_to_state=ACTION_TO_STATE,
        active_section=active_section,
        can_view_docs=can_view_docs,
        next_state=next_state,
        next_action=next_action,
        state_hints=STATE_HINTS,
        state_docs=state_docs,
        busta_choice=busta_choice,
        selezioni_url=selezioni_url,
        esami_url=esami_url,
        default_to=default_to,
        default_cc=default_cc,
        latest_form_token=latest_form_token,
        compile_form_link=(
            f"{(os.getenv('APP_PUBLIC_URL') or request.url_root.rstrip('/'))}/prove/compila/{latest_form_token['token']}"
            if latest_form_token else None
        ),
        esperti_options=_load_esperti_options(),
    )


@prove_bp.route("/prove/<prove_id>/update", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_update(prove_id):
    email = _user_email()
    is_admin = _is_admin(email)
    prova = _get_prova_or_404(prove_id)

    if not _can_edit(prova, email, is_admin):
        abort(403)

    current_assigned = (prova.get("esperto_email") or "").strip().lower()
    requested_assigned = (request.form.get("esperto_email") or "").strip().lower()
    if is_admin:
        esperto_email = requested_assigned
    else:
        # Non-admin non può cambiare l'assegnazione se già presente.
        # Se non c'è assegnazione, può lasciare vuoto o assegnare solo sé stesso.
        if current_assigned:
            esperto_email = current_assigned
        else:
            if requested_assigned and requested_assigned != email:
                return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="dati", err="Puoi assegnare solo te stesso come esperto informatico."))
            esperto_email = requested_assigned

    update_values = {
        "numero_bando": (request.form.get("numero_bando") or "").strip() or None,
        "titolo": (request.form.get("titolo") or "").strip() or None,
        "data_prova": (request.form.get("data_prova") or "").strip() or None,
        "ora_prova": (request.form.get("ora_prova") or "").strip() or None,
        "data_convocazione_test_piattaforma": (request.form.get("data_convocazione_test_piattaforma") or "").strip() or None,
        "luogo": (request.form.get("luogo") or "").strip() or None,
        "tipologia_prova_esame": (request.form.get("tipologia_prova_esame") or "").strip() or None,
        "note_tipologia_prova": (request.form.get("note_tipologia_prova") or "").strip() or None,
        "esperto_email": esperto_email or "",
        "referente_nome": (request.form.get("referente_nome") or "").strip() or None,
        "referente_email": (request.form.get("referente_email") or "").strip() or None,
        "segretario_nome": (request.form.get("segretario_nome") or "").strip() or None,
        "segretario_email": (request.form.get("segretario_email") or "").strip() or None,
        "segretario_telefono": (request.form.get("segretario_telefono") or "").strip() or None,
        "informatico_sede_nome": (request.form.get("informatico_sede_nome") or "").strip() or None,
        "informatico_sede_email": (request.form.get("informatico_sede_email") or "").strip() or None,
        "informatico_sede_telefono": (request.form.get("informatico_sede_telefono") or "").strip() or None,
        "num_partecipanti": (request.form.get("num_partecipanti") or "").strip() or None,
        "candidati_tempo_aggiuntivo": (request.form.get("candidati_tempo_aggiuntivo") or "").strip() or None,
        "candidati_tempo_aggiuntivo_nomi": (request.form.get("candidati_tempo_aggiuntivo_nomi") or "").strip() or None,
        "num_presenti": (request.form.get("num_presenti") or "").strip() or None,
        "data_valutazione_prova": (request.form.get("data_valutazione_prova") or "").strip() or None,
        "provvedimento_nomina_numero": (request.form.get("provvedimento_nomina_numero") or "").strip() or None,
        "durata_minuti": (request.form.get("durata_minuti") or "").strip() or None,
        "updated_by": email,
        "prove_id": str(prove_id),
    }

    support_nomi = request.form.getlist("support_nome[]")
    support_emails = request.form.getlist("support_email[]")
    support_pairs = []
    max_len = max(len(support_nomi), len(support_emails)) if (support_nomi or support_emails) else 0
    for i in range(max_len):
        nome = (support_nomi[i] if i < len(support_nomi) else "").strip()
        email_val = (support_emails[i] if i < len(support_emails) else "").strip()
        if nome or email_val:
            support_pairs.append((nome, email_val))

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE prove
                SET numero_bando = %(numero_bando)s,
                    titolo = %(titolo)s,
                    data_prova = %(data_prova)s,
                    ora_prova = %(ora_prova)s,
                    data_convocazione_test_piattaforma = %(data_convocazione_test_piattaforma)s,
                    luogo = %(luogo)s,
                    tipologia_prova_esame = %(tipologia_prova_esame)s,
                    note_tipologia_prova = %(note_tipologia_prova)s,
                    esperto_email = %(esperto_email)s,
                    referente_nome = %(referente_nome)s,
                    referente_email = %(referente_email)s,
                    segretario_nome = %(segretario_nome)s,
                    segretario_email = %(segretario_email)s,
                    segretario_telefono = %(segretario_telefono)s,
                    informatico_sede_nome = %(informatico_sede_nome)s,
                    informatico_sede_email = %(informatico_sede_email)s,
                    informatico_sede_telefono = %(informatico_sede_telefono)s,
                    num_partecipanti = %(num_partecipanti)s,
                    candidati_tempo_aggiuntivo = %(candidati_tempo_aggiuntivo)s,
                    candidati_tempo_aggiuntivo_nomi = %(candidati_tempo_aggiuntivo_nomi)s,
                    num_presenti = %(num_presenti)s,
                    data_valutazione_prova = %(data_valutazione_prova)s,
                    provvedimento_nomina_numero = %(provvedimento_nomina_numero)s,
                    durata_minuti = %(durata_minuti)s,
                    updated_at = NOW(),
                    updated_by = %(updated_by)s
                WHERE prove_id = %(prove_id)s
                """,
                update_values,
            )
            cur.execute("DELETE FROM prove_support_staff WHERE prove_id = %s", (str(prove_id),))
            for nome, email_val in support_pairs:
                if not nome:
                    continue
                cur.execute(
                    """
                    INSERT INTO prove_support_staff (prove_id, nome, email)
                    VALUES (%s, %s, %s)
                    """,
                    (str(prove_id), nome, email_val or None),
                )
        conn.commit()

    return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="dati"))


@prove_bp.route("/prove/<prove_id>/documenti/upload", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_document_upload(prove_id):
    email = _user_email()
    is_admin = _is_admin(email)
    prova = _get_prova_or_404(prove_id)

    if not _can_view_sensitive_docs(prova, email, is_admin):
        abort(403)

    doc_type = (request.form.get("doc_type") or "").strip()
    note = (request.form.get("note") or "").strip() or None
    file_obj = request.files.get("file")

    if not doc_type:
        return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="documenti"))

    _save_document(prove_id, doc_type, file_obj, note, email)
    return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="documenti"))


@prove_bp.route("/prove/<prove_id>/documenti/genera-excel-presenze", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_document_generate_excel(prove_id):
    email = _user_email()
    is_admin = _is_admin(email)
    prova = _get_prova_or_404(prove_id)
    if not _can_view_sensitive_docs(prova, email, is_admin):
        abort(403)
    try:
        _generate_excel_presenze_template(prove_id, email)
    except Exception as e:
        return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="documenti", err=str(e)))
    return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="documenti"))


@prove_bp.route("/prove/<prove_id>/documenti/<int:doc_id>/download", methods=["GET"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_document_download(prove_id, doc_id):
    prova = _get_prova_or_404(prove_id)
    email = _user_email()
    is_admin = _is_admin(email)
    if not _can_view_sensitive_docs(prova, email, is_admin):
        abort(403)
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, doc_type, filename, created_at
                FROM prove_documents
                WHERE id = %s AND prove_id = %s
                LIMIT 1
                """,
                (doc_id, str(prove_id)),
            )
            row = cur.fetchone()
    if not row:
        abort(404)
    abs_path = _doc_abs_path(prove_id, row["filename"])
    if not os.path.exists(abs_path):
        abort(404)
    ext = Path(row["filename"]).suffix
    bando = _safe_filename_part(prova.get("numero_bando") or "senza-bando")
    doc_type = _safe_filename_part(row.get("doc_type") or "documento")
    created_at = row.get("created_at") or datetime.now()
    mese = MONTHS_IT.get(created_at.month, str(created_at.month))
    data_it = f"{created_at.day:02d} {mese} {created_at.year}"
    download_name = f"{bando} - {doc_type} - {data_it}{ext}"
    return send_file(abs_path, as_attachment=True, download_name=download_name)


@prove_bp.route("/prove/<prove_id>/documenti/<int:doc_id>/delete", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_document_delete(prove_id, doc_id):
    email = _user_email()
    is_admin = _is_admin(email)
    prova = _get_prova_or_404(prove_id)
    if not _can_view_sensitive_docs(prova, email, is_admin):
        abort(403)

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, filename
                FROM prove_documents
                WHERE id = %s AND prove_id = %s
                LIMIT 1
                """,
                (doc_id, str(prove_id)),
            )
            row = cur.fetchone()
            if not row:
                abort(404)

            cur.execute("DELETE FROM prove_documents WHERE id = %s", (doc_id,))
        conn.commit()

    abs_path = _doc_abs_path(prove_id, row["filename"])
    try:
        if os.path.exists(abs_path):
            os.remove(abs_path)
    except OSError:
        pass

    return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="documenti"))


@prove_bp.route("/prove/<prove_id>/azione/<action>", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_azione(prove_id, action):
    email = _user_email()
    is_admin = _is_admin(email)
    prova = _get_prova_or_404(prove_id)

    if not _can_edit(prova, email, is_admin):
        abort(403)

    to_state = ACTION_TO_STATE.get(action)
    if not to_state:
        abort(400)
    expected_next = next_state_for(prova.get("stato_corrente"))
    if to_state != expected_next:
        return redirect(
            url_for(
                "prove.prove_dettaglio",
                prove_id=prove_id,
                section="workflow",
                err="Puoi eseguire solo il prossimo step previsto dal workflow.",
            )
        )

    payload = {"action": action}
    if request.form.get("busta_estratta_codice"):
        payload["busta_estratta_codice"] = (request.form.get("busta_estratta_codice") or "").strip().upper()
    if request.form.get("orario_inizio_prova"):
        payload["orario_inizio_prova"] = (request.form.get("orario_inizio_prova") or "").strip()
    if request.form.get("num_presenti"):
        payload["num_presenti"] = (request.form.get("num_presenti") or "").strip()
    if request.form.get("data_valutazione_prova"):
        payload["data_valutazione_prova"] = (request.form.get("data_valutazione_prova") or "").strip()

    try:
        transition_prova_state(str(prove_id), to_state, utente=email, is_admin=is_admin, payload=payload)
    except ProveStateError as e:
        return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="workflow", err=str(e)))

    # Trigger email richiesti
    mail_err = None
    try:
        if to_state == "template_moodle_inviati":
            ok, err = send_template_moodle_to_segreteria(str(prove_id), email)
            if not ok:
                mail_err = f"Invio automatico candidati su piattaforma esami non riuscito: {err}"
        elif to_state == "modelli_buste_inviati_al_segretario":
            ok, err = send_modelli_buste_to_segreteria(str(prove_id), email)
            if not ok:
                mail_err = f"Invio automatico modelli buste non riuscito: {err}"
        elif to_state == "excel_presenti_inviato":
            ok, err = send_excel_presenti_to_segreteria(str(prove_id), email)
            if not ok:
                mail_err = f"Invio automatico Excel presenti non riuscito: {err}"
    except Exception:
        current_app.logger.exception(
            "[prove_mail] errore inatteso durante invio automatico prove_id=%s to_state=%s user=%s",
            prove_id,
            to_state,
            email,
        )
        mail_err = "Invio automatico non riuscito per errore inatteso lato server (controllare i log)."

    return redirect(
        url_for(
            "prove.prove_dettaglio",
            prove_id=prove_id,
            section="workflow",
            err=mail_err if mail_err else None,
        )
    )


@prove_bp.route("/prove/<prove_id>/invio-link-compilazione", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_invio_link_compilazione(prove_id):
    email = _user_email()
    is_admin = _is_admin(email)
    prova = _get_prova_or_404(prove_id)

    if not _can_edit(prova, email, is_admin):
        abort(403)

    referente_email = (prova.get("referente_email") or "").strip()
    if not referente_email:
        return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="dati", err="Referente email mancante"))

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(days=7)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prove_external_tokens (token, prove_id, scope, expires_at, created_by)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (token, str(prove_id), "COMPILA_DETTAGLI", expires_at, email),
            )
        conn.commit()

    public_base = (os.getenv("APP_PUBLIC_URL") or request.url_root.rstrip("/"))
    link = f"{public_base}/prove/compila/{token}"

    subject = f"[Prove] Link compilazione dettagli - {prova.get('numero_bando') or prova.get('titolo') or prove_id}"
    body = (
        "Buongiorno,\n\n"
        "puoi completare i dettagli mancanti del concorso/prova tramite il seguente link:\n"
        f"{link}\n\n"
        "Il link scade tra 7 giorni.\n"
    )

    cc = []
    if prova.get("segretario_email"):
        cc.append(prova.get("segretario_email"))
    cc.append(email)
    recipients = list(dict.fromkeys([referente_email] + cc))
    ok, err = send_notification_email(
        [referente_email],
        subject,
        body,
        attachments=None,
        cc_emails=cc,
        reply_to=email or None,
    )
    if not ok and cc:
        # Fallback: se il referente viene rifiutato dal relay, invia almeno a CC operativi.
        ok_fallback, err_fallback = send_notification_email(
            cc,
            subject,
            body,
            attachments=None,
            reply_to=email or None,
        )
        if ok_fallback:
            ok = True
            err = f"Destinatario referente rifiutato dal relay; invio effettuato su CC operativi ({','.join(cc)})"
        else:
            err = f"{err} | fallback_cc: {err_fallback}"

    status = "SENT" if ok else f"ERROR: {err}"
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO prove_emails_log (prove_id, subject, to_emails, cc_emails, attachments, smtp_status, sent_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (str(prove_id), subject, referente_email, ",".join(cc), "", status, email),
            )
        conn.commit()

    if not ok:
        return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="dati", err=f"Invio fallito: {err}"))

    return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="dati", ok="Link compilazione inviato al referente"))


@prove_bp.route("/prove/<prove_id>/invia-email-stato", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def prove_invia_email_stato(prove_id):
    email = _user_email()
    is_admin = _is_admin(email)
    prova = _get_prova_or_404(prove_id)
    if not _can_edit(prova, email, is_admin):
        abort(403)

    to_emails = [x.strip() for x in (request.form.get("to_emails") or "").split(",") if x.strip()]
    cc_emails = [x.strip() for x in (request.form.get("cc_emails") or "").split(",") if x.strip()]
    subject = (request.form.get("subject") or "").strip() or f"[Prove] Stato {STATE_LABELS.get(prova.get('stato_corrente'), prova.get('stato_corrente'))}"
    body = (request.form.get("body") or "").strip() or "Invio automatico/operativo dal modulo Prove."
    doc_ids = [int(x) for x in request.form.getlist("doc_ids") if str(x).isdigit()]

    try:
        ok, err = _send_state_email(
            prove_id=prove_id,
            sent_by=email,
            to_emails=to_emails,
            cc_emails=cc_emails,
            subject=subject,
            body=body,
            doc_ids=doc_ids,
        )
    except Exception:
        current_app.logger.exception(
            "[prove_mail] errore inatteso in invia-email-stato prove_id=%s user=%s",
            prove_id,
            email,
        )
        return redirect(
            url_for(
                "prove.prove_dettaglio",
                prove_id=prove_id,
                section="workflow",
                err="Invio fallito per errore inatteso lato server (controllare i log).",
            )
        )
    if not ok:
        return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="workflow", err=f"Invio fallito: {err}"))
    return redirect(url_for("prove.prove_dettaglio", prove_id=prove_id, section="workflow"))


@prove_bp.route("/prove/compila/<token>", methods=["GET", "POST"])
@login_required
def prove_compila_token(token):
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT t.token, t.prove_id, t.scope, t.expires_at, t.used_at,
                       p.*
                FROM prove_external_tokens t
                JOIN prove p ON p.prove_id = t.prove_id
                WHERE t.token = %s
                """,
                (token,),
            )
            row = cur.fetchone()

    if not row or row.get("scope") != "COMPILA_DETTAGLI":
        return "Token non valido", 404

    if row.get("expires_at") and row["expires_at"] < datetime.now():
        return "Token scaduto", 410

    prova = dict(row)
    session_email = _user_email()
    is_admin = _is_admin(session_email)
    referente_email = (prova.get("referente_email") or "").strip().lower()
    if not is_admin:
        if not referente_email or session_email != referente_email:
            return (
                render_template(
                    "prove/compila_forbidden.html",
                    message="Non sei autorizzato per questo concorso: non sei un referente autorizzato.",
                ),
                403,
            )

    codice_bando = (prova.get("numero_bando") or "").strip()
    selezioni_url = None
    if codice_bando:
        selezioni_url = f"https://selezionionline.cnr.it/jconon/search-call?filters-codice={quote_plus(codice_bando)}"

    if request.method == "GET":
        return render_template(
            "prove/compila_token.html",
            prova=prova,
            token=token,
            selezioni_url=selezioni_url,
            session_email=session_email,
        )

    external_email = session_email

    fields_to_update = {}

    def maybe_set(col):
        current = prova.get(col)
        if current:
            return
        val = (request.form.get(col) or "").strip()
        if val:
            fields_to_update[col] = val

    maybe_set("informatico_sede_nome")
    maybe_set("informatico_sede_email")
    maybe_set("informatico_sede_telefono")
    maybe_set("segretario_telefono")
    maybe_set("data_prova")
    maybe_set("ora_prova")
    maybe_set("luogo")
    maybe_set("data_convocazione_test_piattaforma")
    maybe_set("num_partecipanti")
    maybe_set("candidati_tempo_aggiuntivo")
    maybe_set("candidati_tempo_aggiuntivo_nomi")
    maybe_set("provvedimento_nomina_numero")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if fields_to_update:
                set_parts = ["updated_at = NOW()", "updated_by = %s"]
                params = [f"external:{external_email}"]
                for col, val in fields_to_update.items():
                    set_parts.append(f"{col} = %s")
                    params.append(val)
                params.append(str(prova["prove_id"]))
                cur.execute(
                    f"UPDATE prove SET {', '.join(set_parts)} WHERE prove_id = %s",
                    tuple(params),
                )
            # Conferma esplicita compilazione referente.
            cur.execute(
                """
                UPDATE prove
                SET referente_dati_confermati = TRUE,
                    referente_dati_confermati_at = NOW(),
                    referente_dati_confermati_by = %s,
                    updated_at = NOW(),
                    updated_by = %s
                WHERE prove_id = %s
                """,
                (external_email, f"external:{external_email}", str(prova["prove_id"])),
            )

            file_excel = request.files.get("lista_partecipanti_excel")
            if file_excel and file_excel.filename:
                _save_document(prova["prove_id"], "lista_partecipanti_excel", file_excel, "upload esterno", f"external:{external_email}")

            file_moodle = request.files.get("lista_partecipanti_moodle")
            if file_moodle and file_moodle.filename:
                _save_document(prova["prove_id"], "lista_partecipanti_moodle", file_moodle, "upload esterno", f"external:{external_email}")

            cur.execute(
                """
                UPDATE prove_external_tokens
                SET used_at = NOW()
                WHERE token = %s
                """,
                (token,),
            )

        conn.commit()

    return render_template("prove/compila_ok.html", prove_id=prova["prove_id"])
