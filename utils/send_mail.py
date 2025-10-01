import smtplib
from email.message import EmailMessage
import mimetypes
import os

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

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = os.environ.get('MAIL_SENDER', 'noreply@example.com')
    msg['To'] = ', '.join(filter(None, to_emails or []))
    msg.set_content(body or "")

    # Allegati (con fallback mime)
    if attachments:
        for file_path in attachments:
            if not file_path or not os.path.exists(file_path):
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

    server = os.environ.get('SMTP_SERVER', 'localhost')
    port = int(os.environ.get('SMTP_PORT', '25'))
    use_starttls = os.environ.get('SMTP_STARTTLS', 'false').lower() in ('1','true','yes')

    try:
        with smtplib.SMTP(host=server, port=port, timeout=30) as smtp:
            smtp.ehlo()
            # Usa STARTTLS solo se richiesto/consentito e configurato
            if use_starttls:
                try:
                    smtp.starttls()
                    smtp.ehlo()
                except smtplib.SMTPException:
                    # se STARTTLS non è supportato, procedi comunque senza
                    pass

            # Nessuna autenticazione: niente smtp.login(...)
            smtp.send_message(msg)

        return True, None

    except Exception as e:
        return False, str(e)
