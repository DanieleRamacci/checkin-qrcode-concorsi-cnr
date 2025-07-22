from flask import Flask, request, abort, jsonify, send_from_directory, session, redirect, url_for, render_template
from flask_session import Session
from urllib.parse import urlencode
from functools import wraps
from datetime import datetime, timezone
import os
from urllib.parse import quote
from flask import send_file
import qrcode
import io
from psycopg2.extras import RealDictCursor
from routes import register_blueprints  # importa la funzione dal __init__.py
from routes.auth import login_required  # è un decoratore deve essere importato 
# === FLASK APP ===
app = Flask(__name__, static_folder='static')
register_blueprints(app)  # registra auth_bp (e in futuro altri blueprint)




# === CONFIGURAZIONE SESSIONE ===
from dotenv import load_dotenv
load_dotenv()

app.secret_key = os.getenv('SECRET_KEY', 'fallback')
app.config['SESSION_TYPE'] = 'filesystem'
# Assicura che la cartella 'instance/flask_session' esista
session_dir = os.path.join(app.instance_path, 'flask_session')
os.makedirs(session_dir, exist_ok=True)
app.config['SESSION_FILE_DIR'] = session_dir
print(">>> Session directory:", session_dir)
Session(app)




@app.route("/qr-code/<session_id>")
@login_required
def genera_qr_code(session_id):
    import json
    data = json.dumps({"session_id": session_id})
    img = qrcode.make(data)
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



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)