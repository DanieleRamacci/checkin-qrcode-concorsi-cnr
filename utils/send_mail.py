import smtplib
from email.message import EmailMessage
import mimetypes
import os
import socket
import logging
from flask import current_app, has_app_context


logger = logging.getLogger(__name__)


def _cfg(name, default=None):
    env_val = os.environ.get(name)
    if env_val is not None and str(env_val).strip() != "":
        return env_val
    if has_app_context():
        cfg_val = current_app.config.get(name)
        if cfg_val is not None and str(cfg_val).strip() != "":
            return cfg_val
    return default

def send_notification_email(to_emails, subject, body, attachments=None):
    """
    Invia una mail tramite SMTP senza autenticazione (es. relay interno su porta 25).
    Variabili d'ambiente richieste:
      - SMTP_SERVER (es. smtp.cnr.it)
      - SMTP_PORT   (es. 25)
      - MAIL_SENDER (es. noreply@checkin-cnr.it)
    Opzionale:
      - SMTP_STARTTLS=true|false  (default: false)  -> usa STARTTLS se necessario/su richiesta del server
    """
    if isinstance(to_emails, str):
        to_emails = [to_emails]

    recipients = [e.strip() for e in (to_emails or []) if e and e.strip()]
    if not recipients:
        return False, "Nessun destinatario valido"

    msg = EmailMessage()
    msg['Subject'] = subject
    sender = _cfg('MAIL_SENDER', 'noreply@example.com')
    msg['From'] = sender
    msg['To'] = ', '.join(recipients)
    msg.set_content(body or "")

    # Allegati (con fallback mime)
    attached_files = []
    missing_files = []
    if attachments:
        for file_path in attachments:
            if not file_path or not os.path.exists(file_path):
                if file_path:
                    missing_files.append(file_path)
                continue
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = 'application/octet-stream'
            maintype, subtype = mime_type.split('/', 1)
            with open(file_path, 'rb') as f:
                msg.add_attachment(
                    f.read(),
                    maintype=maintype,
                    subtype=subtype,
                    filename=os.path.basename(file_path)
                )
            attached_files.append(file_path)

    server = _cfg('SMTP_SERVER', 'localhost')
    raw_port = str(_cfg('SMTP_PORT', '25'))
    use_starttls = str(_cfg('SMTP_STARTTLS', 'false')).lower() in ('1', 'true', 'yes')
    try:
        port = int(raw_port)
    except (TypeError, ValueError):
        return False, f"SMTP_PORT non valido: {raw_port!r}"

    try:
        if missing_files:
            logger.warning(
                "[mail] allegati mancanti ignorati=%s",
                ",".join(missing_files),
            )
        logger.info(
            "[mail] start server=%s port=%s starttls=%s sender=%s recipients=%s attachments=%s",
            server,
            port,
            use_starttls,
            sender,
            ",".join(recipients),
            ",".join(os.path.basename(p) for p in attached_files) if attached_files else "-",
        )
        with smtplib.SMTP(host=server, port=port, timeout=30) as smtp:
            smtp.ehlo()
            # Usa STARTTLS solo se richiesto/consentito e configurato
            if use_starttls:
                try:
                    smtp.starttls()
                    smtp.ehlo()
                except smtplib.SMTPException as tls_err:
                    logger.warning("[mail] STARTTLS non disponibile o fallito: %s", tls_err)

            # Nessuna autenticazione: niente smtp.login(...)
            smtp.send_message(msg)

        logger.info("[mail] invio completato recipients=%s", ",".join(recipients))
        return True, None

    except smtplib.SMTPRecipientsRefused as e:
        refused = ",".join((e.recipients or {}).keys()) if getattr(e, "recipients", None) else "-"
        err = f"Destinatari rifiutati dal server SMTP: {refused}"
        logger.exception("[mail] %s", err)
        return False, err
    except smtplib.SMTPAuthenticationError as e:
        err = f"Autenticazione SMTP fallita (code={getattr(e, 'smtp_code', None)}): {e}"
        logger.exception("[mail] %s", err)
        return False, err
    except smtplib.SMTPConnectError as e:
        err = f"Connessione SMTP fallita (code={getattr(e, 'smtp_code', None)}): {e}"
        logger.exception("[mail] %s server=%s port=%s", err, server, port)
        return False, err
    except smtplib.SMTPServerDisconnected as e:
        err = f"Server SMTP disconnesso: {e}"
        logger.exception("[mail] %s", err)
        return False, err
    except smtplib.SMTPDataError as e:
        err = f"Errore dati SMTP (code={getattr(e, 'smtp_code', None)}): {e}"
        logger.exception("[mail] %s", err)
        return False, err
    except (socket.timeout, TimeoutError) as e:
        err = f"Timeout verso server SMTP {server}:{port}: {e}"
        logger.exception("[mail] %s", err)
        return False, err
    except socket.gaierror as e:
        err = f"Risoluzione DNS fallita per SMTP_SERVER={server}: {e}"
        logger.exception("[mail] %s", err)
        return False, err
    except OSError as e:
        err = f"Errore di rete/socket SMTP verso {server}:{port}: {e}"
        logger.exception("[mail] %s", err)
        return False, err
    except Exception as e:
        err = f"Errore generico invio email: {e}"
        logger.exception("[mail] %s", err)
        return False, err
