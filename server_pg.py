from flask import Flask, jsonify, session, current_app, request, Response, url_for
from flask_session import Session
import redis
from datetime import datetime
from pathlib import Path
import os
from flask import send_file
import qrcode
import io
from psycopg2.extras import RealDictCursor
from routes import register_blueprints  # importa la funzione dal __init__.py
from routes.auth import login_required  
from utils.logging_setup import setup_logging
from datetime import datetime, timedelta
from utils.device_tokens import make_reg_token
from utils.roles import has_role, ROLE_ADMIN, ROLE_ESPERTO



# === FLASK APP ===
app = Flask(__name__, static_folder='static')
register_blueprints(app)  
from utils.liste import  get_ultima_lista_generata

app.jinja_env.globals.update(get_ultima_lista_generata=get_ultima_lista_generata)
app.jinja_env.globals.update(
    has_role=has_role,
    ROLE_ADMIN=ROLE_ADMIN,
    ROLE_ESPERTO=ROLE_ESPERTO,
)

# Base directory dove salvi/leggi le liste
FILES_BASE_DIR = os.getenv("FILES_BASE_DIR", os.path.join(app.root_path, "files_liste"))
Path(FILES_BASE_DIR).mkdir(parents=True, exist_ok=True)
app.config.update(FILES_BASE_DIR=FILES_BASE_DIR)


# === CONFIGURAZIONE SESSIONE ===
from dotenv import load_dotenv
load_dotenv()

app.config.update(
    OIDC_TOKEN_URL=os.getenv("OIDC_TOKEN_URL"),
    OIDC_CLIENT_ID=os.getenv("OIDC_CLIENT_ID"),
    OIDC_CLIENT_SECRET=os.getenv("OIDC_CLIENT_SECRET"),  # opzionale
)


# === ENVIRONMENT CONFIGURATION ===
version = os.getenv("APP_VERSION", "test")
build_time = os.getenv("APP_BUILD_TIME") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
app.jinja_env.globals.update(current_year=datetime.now().year)
# === SESSIONI SU REDIS ===
app.secret_key = os.getenv('SECRET_KEY', 'fallback')

SESSION_TYPE = os.getenv('SESSION_TYPE', 'filesystem').lower()
app.config['SESSION_TYPE'] = SESSION_TYPE

if SESSION_TYPE == 'redis':
    redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
    # Se usi requirepass:
    # es: redis://:password@redis:6379/0
    app.config['SESSION_REDIS'] = redis.from_url(redis_url, decode_responses=False)
    app.config['SESSION_PERMANENT'] = True
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)
    app.config['SESSION_USE_SIGNER'] = True
    app.config['SESSION_KEY_PREFIX'] = 'flask_sess:'
    # Cookie hardening
    app.config['SESSION_COOKIE_NAME'] = 'sid'
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_SECURE'] = os.getenv('COOKIE_SECURE', '0') == '1'
else:
    # Fallback: filesystem (dev)
    from pathlib import Path
    session_dir = os.path.join(app.instance_path, 'flask_session')
    Path(session_dir).mkdir(parents=True, exist_ok=True)
    app.config['SESSION_FILE_DIR'] = session_dir
    app.config['SESSION_PERMANENT'] = True

Session(app)

setup_logging(app)
app.logger.debug("Logging inizializzato")



@app.route("/qr-code/<session_id>")
@login_required
def genera_qr_code(session_id):
    token = request.args.get("token")
    if not token:
        token = make_reg_token(session_id, app.secret_key)
    link = url_for("scanner.device_link", session_id=session_id, token=token, _external=True)
    img = qrcode.make(link)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return send_file(buffer, mimetype='image/png')



from fpdf import FPDF

@app.route("/qr-pdf/<session_id>")
@login_required
def genera_qr_pdf(session_id):
    import requests

    # URL contenuto nel QR
    url = f" https://83c08f8aeab0.ngrok-free.app/scanner.html?session_id={session_id}"
    img = qrcode.make(url)
    img_io = io.BytesIO()
    img.save(img_io, format='PNG')
    img_io.seek(0)

    # Salva temporaneamente l'immagine (oppure usa PIL)
    with open("temp_qr.png", "wb") as f:
        f.write(img_io.read())

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=16)
    pdf.cell(0, 10, f"Connetti il dispositivo alla sessione {session_id}", ln=True)
    pdf.image("temp_qr.png", x=50, y=30, w=100)

    pdf_output = io.BytesIO()
    pdf.output(pdf_output)
    pdf_output.seek(0)

    return send_file(pdf_output, mimetype='application/pdf', download_name=f"qr_sessione_{session_id}.pdf")




@app.route('/debug-session')
def debug_session():
    return jsonify({
        "access_token": session.get("access_token"),
        "user_info": session.get("user_info")
    })



def _tail(path, n=500):
    # tail efficiente
    with open(path, "rb") as f:
        f.seek(0, os.SEEK_END)
        size = f.tell()
        block = -1024
        data = b""
        while -block < size and data.count(b"\n") <= n:
            f.seek(block, os.SEEK_END)
            data = f.read(-block) + data
            block *= 2
    return b"\n".join(data.splitlines()[-n:]).decode("utf-8", errors="replace")

@app.route("/log")
def view_log():
    log_path = current_app.config.get("APP_LOG_FILE")
    if not log_path or not os.path.exists(log_path):
        return Response("Log non disponibile", status=404)
    n = int(request.args.get("n", 500))
    tail_txt = _tail(log_path, n=n)
    # È JSONL (una riga = un JSON). Lo mostriamo come testo grezzo.
    return Response(tail_txt, mimetype="text/plain; charset=utf-8")

@app.context_processor
def inject_version():
    return dict(version=version, build_time=build_time)

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5050,
        debug=app.config["DEBUG"]
    )
