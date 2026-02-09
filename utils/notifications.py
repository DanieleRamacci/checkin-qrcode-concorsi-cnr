from db import get_db_connection


def add_notification(session_id, notif_type, payload=None, author_email=None):
    if not session_id or not notif_type:
        return
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO session_notifications (session_id, author_email, type, payload)
                VALUES (%s, %s, %s, %s)
                """,
                (session_id, author_email, notif_type, payload),
            )
        conn.commit()


def get_notifications(session_id, limit=20):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, session_id, author_email, type, payload, created_at
                FROM session_notifications
                WHERE session_id = %s
                ORDER BY created_at DESC, id DESC
                LIMIT %s
                """,
                (session_id, limit),
            )
            rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "session_id": r[1],
            "author_email": r[2],
            "type": r[3],
            "payload": r[4],
            "created_at": r[5],
        }
        for r in rows
    ]
