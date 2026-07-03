import secrets
from datetime import datetime, timezone

from psycopg2.extras import RealDictCursor

from db import get_db_connection
from utils.device_tokens import is_device_token_valid, make_reg_token, verify_reg_token
from utils.stato import get_stato_corrente, set_stato_corrente


REGISTRATION_MAX_AGE_SECONDS = 30 * 60
PING_ACTIVE_SECONDS = 90


class DeviceUnauthorized(Exception):
    pass


class DeviceNotFound(Exception):
    pass


def create_registration_token(session_id: str, secret_key: str) -> str:
    return make_reg_token(session_id, secret_key)


def list_devices(session_id: str) -> list[dict]:
    now = datetime.now(timezone.utc)
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT id, session_id, nome_dispositivo, operator_email, user_agent, ip_address,
                       timestamp, last_seen, disconnected_at
                  FROM dispositivi
                 WHERE session_id = %s
              ORDER BY timestamp DESC, id DESC
                """,
                (session_id,),
            )
            rows = cursor.fetchall()
    result = []
    for raw in rows:
        row = dict(raw)
        last_seen = row.get("last_seen")
        disconnected_at = row.get("disconnected_at")
        if disconnected_at:
            status = "disconnected"
        elif last_seen:
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            status = (
                "online"
                if (now - last_seen).total_seconds() <= PING_ACTIVE_SECONDS
                else "offline"
            )
        else:
            status = "offline"
        for field in ("timestamp", "last_seen", "disconnected_at"):
            if isinstance(row.get(field), datetime):
                row[field] = row[field].isoformat()
        row["status"] = status
        result.append(row)
    rank = {"online": 0, "offline": 1, "disconnected": 2}

    def sort_key(item):
        value = item.get("last_seen") or item.get("timestamp")
        try:
            timestamp = datetime.fromisoformat(value).timestamp() if value else 0
        except (TypeError, ValueError):
            timestamp = 0
        return rank.get(item["status"], 9), -timestamp

    result.sort(key=sort_key)
    return result


def verify_devices_connected(session_id: str, actor_email: str | None) -> dict:
    """Mirror di routes/azioni.py:verifica_dispositivi: se almeno un dispositivo
    e registrato per la sessione, avanza lo stato a 'dispositivi_connessi'."""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM dispositivi WHERE session_id = %s",
                (session_id,),
            )
            device_count = cursor.fetchone()[0]

    if device_count > 0 and get_stato_corrente(session_id) == "candidati_scaricati":
        set_stato_corrente(session_id, "dispositivi_connessi", utente=actor_email)

    return {
        "success": device_count > 0,
        "device_count": device_count,
        "current_state": get_stato_corrente(session_id),
    }


def register_device(
    session_id: str,
    registration_token: str,
    *,
    secret_key: str,
    operator_email: str | None,
    ip_address: str | None,
    user_agent: str | None,
    device_name: str | None = None,
) -> str:
    if not verify_reg_token(
        registration_token,
        session_id,
        secret_key,
        REGISTRATION_MAX_AGE_SECONDS,
    ):
        raise DeviceUnauthorized()
    now = datetime.now(timezone.utc)
    device_token = secrets.token_urlsafe(32)
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM sessioni WHERE session_id = %s",
                (session_id,),
            )
            if not cursor.fetchone():
                raise DeviceNotFound()
            cursor.execute(
                """
                INSERT INTO dispositivi (
                    ip_address, user_agent, session_id, nome_dispositivo, operator_email,
                    timestamp, device_token, last_seen, disconnected_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NULL)
                """,
                (
                    ip_address,
                    user_agent,
                    session_id,
                    device_name,
                    operator_email,
                    now,
                    device_token,
                    now,
                ),
            )
        conn.commit()
    return device_token


def _find_valid_device(session_id: str, provided_token: str, now: datetime):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, device_token, timestamp, disconnected_at
                  FROM dispositivi
                 WHERE session_id = %s
                """,
                (session_id,),
            )
            for row in cursor.fetchall():
                if is_device_token_valid(
                    provided_token,
                    stored_token=row[1],
                    issued_at=row[2],
                    disconnected_at=row[3],
                    now=now,
                ):
                    return row[0]
    raise DeviceUnauthorized()


def authorize_device(session_id: str, device_token: str) -> int:
    return _find_valid_device(
        session_id,
        device_token,
        datetime.now(timezone.utc),
    )


def heartbeat_device(session_id: str, device_token: str) -> None:
    now = datetime.now(timezone.utc)
    device_id = _find_valid_device(session_id, device_token, now)
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE dispositivi
                   SET last_seen = %s
                 WHERE id = %s AND disconnected_at IS NULL
                """,
                (now, device_id),
            )
            if cursor.rowcount != 1:
                raise DeviceUnauthorized()
        conn.commit()


def disconnect_device(session_id: str, device_token: str) -> None:
    now = datetime.now(timezone.utc)
    device_id = _find_valid_device(session_id, device_token, now)
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE dispositivi
                   SET disconnected_at = %s
                 WHERE id = %s AND disconnected_at IS NULL
                """,
                (now, device_id),
            )
            if cursor.rowcount != 1:
                raise DeviceUnauthorized()
        conn.commit()
