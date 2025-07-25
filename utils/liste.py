import csv
from openpyxl import Workbook
from datetime import datetime
import os

from db import get_db_connection


def genera_liste_excel_csv(session_id, candidati, output_dir="files_liste"):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_filename = f"lista_{session_id}_{timestamp}"

    # XLSX
    xlsx_path = os.path.join(output_dir, f"{base_filename}.xlsx")
    wb = Workbook()
    ws = wb.active
    for c in candidati:
        ws.append([c["uid"], c["first_name"], c["last_name"],  c["document_number"], c["document_date"], c["fiscal_code"],"Presente"])

    wb.save(xlsx_path)

    # CSV per esperto
    csv_path = os.path.join(output_dir, f"{base_filename}.csv")
    with open(csv_path, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["uid"])  # oppure il campo richiesto dal sistema esperto
        for c in candidati:
            writer.writerow([c["uid"]])

    return {
        "file_xlsx": xlsx_path,
        "file_csv_moodle": csv_path,
        "num_presenti": len(candidati)
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
