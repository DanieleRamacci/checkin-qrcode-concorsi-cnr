from db import get_db_connection  
from datetime import datetime


def registra_checkin(uid, session_id):
    conn = get_db_connection()
    try:
        conn.execute(
            "UPDATE candidati SET checkin_effettuato = TRUE WHERE uid = %s AND session_id = %s",
            (uid, session_id)
        )
        conn.commit()
        conn.close()
        return True, "Check-in effettuato"
    except Exception as e:
        conn.rollback()
        conn.close()
        return False, f"Errore nel check-in: {e}"