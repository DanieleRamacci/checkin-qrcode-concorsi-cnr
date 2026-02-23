import json
import logging
from db import get_db_connection


logger = logging.getLogger(__name__)


def log_system_error(source, actor_email, raw_error, error_type=None, context=None):
    """
    Salva errore tecnico raw in DB senza rielaborazioni.
    Questa funzione non deve mai interrompere il flusso chiamante.
    """
    try:
        payload = json.dumps(context or {}, ensure_ascii=False)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO system_error_log (source, actor_email, error_type, raw_error, context_json)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (source, actor_email, error_type, str(raw_error), payload),
                )
            conn.commit()
    except Exception:
        logger.exception(
            "[system_error_log] impossibile salvare errore source=%s actor=%s raw=%s",
            source,
            actor_email,
            raw_error,
        )
