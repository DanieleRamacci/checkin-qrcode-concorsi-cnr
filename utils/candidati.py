from db import get_db_connection  
from datetime import datetime



def get_candidato_by_uid(uid, session_id):
    conn = get_db_connection()
    cursor = conn.execute(
        "SELECT nome, cognome, numero_documento, uid FROM candidati WHERE uid = %s AND sessione_id = %s",
        (uid, session_id)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None