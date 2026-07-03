from flask import Blueprint, Flask, request, abort, jsonify, send_from_directory, session, redirect, url_for, render_template
import requests
import hashlib
import os
from datetime import datetime
from db import get_db_connection  # se hai una funzione centralizzata
from routes.auth import login_required  # è un decoratore deve essere importato 
import re

sessioni_bp = Blueprint('sessioni', __name__)

BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')

# --- PARSER ROBUSTO PER session_string ---
# Supporta:
#  1) "NOME - LUOGO - gg/mm/aaaa hh:mm"
#  2) "LUOGO - gg/mm/aaaa hh:mm"
_PATTERNS = [
    r"^(?P<nome>.+?)\s*-\s*(?P<luogo>.+?)\s*-\s*(?P<data>\d{2}/\d{2}/\d{4})\s+(?P<ora>\d{2}:\d{2})$",
    r"^(?P<luogo>.+?)\s*-\s*(?P<data>\d{2}/\d{2}/\d{4})\s+(?P<ora>\d{2}:\d{2})$",
]

def parse_session_string(s: str):
    s = (s or "").strip()
    for pat in _PATTERNS:
        m = re.match(pat, s)
        if m:
            d = m.groupdict()
            nome = (d.get("nome") or d.get("luogo") or s).strip()
            luogo = (d.get("luogo") or "").strip() or None
            giorno = d["data"].strip()
            ora = d["ora"].strip()
            dt = datetime.strptime(f"{giorno} {ora}", "%d/%m/%Y %H:%M")
            return {
                "nome": nome,
                "luogo": luogo,
                "giorno": giorno,
                "ora": ora,
                "data_esame": dt,   # datetime Python (verrà serializzato correttamente da psycopg2)
            }
    raise ValueError("Formato session_string non valido")


@sessioni_bp.route('/get-sessioni/<commission_id>')
@login_required
def get_sessioni(commission_id):
    access_token = session.get('access_token')
    user_email = session.get('user_email')

    print(f"[DEBUG] Richiesta per commission_id={commission_id}, user_email={user_email}")

    if not access_token or not user_email:
        print("[DEBUG] Token o email mancanti")
        return jsonify({"success": False, "message": "Autenticazione mancante"}), 401

    try:
        # Verifica autorizzazione commissione
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s AND user_email = %s
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    print(f"[DEBUG] Nessuna autorizzazione trovata per commission_id={commission_id}")
                    return jsonify({"success": False, "message": "Commissione non autorizzata"}), 403

        # Chiamata all’API per le sessioni
        api_url = f"{BASE_URL}/openapi/v1/call/exam-sessions/{commission_id}"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }
        response = requests.get(api_url, headers=headers)
        print(f"[DEBUG] Status code API: {response.status_code}")
        print(f"[DEBUG] Body API: {response.text}")
        response.raise_for_status()

        sessioni_data = response.json()
        print(f"[DEBUG] Sessioni trovate: {list(sessioni_data.keys())}")

        result = []
        now = datetime.now()

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                for session_string, candidati in sessioni_data.items():
                    print(f"[DEBUG] Parsing session_string: {session_string}")
                    try:
                
                        p = parse_session_string(session_string)

                        raw_key = f"{commission_id}::{session_string}"
                        session_id = hashlib.md5(raw_key.encode()).hexdigest()

                        cursor.execute("""
                            INSERT INTO sessioni (
                                session_id, commission_id, user_email, session_string,
                                nome, giorno, ora, luogo, data_esame,
                                attiva, candidati_importati, sync_user_email, data_sync
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (session_id) DO NOTHING
                        """, (
                            session_id,
                            commission_id,
                            user_email,
                            session_string,
                            p["nome"],
                            p["giorno"],
                            p["ora"],
                            p["luogo"],
                            p["data_esame"],   
                            False,             
                            False,            
                            user_email,
                            now                
                        ))



                        print(f"[DEBUG] Sessione inserita: {session_id}")

                        result.append({
                            "session_id": session_id,
                            "session_string": session_string,
                            "luogo": p["luogo"],
                            "giorno": p["giorno"],
                            "ora": p["ora"]
                        })


                    except Exception as e:
                        print(f"[ERRORE PARSING] session_string: {session_string} -> {e}")
                        continue

        print(f"[DEBUG] Totale sessioni restituite: {len(result)}")

        return jsonify({
            "success": True,
            "commission_id": commission_id,
            "sessioni": result
        })

    except requests.exceptions.HTTPError as http_err:
        print(f"[ERRORE HTTP] {response.status_code}: {response.text}")
        return jsonify({
            "success": False,
            "error": "HTTP error",
            "status_code": response.status_code,
            "body": response.text
        }), response.status_code

    except Exception as e:
        print(f"[ERRORE GENERICO] {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@sessioni_bp.route('/sessione/<session_id>', methods=['GET'])
@login_required
def get_session(session_id):
    try:
        user_email = session.get('user_email')

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # check autorizzazione (utente deve essere nella commissions della stessa commissione)
                cursor.execute("""
                    SELECT 1
                    FROM sessioni s
                    JOIN commissions c ON c.commission_id = s.commission_id
                    WHERE s.session_id = %s
                      AND c.user_email  = %s
                """, (session_id, user_email))
                if not cursor.fetchone():
                    return jsonify(success=False, message="Utente non autorizzato per questa sessione."), 403

                # ↓ lettura dettagli come già facevi
                cursor.execute("""
                    SELECT nome, giorno, ora, luogo, attiva
                    FROM sessioni WHERE session_id = %s
                """, (session_id,))
                session_row = cursor.fetchone()

                if not session_row:
                    return jsonify(success=False, message="Sessione non trovata."), 404

                cursor.execute("""
                    SELECT uid, first_name, last_name, document_number, checkin_effettuato 
                    FROM candidati WHERE session_id = %s
                """, (session_id,))
                candidati = cursor.fetchall()
                lista_candidati = [
                    {
                        "id": c[0],
                        "nome": c[1],
                        "cognome": c[2],
                        "numero_documento": c[3],
                        "checkin_effettuato": bool(c[4])
                    } for c in candidati
                ]

                return jsonify(success=True, session={
                    "session_id": session_id,
                    "nome_sessione": session_row[0],
                    "giorno": session_row[1],
                    "ora": session_row[2],
                    "luogo": session_row[3],
                    "attiva": bool(session_row[4]),
                    "candidates": lista_candidati
                })
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@sessioni_bp.route("/session-check", methods=["GET"])
@login_required
def session_check():
    session_id = request.args.get("session_id")
    timestamp = request.args.get("timestamp")
    import os
    debug_mode = (
        request.args.get("debug", "false").lower() == "true"
        or os.getenv("APP_ENV", "production").lower() in ("development", "dev")
    )

    if not session_id or not timestamp:
        return jsonify(success=False, message="Parametri mancanti."), 400

    try:
        now = datetime.fromisoformat(timestamp.replace("Z", "")).replace(tzinfo=None)
    except ValueError:
        return jsonify(success=False, message="Timestamp non valido."), 400

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT giorno, ora, attiva 
                    FROM sessioni 
                    WHERE session_id = %s
                """, (session_id,))
                row = cursor.fetchone()

                if not row:
                    return jsonify(success=False, message="Sessione non trovata."), 404

                giorno, ora, attiva = row
                try:
                    session_datetime = datetime.strptime(f"{giorno}T{ora}", "%d/%m/%YT%H:%M")
                except ValueError:
                    return jsonify(success=False, message="Formato data/ora non valido."), 400

                if not debug_mode:
                    if not attiva:
                        return jsonify(success=False, message="Sessione non attiva."), 403
                    if now < session_datetime:
                        return jsonify(success=False, message="Sessione non ancora iniziata."), 403

                return jsonify(success=True, message="Sessione valida e attiva (debug abilitato)." if debug_mode else "Sessione valida e attiva.")
    except Exception as e:
        return jsonify(success=False, message=f"Errore server: {str(e)}"), 500
    
