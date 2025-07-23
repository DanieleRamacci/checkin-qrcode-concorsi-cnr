import requests
import hashlib
from datetime import datetime
import os
from db import get_db_connection 
BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')


def get_sessioni_internamente(commission_id, access_token, user_email):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s AND user_email = %s
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    print(f"[DEBUG] Nessuna autorizzazione per commission_id={commission_id}")
                    return None

        api_url = f"{BASE_URL}/openapi/v1/call/exam-sessions/{commission_id}"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }

        response = requests.get(api_url, headers=headers)
        if response.status_code == 401:
            print("[DEBUG] Token scaduto")
            return None

        response.raise_for_status()
        sessioni_data = response.json()

        now = datetime.now().isoformat()
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                for session_string, candidati in sessioni_data.items():
                    try:
                        parts = session_string.split(' - ')
                        if len(parts) != 2:
                            continue

                        luogo = parts[0].strip()
                        giorno_str, ora_str = parts[1].strip().split(' ')
                        giorno = giorno_str.strip()
                        ora = ora_str.strip()
                        data_esame_iso = datetime.strptime(f"{giorno} {ora}", "%d/%m/%Y %H:%M").isoformat()

                        raw_key = f"{commission_id}::{session_string}"
                        session_id = hashlib.md5(raw_key.encode()).hexdigest()

                        cursor.execute("""
                            INSERT INTO sessioni (
                                session_id, commission_id, user_email, session_string,
                                nome, giorno, ora, luogo, data_esame,
                                attiva, candidati_importati, sync_user_email, data_sync
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (session_id) DO NOTHING
                        """, (
                            session_id, commission_id, user_email, session_string,
                            session_string, giorno, ora, luogo, data_esame_iso,
                            False, False, user_email, now
                        ))
                    except Exception as e:
                        print(f"[ERRORE PARSING] {session_string}: {e}")
                        continue

        return True

    except Exception as e:
        print(f"[ERRORE GENERICO get_sessioni] {e}")
        return None



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



