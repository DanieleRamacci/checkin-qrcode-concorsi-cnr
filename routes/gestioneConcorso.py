from flask import Blueprint, render_template, request, session, redirect, url_for
from psycopg2.extras import RealDictCursor
from routes.auth import login_required
from db import get_db_connection 
from datetime import datetime, timezone


gestione_concorso_bp = Blueprint('gestione-concorso', __name__)



@gestione_concorso_bp.route('/gestione-concorso/<session_id>')
@login_required
def gestione_concorso(session_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Recupera i dati della sessione
                cursor.execute("""
                    SELECT nome, giorno, ora, luogo, attiva
                    FROM sessioni WHERE session_id = %s
                """, (session_id,))
                session_row = cursor.fetchone()

                if not session_row:
                    return render_template("gestione-concorso.html", messaggi=["Sessione non trovata."], sessione=None, candidati=[])

                # Recupera i candidati
                cursor.execute("""
                    SELECT uid, first_name, last_name, document_number, document_date, checkin_effettuato 
                    FROM candidati WHERE session_id = %s
                """, (session_id,))
                candidati_raw = cursor.fetchall()

        candidati = []
        for c in candidati_raw:
            candidati.append({
                "id": c[0],
                "nome": c[1],
                "cognome": c[2],
                "numero_documento": c[3],
                "document_date": c[4],
                "checkin_effettuato": bool(c[5]),
                "validita_documento": "valido" if is_document_valid(c[4]) else "scaduto"
            })

        sessione = {
            "session_id": session_id,
            "nome": session_row[0],
            "giorno": session_row[1],
            "ora": session_row[2],
            "luogo": session_row[3],
            "attiva": bool(session_row[4])
        }

        return render_template("gestione-concorso.html", sessione=sessione, candidati=candidati, messaggi=[])

    except Exception as e:
        import traceback
        traceback.print_exc()
        return render_template("gestione-concorso.html", messaggi=[str(e)], sessione=None, candidati=[])



def is_document_valid(document_date_str):
    try:
        print(f"[DEBUG] Data stringa ricevuta: {document_date_str}")
        # Usa il formato corretto: giorno/mese/anno
        document_date = datetime.strptime(document_date_str, "%d/%m/%Y")
        print(f"[DEBUG] Data convertita: {document_date.isoformat()}")
        print(f"[DEBUG] Data attuale: {datetime.now().isoformat()}")

        is_valid = document_date > datetime.now()
        print(f"[DEBUG] Documento valido? {is_valid}")
        return is_valid
    except Exception as e:
        print(f"[DEBUG] Errore durante il parsing della data: {e}")
        return False

