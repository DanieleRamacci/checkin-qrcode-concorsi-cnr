from flask import Blueprint, Flask, request, abort, jsonify, send_from_directory, session, redirect, url_for, render_template
import requests
import os
from datetime import datetime
from db import get_db_connection  # se hai una funzione centralizzata
from routes.auth import login_required  # è un decoratore deve essere importato 
from urllib.parse import quote
from utils.candidati import importa_candidati_da_api 

BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')


candidati_bp = Blueprint('candidati', __name__)


@candidati_bp.route("/checkin-candidato", methods=["POST"])
def checkin_candidato():
    data = request.json
    uid = data.get("uid")
    session_id = data.get("session_id")

    if not uid or not session_id:
        return jsonify(success=False, message="Parametri mancanti."), 400

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 FROM candidati WHERE uid = %s AND session_id = %s", (uid, session_id))
                if not cursor.fetchone():
                    return jsonify(success=False, message="Candidato non trovato."), 404

                cursor.execute("""
                    UPDATE candidati
                    SET checkin_effettuato = TRUE
                    WHERE uid = %s AND session_id = %s
                """, (uid, session_id))
                conn.commit()

        return jsonify(success=True, message="Check-in registrato con successo.")
    except Exception as e:
        return jsonify(success=False, message=f"Errore server: {str(e)}"), 500


@candidati_bp.route("/verifica-candidato", methods=["POST"])
def verifica_candidato():
    data = request.json
    uid = data.get("uid")
    session_id = data.get("session_id")

    if not uid or not session_id:
        return jsonify(success=False, message="Parametri mancanti."), 400

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT first_name, last_name, document_number, checkin_effettuato
                    FROM candidati 
                    WHERE uid = %s AND session_id = %s
                """, (uid, session_id))
                candidato = cursor.fetchone()

                if not candidato:
                    return jsonify(success=False, message="Candidato non trovato o non appartiene alla sessione."), 404

                nome, cognome, numero_documento, checkin_effettuato = candidato

                if checkin_effettuato:
                    return jsonify(success=False, message="Candidato già registrato al check-in."), 409

                return jsonify(success=True, candidato={
                    "nome": nome,
                    "cognome": cognome,
                    "numero_documento": numero_documento,
                    "session_id": session_id
                })
    except Exception as e:
        return jsonify(success=False, message=f"Errore server: {str(e)}"), 500


@candidati_bp.route("/sessione/<session_id>/tabella_candidati", methods=["GET"])
@login_required
def frammento_tabella_candidati(session_id):
    from datetime import datetime

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT first_name, last_name, document_number, document_date, checkin_effettuato
                FROM candidati
                WHERE session_id = %s
            """, (session_id,))
            righe = cursor.fetchall()

    candidati = []
    oggi = datetime.now().date()

    for row in righe:
        first_name, last_name, document_number, document_date, checkin_effettuato = row
        try:
            data_doc = datetime.strptime(document_date, "%d/%m/%Y").date()
            validita_documento = 'valido' if data_doc >= oggi else 'scaduto'
        except Exception:
            print(f"[ERRORE DATA] Errore nel parsing di '{document_date}'")
            validita_documento = 'scaduto'  # fallback se data malformata

        candidati.append({
            "first_name": first_name,
            "last_name": last_name,
            "document_number": document_number,
            "checkin_effettuato": checkin_effettuato,
            "validita_documento": validita_documento,
        })

    return render_template("frammenti/tabella_candidati.html", candidati=candidati)



@candidati_bp.route('/get-candidati', methods=['GET'])
@login_required
def get_candidati():
    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify({"success": False, "message": "Missing session_id"}), 400

    try:
        access_token = session.get('access_token')
        user_email = session.get('user_email')

        if not access_token or not user_email:
            return jsonify({"success": False, "message": "Autenticazione mancante"}), 401

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Dati della sessione
                cursor.execute("""
                    SELECT commission_id, session_string, candidati_importati
                    FROM sessioni
                    WHERE session_id = %s
                """, (session_id,))
                row = cursor.fetchone()

                if not row:
                    return jsonify({"success": False, "message": "Sessione non trovata."}), 404

                commission_id, session_string, candidati_importati = row

                if candidati_importati:
                    return jsonify({"success": False, "message": "I candidati sono già stati importati per questa sessione."}), 400

                # Verifica autorizzazione utente
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s AND user_email = %s
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    return jsonify({"success": False, "message": "Commissione non autorizzata"}), 403

                # Chiamata API
                encoded_session = quote(session_string, safe='')
                api_url = f"{BASE_URL}/openapi/v1/call/exam-sessions/{commission_id}?session={encoded_session}"
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "*/*"
                }

                res = requests.get(api_url, headers=headers)
                if res.status_code != 200:
                    return jsonify({"success": False, "message": f"Errore chiamata API Selezioni Online: {res.status_code}"}), 502

                try:
                    json_data = res.json()
                except Exception as e:
                    return jsonify({"success": False, "message": "La risposta non è in formato JSON valido."}), 500

                candidati = json_data.get(session_string)
                if not candidati:
                    return jsonify({"success": False, "message": "Nessun candidato trovato nella sessione indicata."}), 404

                inseriti = 0
                for row in candidati:
                    if not row.get("uid"):
                        continue
                    cursor.execute("""
                        INSERT INTO candidati (
                            uid, session_id, first_name, last_name, birthdate,
                            fiscal_code, document_type, document_number,
                            document_date, document_issued_by
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (uid, session_id) DO NOTHING
                    """, (
                        row.get("uid"),
                        session_id,
                        row.get("firstName"),
                        row.get("lastName"),
                        row.get("birthdate"),
                        row.get("fiscalCode"),
                        row.get("documentType"),
                        row.get("documentNumber"),
                        row.get("documentDate"),
                        row.get("documentIssuedBy"),
                    ))
                    inseriti += cursor.rowcount

                if inseriti == 0:
                    return jsonify({"success": False, "message": "Nessun candidato è stato importato dal file JSON."}), 500

                # Aggiorna stato sessione
                cursor.execute("""
                    UPDATE sessioni
                    SET candidati_importati = TRUE,
                        sync_user_email = %s,
                        data_sync = CURRENT_TIMESTAMP
                    WHERE session_id = %s
                """, (user_email, session_id))

                conn.commit()

                return jsonify({
                    "success": True,
                    "message": f"{inseriti} candidati importati correttamente dal file JSON."
                })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500



