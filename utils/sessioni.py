import requests
import hashlib
from datetime import datetime
import os
from db import get_db_connection 
import hashlib
from routes.sessioni import parse_session_string  # riusa il parser già cretao 
from datetime import datetime

BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')


def get_sessioni_internamente(commission_id, access_token, user_email):
    try:
        # 1) Autorizzazione utente sulla commissione
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s AND user_email = %s
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    print(f"[DEBUG] Nessuna autorizzazione per commission_id={commission_id}")
                    return 0

        # 2) Chiamata API remota
        api_url = f"{BASE_URL}/openapi/v1/call/exam-sessions/{commission_id}"
        headers = {'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'}
        response = requests.get(api_url, headers=headers)
        if response.status_code == 401:
            print("[DEBUG] Token scaduto")
            return 0
        response.raise_for_status()
        sessioni_data = response.json()

        # 3) Inserimento in DB (parser robusto + tipi corretti)
        now = datetime.now()      # TIMESTAMP vero
        inserted = 0

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                for session_string, candidati in sessioni_data.items():
                    try:
                        p = parse_session_string(session_string)  # gestisce 3 pezzi o 2 pezzi
                        raw_key = f"{commission_id}::{session_string}"
                        session_id = hashlib.md5(raw_key.encode()).hexdigest()

                        cursor.execute("""
                            INSERT INTO sessioni (
                                session_id, commission_id, user_email, session_string,
                                nome, giorno, ora, luogo, data_esame,
                                attiva, candidati_importati, sync_user_email, data_sync
                            )
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                            ON CONFLICT (session_id) DO NOTHING
                        """, (
                            session_id, commission_id, user_email, session_string,
                            p["nome"], p["giorno"], p["ora"], p["luogo"], p["data_esame"],
                            False, False, user_email, now
                        ))
                        if cursor.rowcount > 0:
                            inserted += 1
                    except Exception as e:
                        print(f"[ERRORE PARSING] {session_string}: {e}")
                        continue

            conn.commit()  # visibilità immediata per la pagina

        return inserted

    except Exception as e:
        print(f"[ERRORE GENERICO get_sessioni] {e}")
        return 0


def get_sessioni_per_commissione(commission_id):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT session_id, nome, giorno, ora, luogo
                FROM sessioni
                WHERE commission_id = %s
            """, (commission_id,))
            rows = cursor.fetchall()

    return [{
        "session_id": row[0],
        "session_string": row[1],
        "giorno": row[2],
        "ora": row[3],
        "luogo": row[4]
    } for row in rows]


def importa_sessioni(sessioni):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            for sessione in sessioni:
                cursor.execute("""
                    INSERT INTO sessioni (
                        session_id, nome, giorno, ora, luogo, attiva
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (session_id) DO UPDATE SET
                        nome = EXCLUDED.nome,
                        giorno = EXCLUDED.giorno,
                        ora = EXCLUDED.ora,
                        luogo = EXCLUDED.luogo,
                        attiva = EXCLUDED.attiva
                """, (
                    sessione['id'],
                    sessione['nome'],
                    sessione['giorno'],
                    sessione['ora'],
                    sessione['luogo'],
                    sessione.get('attiva', 0)
                ))



def get_sessione_by_id(session_id):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT session_id, commission_id, nome, giorno, ora, luogo, attiva, candidati_importati, stato_corrente
                FROM sessioni
                WHERE session_id = %s
            """, (session_id,))
            row = cursor.fetchone()

            if not row:
                return None

            return {
                "session_id": row[0],
                "commission_id": row[1],
                "nome": row[2],
                "giorno": row[3],
                "ora": row[4],
                "luogo": row[5],
                "attiva": row[6],
                "candidati_importati": row[7],
                "stato_corrente": row[8],
            }
