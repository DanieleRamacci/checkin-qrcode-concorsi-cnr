from psycopg2.extras import RealDictCursor

from db import get_db_connection


DEFAULT_APP_SETTINGS = {
    "institution_name": "CNR",
    "app_title": "Check-in CNR Concorsi",
    "tagline": "Sistema gestione presenze concorsi",
    "footer_owner": "CNR - Consiglio Nazionale delle Ricerche",
}

ALLOWED_APP_SETTINGS = set(DEFAULT_APP_SETTINGS)


def ensure_app_settings_table() -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_by TEXT,
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
        conn.commit()


def get_app_settings() -> dict[str, str]:
    try:
        ensure_app_settings_table()
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT key, value
                      FROM app_settings
                     WHERE key = ANY(%s)
                    """,
                    (list(ALLOWED_APP_SETTINGS),),
                )
                stored = {row["key"]: row["value"] for row in cursor.fetchall()}
    except Exception:
        return dict(DEFAULT_APP_SETTINGS)
    return {**DEFAULT_APP_SETTINGS, **stored}


def save_app_settings(values: dict[str, str], actor_email: str) -> dict[str, str]:
    ensure_app_settings_table()
    cleaned = {
        key: str(values.get(key) or "").strip()
        for key in ALLOWED_APP_SETTINGS
        if key in values
    }
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            for key, value in cleaned.items():
                cursor.execute(
                    """
                    INSERT INTO app_settings (key, value, updated_by, updated_at)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (key) DO UPDATE
                       SET value = EXCLUDED.value,
                           updated_by = EXCLUDED.updated_by,
                           updated_at = NOW()
                    """,
                    (key, value, actor_email),
                )
        conn.commit()
    return get_app_settings()
