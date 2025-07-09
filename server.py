from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for
from flask_session import Session
from urllib.parse import urlencode
from functools import wraps
import sqlite3
import requests
from datetime import datetime
import os
import json

# === FLASK APP ===
app = Flask(__name__, static_folder='static')
app.config['SESSION_TYPE'] = 'filesystem'
app.secret_key = 'supersecretkey'  # da mettere sicuro in .env se in produzione
Session(app)

DB_PATH = 'checkin.db'

# === CONFIG OIDC ===
OIDC_CLIENT_ID = 'selezioni'
OIDC_CLIENT_SECRET = '17812d1a-6bdc-412f-acf8-ba0d9aa130de'
OIDC_REDIRECT_URI = 'https://c7c4-150-146-29-211.ngrok-free.app/oidc-callback'
OIDC_AUTH_URL = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/auth'
OIDC_TOKEN_URL = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/token'
OIDC_USERINFO_URL = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/userinfo'

# === DECORATORE LOGIN ===
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# === LOGIN / CALLBACK / LOGOUT ===
@app.route('/login')
def login():
    params = {
        'client_id': OIDC_CLIENT_ID,
        'response_type': 'code',
        'scope': 'openid profile email',
        'redirect_uri': OIDC_REDIRECT_URI,
        'state': 'xyz'
    }
    return redirect(f"{OIDC_AUTH_URL}?{urlencode(params)}")
@app.route('/oidc-callback')
def oidc_callback():
    try:
        code = request.args.get('code')
        if not code:
            return "Codice non trovato", 400

        # Scambio del codice per un access token
        token_response = requests.post(
            OIDC_TOKEN_URL,
            data={
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': OIDC_REDIRECT_URI,
                'client_id': OIDC_CLIENT_ID,
                'client_secret': OIDC_CLIENT_SECRET
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )

        token_response.raise_for_status()  # <-- se token_response è 4xx/5xx lancia eccezione

        tokens = token_response.json()
        access_token = tokens['access_token']

        # 🔍 DEBUG: stampa token e risposta userinfo
        print("TOKEN:", json.dumps(tokens, indent=2))
        print("Access token:", access_token)

        headers = {'Authorization': f'Bearer {access_token}'}
        userinfo_response = requests.get(OIDC_USERINFO_URL, headers=headers)

        print("Userinfo status:", userinfo_response.status_code)
        print("Userinfo body:", userinfo_response.text)

        if userinfo_response.status_code != 200:
            return "Errore nel recupero dei dati utente", 500

        # Qui puoi gestire i dati dell’utente come vuoi
        return jsonify(userinfo_response.json())

    except Exception as e:
        print(" Errore nella richiesta token:")
        print("Status code:", token_response.status_code)
        print("Response body:", token_response.text)
        import traceback
        traceback.print_exc()  # <-- stampa lo stack completo nel terminale
        return f"Errore: {str(e)}", 500


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# === ROUTES PROTETTE ===

@app.route('/')
@login_required
def index():
    return send_from_directory('static', 'dashboard.html')

@app.route('/qr-test')
@login_required
def qr_test():
    return send_from_directory('static', 'qr-test.html')

@app.route('/scanner')
@login_required
def scanner():
    return send_from_directory('static', 'scanner.html')

@app.route('/checkin', methods=['POST'])
@login_required
def checkin():
    try:
        data = request.json
        session_id = data.get('session_id')
        candidate_id = data.get('id')

        if not session_id or not candidate_id:
            return jsonify(success=False, message="Dati mancanti"), 400

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT checkin_effettuato FROM candidati 
                WHERE id = ? AND session_id = ?
            """, (candidate_id, session_id))
            result = cursor.fetchone()

            if not result:
                return jsonify(success=False, message="Candidato non trovato nella sessione attiva."), 404

            if result[0] == 1:
                return jsonify(success=False, message="Il candidato ha già effettuato il check-in."), 409

            cursor.execute("""
                UPDATE candidati SET checkin_effettuato = 1 
                WHERE id = ? AND session_id = ?
            """, (candidate_id, session_id))

        return jsonify(success=True)

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

@app.route('/upload-session', methods=['POST'])
@login_required
def upload_session():
    try:
        data = request.json
        session_id = data.get('session_id')
        nome = data.get('nome')
        candidati = data.get('candidati')

        if not session_id or not nome or not candidati:
            return jsonify(success=False, message="Dati incompleti"), 400

        now = datetime.now().strftime('%Y-%m-%d %H:%M')
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO sessioni (session_id, nome, creata_il) VALUES (?, ?, ?)", (session_id, nome, now))
            for c in candidati:
                cursor.execute("""
                    INSERT INTO candidati (id, session_id, nome, cognome, numero_documento, checkin_effettuato)
                    VALUES (?, ?, ?, ?, ?, 0)
                """, (c['id'], session_id, c['nome'], c['cognome'], c['numero_documento']))

        return jsonify(success=True)
    except sqlite3.IntegrityError:
        return jsonify(success=False, message="Sessione o candidati già presenti"), 409
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

@app.route('/lista-sessioni', methods=['GET'])
@login_required
def lista_sessioni():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT session_id, nome, creata_il FROM sessioni")
            rows = cursor.fetchall()
            result = [
                {"session_id": r[0], "nome_sessione": r[1], "data_creazione": r[2]}
                for r in rows
            ]
        return jsonify(result)
    except Exception as e:
        return jsonify([])

@app.route('/sessione/<session_id>', methods=['GET'])
@login_required
def get_session(session_id):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT nome, creata_il FROM sessioni WHERE session_id = ?", (session_id,))
            session_row = cursor.fetchone()
            if not session_row:
                return jsonify(success=False, message="Sessione non trovata."), 404

            cursor.execute("""
                SELECT id, nome, cognome, numero_documento, checkin_effettuato 
                FROM candidati WHERE session_id = ?
            """, (session_id,))
            candidati = cursor.fetchall()
            lista_candidati = [
                {
                    "id": c[0],
                    "nome": c[1],
                    "cognome": c[2],
                    "numero_documento": c[3],
                    "checkin_effettuato": bool(c[4])
                } for c in candidati
            ]

        return jsonify(success=True, session={
            "session_id": session_id,
            "nome_sessione": session_row[0],
            "data_creazione": session_row[1],
            "candidates": lista_candidati
        })
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)
