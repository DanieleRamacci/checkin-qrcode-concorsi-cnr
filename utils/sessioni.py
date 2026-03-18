import requests
import hashlib
from datetime import datetime, timezone
import os
from db import get_db_connection 
import hashlib
from routes.sessioni import parse_session_string  # riusa il parser già cretao 
from datetime import datetime
from flask import current_app
import time

BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')

def get_sessioni_internamente(commission_id, access_token, user_email, timeout_s=(3.05, 20), retries: int = 1):
    """
    Sincronizza le sessioni di una commissione.
    Ritorna:
      - int >= 0 : numero di sessioni inserite (successo; anche 0)
      - "UNAUTHORIZED" : token scaduto/invalid (401)
      - -1 : errore (rete/HTTP/parsing/DB, utente non autorizzato, ecc.)
    Non solleva eccezioni.
    """
    try:
        # 1) Autorizzazione utente sulla commissione
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s AND user_email = %s
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    current_app.logger.debug("[sessioni] no auth commission_id=%s user=%s", commission_id, user_email)
                    return -1  # NON successo: evita di "sporcare" data_sync

        # 2) Chiamata API remota con timeout e retry leggero
        api_url = f"{BASE_URL}/openapi/v1/call/exam-sessions/{commission_id}"
        headers = {'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'}

        attempt = 0
        sessioni_data = None
        last_err = None

        while attempt <= retries:
            attempt += 1
            t0 = time.time()
            try:
                current_app.logger.debug("[sessioni] GET %s (try %d/%d)", api_url, attempt, retries + 1)
                resp = requests.get(api_url, headers=headers, timeout=timeout_s)
                dt = time.time() - t0
                current_app.logger.debug("[sessioni] -> %s in %.2fs", resp.status_code, dt)

                if resp.status_code == 401:
                    current_app.logger.warning("[sessioni] token scaduto o non valido (401)")
                    return "UNAUTHORIZED"

                resp.raise_for_status()
                sessioni_data = resp.json()
                break  # OK

            except (requests.Timeout, requests.ConnectionError) as e:
                last_err = e
                current_app.logger.warning("[sessioni] timeout/conn error %s try %d: %s", api_url, attempt, e)
                if attempt > retries:
                    return -1

            except requests.HTTPError as e:
                body_preview = e.response.text[:300] if e.response is not None else ""
                current_app.logger.error("[sessioni] HTTP %s: %s", getattr(e.response, 'status_code', '?'), body_preview)
                return -1  # errore non transitorio

            except Exception as e:
                last_err = e
                current_app.logger.exception("[sessioni] errore generico chiamata API: %s", e)
                return -1

        if sessioni_data is None:
            current_app.logger.warning("[sessioni] API non ha restituito dati: %s", last_err)
            return -1

        if not isinstance(sessioni_data, dict):
            current_app.logger.error("[sessioni] JSON inatteso (atteso dict), type=%s", type(sessioni_data).__name__)
            return -1

        # 3) Inserimento in DB (parser robusto + tipi corretti)
        now = datetime.now(timezone.utc)  # UTC coerente
        inserted = 0

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                for session_string, candidati in sessioni_data.items():
                    try:
                        p = parse_session_string(session_string)  # deve dare p["data_esame"]
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
                            p.get("nome"), p.get("giorno"), p.get("ora"), p.get("luogo"),
                            p.get("data_esame"),
                            False, False, user_email, now
                        ))

                        if cursor.rowcount > 0:
                            inserted += 1

                    except Exception as e:
                        current_app.logger.warning("[sessioni] PARSE FAIL '%s': %s", session_string, e)
                        continue

            conn.commit()

        current_app.logger.info("[sessioni] sync OK commission_id=%s inserted=%d", commission_id, inserted)
        return inserted  # successo (anche 0)

    except Exception as e:
        current_app.logger.exception("[sessioni] errore generale get_sessioni_internamente: %s", e)
        return -1






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


def get_sessione_config(session_id):
    """Restituisce la configurazione della sessione (esperto remoto, informatico sede, telefono)."""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT email_esperto_remoto, nome_informatico_sede, telefono_contatto
                FROM sessione_config
                WHERE session_id = %s
            """, (session_id,))
            row = cursor.fetchone()
    if not row:
        return None
    return {
        "email_esperto_remoto": row[0],
        "nome_informatico_sede": row[1],
        "telefono_contatto": row[2],
    }


def save_sessione_config(session_id, email_esperto_remoto, nome_informatico_sede, telefono_contatto):
    """Inserisce o aggiorna la configurazione della sessione."""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO sessione_config (session_id, email_esperto_remoto, nome_informatico_sede, telefono_contatto)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (session_id) DO UPDATE SET
                    email_esperto_remoto = EXCLUDED.email_esperto_remoto,
                    nome_informatico_sede = EXCLUDED.nome_informatico_sede,
                    telefono_contatto = EXCLUDED.telefono_contatto
            """, (session_id, email_esperto_remoto or None, nome_informatico_sede or None, telefono_contatto or None))
        conn.commit()
