from db import get_db_connection  
from datetime import datetime
from urllib.parse import quote
import requests
import os
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




def importa_candidati_da_api(session_id, user_email, access_token):
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
                    return {"success": False, "message": "Sessione non trovata."}

                commission_id, session_string, candidati_importati = row

                if candidati_importati:
                    return {"success": False, "message": "I candidati sono già stati importati per questa sessione."}

                # Verifica autorizzazione utente
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s AND user_email = %s
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    return {"success": False, "message": "Commissione non autorizzata"}

                # Chiamata API
                encoded_session = quote(session_string, safe='')
                api_url = f"{BASE_URL}/openapi/v1/call/exam-sessions/{commission_id}?session={encoded_session}"
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "*/*"
                }

                res = requests.get(api_url, headers=headers)
                if res.status_code != 200:
                    return {"success": False, "message": f"Errore API Selezioni Online: {res.status_code}"}

                json_data = res.json()
                candidati = json_data.get(session_string)
                if not candidati:
                    return {"success": False, "message": "Nessun candidato trovato."}

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
                    return {"success": False, "message": "Nessun candidato è stato importato dal file JSON."}

                # Aggiorna stato sessione
                cursor.execute("""
                    UPDATE sessioni
                    SET candidati_importati = TRUE,
                        sync_user_email = %s,
                        data_sync = CURRENT_TIMESTAMP
                    WHERE session_id = %s
                """, (user_email, session_id))

                conn.commit()

                return {"success": True, "message": f"{inseriti} candidati importati correttamente."}

    except Exception as e:
        return {"success": False, "message": str(e)}
