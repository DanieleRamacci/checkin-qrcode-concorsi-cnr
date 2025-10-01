# utils/commissioni.py
import requests
from datetime import datetime
from flask import current_app
from db import get_db_connection
import os
from datetime import datetime, timezone


BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')

def get_commissioni_sincronizzate(access_token, user_email, timeout_s: int = 8):
    try:
        api_url = f"{BASE_URL}/openapi/v1/call/commissions"
        headers = {'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'}

        try:
            current_app.logger.debug(f"[comm] GET {api_url}")
            response = requests.get(api_url, headers=headers, timeout=timeout_s)
            current_app.logger.debug(f"[comm] -> {response.status_code}")
            if response.status_code == 401:
                current_app.logger.warning("[comm] token scaduto/401")
                return None
            response.raise_for_status()
            remote_commissions = response.json()
        except (requests.Timeout, requests.ConnectionError) as e:
            current_app.logger.warning(f"[comm] timeout/conn error: {e}")
            remote_commissions = []  # fallback: usa solo DB locale
        except requests.HTTPError as e:
            current_app.logger.error(f"[comm] HTTP {e.response.status_code}: {e.response.text[:300]}")
            remote_commissions = []

        remote_ids = {c['id'] for c in remote_commissions}

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT commission_id FROM commissions WHERE user_email = %s", (user_email,))
                local_ids = {row[0] for row in cursor.fetchall()}

                nuovi = remote_ids - local_ids
                for c in remote_commissions:
                    if c['id'] in nuovi:
                        cursor.execute("""
                            INSERT INTO commissions (commission_id, titolo, user_email, data_sync)
                            VALUES (%s, %s, %s, %s)
                        """, (c['id'], c['title'], user_email, now_iso_utc()))

                da_eliminare = local_ids - remote_ids
                for cid in da_eliminare:
                    cursor.execute("""
                        DELETE FROM commissions
                        WHERE commission_id = %s AND user_email = %s
                    """, (cid, user_email))

                cursor.execute("""
                    SELECT commission_id, titolo
                    FROM commissions
                    WHERE user_email = %s
                    ORDER BY titolo
                """, (user_email,))
                risultati = [{"id": r[0], "title": r[1]} for r in cursor.fetchall()]

        # IMPORTANTE: niente sync delle sessioni qui!
        return risultati

    except Exception as e:
        current_app.logger.exception(f"[comm] ERRORE SYNC GENERICO: {e}")
        # fallback: almeno torna ciò che c'è già in DB
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT commission_id, titolo
                        FROM commissions
                        WHERE user_email = %s
                        ORDER BY titolo
                    """, (user_email,))
                    return [{"id": r[0], "title": r[1]} for r in cursor.fetchall()]
        except Exception:
            return []



def now_iso_utc():
    # Esempio: 2025-09-18T12:03:45+00:00
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
