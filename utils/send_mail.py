import smtplib
from email.message import EmailMessage
import mimetypes
import os

def send_notification_email(to_emails, subject, body, attachments=None):
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = os.environ.get('MAIL_SENDER')  # usa variabile d'ambiente
    msg['To'] = ', '.join(to_emails)
    msg.set_content(body)

    if attachments:
        for file_path in attachments:
            if os.path.exists(file_path):
                mime_type, _ = mimetypes.guess_type(file_path)
                maintype, subtype = mime_type.split('/', 1)
                with open(file_path, 'rb') as f:
                    msg.add_attachment(f.read(), maintype=maintype, subtype=subtype,
                                       filename=os.path.basename(file_path))

    try:
        with smtplib.SMTP_SSL(os.environ.get('SMTP_SERVER'), int(os.environ.get('SMTP_PORT'))) as smtp:
            smtp.login(os.environ.get('MAIL_USERNAME'), os.environ.get('MAIL_PASSWORD'))
            smtp.send_message(msg)
        return True, None
    except Exception as e:
        return False, str(e)

#serve inserire i dati del server smtp dentro le variabili di ambiente
#SMTP_SERVER=smtp.gmail.com
#SMTP_PORT=465
#MAIL_USERNAME=tuo_account@gmail.com
#MAIL_PASSWORD=la_tua_password_o_app_password
#MAIL_SENDER=tuo_account@gmail.com

#ESPERTO_EMAIL=esperto.informatico@ente.it"