from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for
from flask_session import Session
from urllib.parse import urlencode
from functools import wraps
import sqlite3
import requests
from datetime import datetime
import os
import json
import jwt


# === FLASK APP ===
app = Flask(__name__, static_folder='static')
# === CONFIGURAZIONE SESSIONE ===
app.secret_key = 'supersecretkey'  # ⚠️ Sposta in .env in produzione
app.config['SESSION_TYPE'] = 'filesystem'

# Assicura che la cartella 'instance/flask_session' esista
session_dir = os.path.join(app.instance_path, 'flask_session')
os.makedirs(session_dir, exist_ok=True)
app.config['SESSION_FILE_DIR'] = session_dir

# Stampa per debug (opzionale ma utile)
print(">>> Session directory:", session_dir)

# Inizializza la sessione
Session(app)

DB_PATH = 'checkin.db'

# === CONFIG OIDC ===
OIDC_CLIENT_ID = 'selezioni'
OIDC_CLIENT_SECRET = '17812d1a-6bdc-412f-acf8-ba0d9aa130de'
OIDC_REDIRECT_URI = 'https://747805b8928a.ngrok-free.app/oidc-callback'
OIDC_AUTH_URL = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/auth'
OIDC_TOKEN_URL = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/token'
OIDC_USERINFO_URL = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/userinfo'

# === DECORATORE LOGIN ===
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'access_token' not in session:
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

from flask import redirect, session
import jwt

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

        token_response.raise_for_status()

        tokens = token_response.json()
        access_token = tokens['access_token']
        id_token = tokens.get('id_token')


        # 🔍 DEBUG: stampa il token completo
        print("TOKEN:", json.dumps(tokens, indent=2))
        print("Access token:", access_token)

        # Decodifica JWT senza verifica (solo per visualizzazione interna)
        decoded = jwt.decode(access_token, options={"verify_signature": False, "verify_aud": False})
        print("JWT Decodificato:", json.dumps(decoded, indent=2))

        # Salva access token e dati utente decodificati in sessione
        session['user'] = decoded.get('preferred_username') or decoded.get('email') or decoded.get('sub')
        session['access_token'] = access_token
        session['user_info'] = decoded
        session['id_token'] = id_token  # <-- questa è la parte che ti mancava

        return redirect('/')

    except Exception as e:
        print("Errore nella richiesta token:")
        try:
            print("Status code:", token_response.status_code)
            print("Response body:", token_response.text)
        except:
            pass
        import traceback
        traceback.print_exc()
        return f"Errore: {str(e)}", 500


@app.route('/logout')
def logout():
    id_token = session.get("id_token")  # Assicurati che venga salvato nella sessione dopo il login
    session.clear()
    session.modified = True

    logout_url = (
        "https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/logout"
        f"?post_logout_redirect_uri={url_for('login', _external=True)}"
        f"&scope=openid email profile"
        f"&prompt=login"
    )

    if id_token:
        logout_url += f"&id_token_hint={id_token}"

    return redirect(logout_url)

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
    
@app.route('/me')
@login_required
def me():
    return jsonify({
        "user_info": session.get('user_info'),
        "access_token": session.get('access_token')
    })

@app.route('/user')
@login_required
def user_page():
    return send_from_directory('static', 'user.html')

@app.route('/debug-session')
def debug_session():
    return jsonify({
        "access_token": session.get("access_token"),
        "user_info": session.get("user_info")
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)
