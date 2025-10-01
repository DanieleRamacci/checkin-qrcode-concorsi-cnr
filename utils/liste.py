from openpyxl import Workbook
from datetime import datetime
from flask import current_app
import csv, os

from db import get_db_connection





def genera_liste_excel_csv(session_id, candidati):
    base_dir = current_app.config.get("FILES_BASE_DIR") or os.path.join(current_app.root_path, "files_liste")
    os.makedirs(base_dir, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_filename = f"lista_{session_id}_{ts}"

    # nomi file (solo leaf)
    xlsx_name = f"{base_filename}.xlsx"
    csv_name  = f"{base_filename}.csv"

    # percorsi assoluti per scrivere su disco
    xlsx_path = os.path.join(base_dir, xlsx_name)
    csv_path  = os.path.join(base_dir, csv_name)

    # XLSX
    wb = Workbook()
    ws = wb.active
    ws.append(["uid","first_name","last_name","document_number","document_date","fiscal_code","stato"])
    for c in candidati:
        ws.append([
            c.get("uid"), c.get("first_name"), c.get("last_name"),
            c.get("document_number"), c.get("document_date"), c.get("fiscal_code"),
            "Presente"
        ])
    wb.save(xlsx_path)

    # CSV
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["uid"])
        for c in candidati:
            w.writerow([c.get("uid")])

    # RITORNA SOLO I NOMI (salvali così nel DB)
    return {
        "file_xlsx": xlsx_name,
        "file_csv_moodle": csv_name,
        "num_presenti": len(candidati),
    }


def get_ultima_lista_generata(session_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT file_xlsx, file_csv_moodle, num_presenti
        FROM liste_generate
        WHERE session_id = %s
        ORDER BY timestamp_creazione DESC
        LIMIT 1
    """, (session_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row:
        return {
            "file_xlsx": row[0],
            "file_csv_moodle": row[1],
            "num_presenti": row[2]
        }
    return None


def get_candidati_by_sessione_checkin(session_id):
    db = get_db_connection()

    query = """
        SELECT uid, first_name, last_name, fiscal_code, document_number,document_date, checkin_effettuato
        FROM candidati
        WHERE session_id = %s AND checkin_effettuato = TRUE
    """
    cur = db.cursor()
    cur.execute(query, (session_id,))
    risultati = cur.fetchall()
    colonne = [desc[0] for desc in cur.description]
    return [dict(zip(colonne, riga)) for riga in risultati]

def get_candidati_per_lista_completa(session_id):
    db = get_db_connection()
    query = """
        SELECT uid, first_name, last_name, fiscal_code, document_number,document_date, checkin_effettuato
        FROM candidati
        WHERE session_id = %s
    """
    cur = db.cursor()
    cur.execute(query, (session_id,))
    colonne = [desc[0] for desc in cur.description]
    return [dict(zip(colonne, riga)) for riga in cur.fetchall()]


def get_liste_generate(session_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, file_xlsx, file_csv_moodle, num_presenti, timestamp_creazione
        FROM liste_generate
        WHERE session_id = %s
        ORDER BY timestamp_creazione DESC
    """, (session_id,))
    rows = cur.fetchall()
    cur.close(); conn.close()

    return [
        {
            "id": r[0],
            "file_xlsx": r[1],
            "file_csv_moodle": r[2],
            "num_presenti": r[3],
            "timestamp_creazione": r[4],
        } for r in rows
    ]


def get_lista_by_id(session_id, lista_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, file_xlsx, file_csv_moodle, num_presenti, timestamp_creazione
        FROM liste_generate
        WHERE session_id = %s AND id = %s
        LIMIT 1
    """, (session_id, lista_id))
    row = cur.fetchone()
    cur.close(); conn.close()

    if not row:
        return None
    return {
        "id": row[0],
        "file_xlsx": row[1],
        "file_csv_moodle": row[2],
        "num_presenti": row[3],
        "timestamp_creazione": row[4],
    }


