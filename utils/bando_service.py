from db import get_db_connection
from utils.send_mail import send_notification_email
from utils.sessioni import (
    email_to_nome,
    get_bando_config,
    save_bando_config,
)
from utils.roles import ROLE_ESPERTO


def list_expert_emails() -> list[str]:
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_email
                  FROM user_roles
                 WHERE role = %s
              ORDER BY user_email
                """,
                (ROLE_ESPERTO,),
            )
            rows = cursor.fetchall()
    return [row[0] for row in rows]


def _get_bando_title(commission_id: str) -> str:
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT titolo
                  FROM commissions
                 WHERE commission_id = %s
                 LIMIT 1
                """,
                (commission_id,),
            )
            row = cursor.fetchone()
    return row[0] if row else commission_id


def request_bando_configuration(
    commission_id: str,
    referente_email: str,
    actor_email: str,
    config_url: str,
) -> dict:
    config = get_bando_config(commission_id) or {}
    save_bando_config(
        commission_id,
        email_referente=referente_email,
        email_esperto_remoto=config.get("email_esperto_remoto"),
        email_segretario=config.get("email_segretario"),
        telefono_segretario=config.get("telefono_segretario"),
        durata_prova_minuti=config.get("durata_prova_minuti"),
        commissione_members=config.get("commissione_members"),
        configured_by=actor_email,
        data_accesso_piattaforma=config.get("data_accesso_piattaforma"),
    )

    title = _get_bando_title(commission_id)
    body = (
        f"Gentile {email_to_nome(referente_email)},\n\n"
        "ti scrivo per chiederti di inserire i dati di configurazione per il bando:\n"
        f"  {title}\n\n"
        "Puoi accedere alla pagina di configurazione al seguente link:\n"
        f"  {config_url}\n\n"
        f"Grazie,\n{email_to_nome(actor_email)}"
    )
    success, error = send_notification_email(
        to_emails=[referente_email],
        subject=f"Richiesta configurazione bando: {title}",
        body=body,
        actor_email=actor_email,
        source="api_v1.request_bando_configuration",
    )
    return {
        "success": success,
        "message": (
            "Email inviata al referente."
            if success
            else f"Errore invio email: {error}"
        ),
        "referente_email": referente_email,
    }
