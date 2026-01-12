from db import get_db_connection  
from datetime import datetime


def registra_checkin(uid, session_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE candidati
                SET checkin_effettuato = TRUE
                WHERE uid = %s AND session_id = %s
                  AND EXISTS (
                      SELECT 1 FROM sessioni WHERE session_id = %s AND stato_corrente = 'checkin_avviato'
                  )
                """,
                (uid, session_id, session_id)
            )
            if cursor.rowcount == 0:
                conn.rollback()
                conn.close()
                return False, "Check-in non avviato o sessione non attiva."
        conn.commit()
        conn.close()
        return True, "Check-in effettuato"
    except Exception as e:
        conn.rollback()
        conn.close()
        return False, f"Errore nel check-in: {e}"