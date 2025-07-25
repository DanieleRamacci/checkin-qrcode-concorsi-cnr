import requests 
from db import get_db_connection  
from utils.sessioni import get_sessioni_internamente
from datetime import datetime
import os
BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')


def get_commissioni_sincronizzate(access_token, user_email):
    try:
        
        api_url = f"{BASE_URL}/openapi/v1/call/commissions"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }
        response = requests.get(api_url, headers=headers)

        if response.status_code == 401:
            print("[DEBUG] Token scaduto o non valido")
            return None

        response.raise_for_status()
        remote_commissions = response.json()
        remote_ids = {c['id'] for c in remote_commissions}

        with get_db_connection()  as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT commission_id FROM commissions
                    WHERE user_email = %s
                """, (user_email,))
                local_ids = {row[0] for row in cursor.fetchall()}

                nuovi = remote_ids - local_ids
                for c in remote_commissions:
                    if c['id'] in nuovi:
                        cursor.execute("""
                            INSERT INTO commissions (commission_id, titolo, user_email, data_sync)
                            VALUES (%s, %s, %s, %s)
                        """, (c['id'], c['title'], user_email, datetime.now().isoformat()))

                da_eliminare = local_ids - remote_ids
                for cid in da_eliminare:
                    cursor.execute("""
                        DELETE FROM commissions
                        WHERE commission_id = %s AND user_email = %s
                    """, (cid, user_email))

                cursor.execute("""
                    SELECT commission_id, titolo FROM commissions
                    WHERE user_email = %s
                    ORDER BY titolo
                """, (user_email,))
                risultati = [{"id": r[0], "title": r[1]} for r in cursor.fetchall()]

        for c in remote_commissions:
            commission_id = c['id']
            print(f"[DEBUG] Sincronizzo anche le sessioni per commission_id={commission_id}")
            _ = get_sessioni_internamente(commission_id, access_token, user_email)

        return risultati

    except Exception as e:
        print(f"[ERRORE SYNC GENERICO] {e}")
        return []
