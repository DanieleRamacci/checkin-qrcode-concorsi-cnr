# utils/commissioni.py
import requests
from datetime import datetime
from flask import current_app
from db import get_db_connection
import os
from datetime import datetime, timezone


BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')

def get_commissioni_sincronizzate_with_status(access_token, user_email, timeout_s: int = 8):
    out = {
        "commissioni": [],
        "unauthorized": False,
        "sync_ok": True,
        "sync_error": None,
        "sync_source": "remote",
    }
    try:
        api_url = f"{BASE_URL}/openapi/v1/call/commissions"
        headers = {'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'}
        remote_fetch_ok = False

        try:
            current_app.logger.debug(f"[comm] GET {api_url}")
            response = requests.get(api_url, headers=headers, timeout=timeout_s)
            current_app.logger.debug(f"[comm] -> {response.status_code}")
            if response.status_code == 401:
                current_app.logger.warning("[comm] token scaduto/401")
                out["unauthorized"] = True
                out["sync_ok"] = False
                out["sync_error"] = "Token OIDC scaduto o non valido (401)"
                out["sync_source"] = "unauthorized"
                return out
            response.raise_for_status()
            remote_commissions = response.json()
            if remote_commissions:
                current_app.logger.info("[comm] STRUTTURA primo oggetto: %s", remote_commissions[0])
            remote_fetch_ok = True
        except (requests.Timeout, requests.ConnectionError) as e:
            current_app.logger.warning(f"[comm] timeout/conn error: {e}")
            out["sync_ok"] = False
            out["sync_error"] = f"API Selezioni Online non raggiungibile ({e})"
            out["sync_source"] = "db_cache"
            remote_commissions = []
        except requests.HTTPError as e:
            body = (e.response.text or "")[:300] if e.response is not None else ""
            status = e.response.status_code if e.response is not None else "?"
            current_app.logger.error(f"[comm] HTTP {status}: {body}")
            out["sync_ok"] = False
            out["sync_error"] = f"Errore API Selezioni Online HTTP {status}"
            out["sync_source"] = "db_cache"
            remote_commissions = []

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                if remote_fetch_ok:
                    remote_ids = {c['id'] for c in remote_commissions}
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
                else:
                    current_app.logger.warning("[comm] Sync remota non disponibile: nessuna modifica al DB locale")

                cursor.execute("""
                    SELECT commission_id, titolo
                    FROM commissions
                    WHERE user_email = %s
                    ORDER BY titolo
                """, (user_email,))
                out["commissioni"] = [{"id": r[0], "title": r[1]} for r in cursor.fetchall()]
        return out
    except Exception as e:
        current_app.logger.exception(f"[comm] ERRORE SYNC GENERICO: {e}")
        out["sync_ok"] = False
        out["sync_error"] = f"Errore interno sync commissioni: {e}"
        out["sync_source"] = "db_fallback"
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT commission_id, titolo
                        FROM commissions
                        WHERE user_email = %s
                        ORDER BY titolo
                    """, (user_email,))
                    out["commissioni"] = [{"id": r[0], "title": r[1]} for r in cursor.fetchall()]
        except Exception:
            out["commissioni"] = []
        return out

def get_commissioni_sincronizzate(access_token, user_email, timeout_s: int = 8):
    details = get_commissioni_sincronizzate_with_status(access_token, user_email, timeout_s=timeout_s)
    if details.get("unauthorized"):
        return None
    return details.get("commissioni", [])



def now_iso_utc():
    # Esempio: 2025-09-18T12:03:45+00:00
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
