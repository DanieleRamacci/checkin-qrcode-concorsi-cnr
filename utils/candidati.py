from db import get_db_connection  
from datetime import datetime
from urllib.parse import quote
import requests
import os
from utils.commissioni import now_iso_utc
BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')



def get_candidato_by_uid(uid, session_id):
    conn = get_db_connection()
    cursor = conn.execute(
        "SELECT nome, cognome, numero_documento, uid FROM candidati WHERE uid = %s AND sessione_id = %s",
        (uid, session_id)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None




import time
import logging
import requests
from urllib.parse import quote

log = logging.getLogger("importa_candidati")

def importa_candidati_da_api(session_id, user_email, access_token):
    t0 = time.monotonic()
    print(f"[importa] start session_id={session_id} user={user_email}", flush=True)
    try:
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
                    msg = "Sessione non trovata."
                    print(f"[importa] {msg}", flush=True)
                    return {"success": False, "message": msg}

                commission_id, session_string, candidati_importati = row
                print(f"[importa] commission_id={commission_id} candidati_importati={bool(candidati_importati)}", flush=True)

                if candidati_importati:
                    msg = "I candidati sono già stati importati per questa sessione."
                    print(f"[importa] {msg}", flush=True)
                    return {"success": False, "message": msg}

                # Verifica autorizzazione utente
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s AND user_email = %s
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    msg = "Commissione non autorizzata"
                    print(f"[importa] {msg}", flush=True)
                    return {"success": False, "message": msg}

                # Chiamata API
                encoded_session = quote(session_string, safe='')
                api_url = f"{BASE_URL}/openapi/v1/call/exam-sessions/{commission_id}?session={encoded_session}"
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json"
                }

                print(f"[importa] GET {api_url}", flush=True)
                t1 = time.monotonic()
                # timeout più generoso: (connect 5s, read 60s)
                res = requests.get(api_url, headers=headers, timeout=(5, 60))
                dt_api = (time.monotonic() - t1) * 1000
                print(f"[importa] API status={res.status_code} in {dt_api:.0f}ms", flush=True)

                if res.status_code != 200:
                    msg = f"Errore API Selezioni Online: {res.status_code}"
                    print(f"[importa] {msg} body={res.text[:300]}", flush=True)
                    return {"success": False, "message": msg}

                json_data = res.json()
                candidati = json_data.get(session_string)
                if not candidati:
                    msg = "Nessun candidato trovato."
                    print(f"[importa] {msg}", flush=True)
                    return {"success": False, "message": msg}

                print(f"[importa] candidati ricevuti: {len(candidati)}", flush=True)

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

                print(f"[importa] inseriti in DB: {inseriti}", flush=True)

                if inseriti == 0:
                    msg = "Nessun candidato è stato importato dal file JSON."
                    print(f"[importa] {msg}", flush=True)
                    return {"success": False, "message": msg}

                cursor.execute("""
                    UPDATE sessioni
                    SET candidati_importati = TRUE,
                        sync_user_email = %s,
                        data_sync = %s
                    WHERE session_id = %s
                """, (user_email, now_iso_utc(), session_id))


                conn.commit()
                total_ms = (time.monotonic() - t0) * 1000
                msg = f"{inseriti} candidati importati correttamente (tot {total_ms:.0f}ms)."
                print(f"[importa] OK: {msg}", flush=True)
                return {"success": True, "message": msg}

    except Exception as e:
        print(f"[importa] EXC: {e}", flush=True)
        return {"success": False, "message": str(e)}
