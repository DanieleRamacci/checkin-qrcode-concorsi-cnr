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

from flask import jsonify
import hashlib


# === FLASK APP ===
app = Flask(__name__, static_folder='static')
# === CONFIGURAZIONE SESSIONE ===
app.secret_key = 'supersecretkey'  #  Sposta in .env in produzione
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
OIDC_REDIRECT_URI = 'https://980849cff71b.ngrok-free.app/oidc-callback'
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
        email = decoded.get('email')
        if not email:
            return "Errore: il token non contiene un'email valida", 400
        session['user_email'] = email
        session['user'] = decoded.get('preferred_username') or decoded.get('email') or decoded.get('sub')
        session['access_token'] = access_token
        session['user_info'] = decoded
        session['id_token'] = id_token  
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
@app.route('/gestione-concorso.html')
@login_required
def gestione_concorso():
    return send_from_directory('static', 'gestione-concorso.html')

@app.route('/sessioni.html')
@login_required
def sessioni():
    return send_from_directory('static', 'sessioni.html')


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


import requests
from flask import jsonify, session

from datetime import datetime
import sqlite3

@app.route('/sync-commissioni')
@login_required
def sync_commissioni():
    access_token = session.get('access_token')
    user_email = session.get('user_email')

    if not access_token or not user_email:
        return jsonify({"success": False, "message": "Autenticazione mancante"}), 401

    try:
        # 1. Chiamata API remota
        api_url = 'https://cool-jconon.test.si.cnr.it/openapi/v1/call/commissions'
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }
        response = requests.get(api_url, headers=headers)
        response.raise_for_status()
        remote_commissions = response.json()  # lista di dizionari

        remote_ids = {c['id'] for c in remote_commissions}

        with sqlite3.connect('checkin.db') as conn:
            cursor = conn.cursor()

            # 2. Recupera commissioni già salvate per questo utente
            cursor.execute("""
                SELECT commission_id FROM commissions
                WHERE user_email = ?
            """, (user_email,))
            local_ids = {row[0] for row in cursor.fetchall()}

            # 3. INSERT nuove commissioni
            nuovi = remote_ids - local_ids
            for c in remote_commissions:
                if c['id'] in nuovi:
                    cursor.execute("""
                        INSERT INTO commissions (commission_id, titolo, user_email, data_sync)
                        VALUES (?, ?, ?, ?)
                    """, (c['id'], c['title'], user_email, datetime.now().isoformat()))

            # 4. DELETE commissioni non più autorizzate
            da_eliminare = local_ids - remote_ids
            for cid in da_eliminare:
                cursor.execute("""
                    DELETE FROM commissions
                    WHERE commission_id = ? AND user_email = ?
                """, (cid, user_email))

            # 5. Recupera la lista aggiornata dal DB
            cursor.execute("""
                SELECT commission_id, titolo FROM commissions
                WHERE user_email = ?
                ORDER BY titolo
            """, (user_email,))
            risultati = [{"id": r[0], "title": r[1]} for r in cursor.fetchall()]

        return jsonify({
            "success": True,
            "commissioni": risultati
        })

    except requests.exceptions.HTTPError as http_err:
        return jsonify({
            "success": False,
            "error": "Errore HTTP",
            "status_code": response.status_code,
            "body": response.text
        }), response.status_code

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
    

@app.route('/get-sessioni/<commission_id>')
@login_required
def get_sessioni(commission_id):
    access_token = session.get('access_token')
    user_email = session.get('user_email')

    print(f"[DEBUG] Richiesta per commission_id={commission_id}, user_email={user_email}")

    if not access_token or not user_email:
        print("[DEBUG] Token o email mancanti")
        return jsonify({"success": False, "message": "Autenticazione mancante"}), 401

    try:
        with sqlite3.connect('checkin.db') as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 1 FROM commissions
                WHERE commission_id = ? AND user_email = ?
            """, (commission_id, user_email))
            if not cursor.fetchone():
                print(f"[DEBUG] Nessuna autorizzazione trovata per commission_id={commission_id}")
                return jsonify({"success": False, "message": "Commissione non autorizzata"}), 403

        api_url = f'https://cool-jconon.test.si.cnr.it/openapi/v1/call/exam-sessions/{commission_id}'
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }

        response = requests.get(api_url, headers=headers)
        print(f"[DEBUG] Status code API: {response.status_code}")
        print(f"[DEBUG] Body API: {response.text}")
        response.raise_for_status()

        sessioni_data = response.json()

        print(f"[DEBUG] Sessioni trovate: {list(sessioni_data.keys())}")

        result = []
        now = datetime.now().isoformat()

        with sqlite3.connect('checkin.db') as conn:
            cursor = conn.cursor()

            for session_string, candidati in sessioni_data.items():
                print(f"[DEBUG] Parsing session_string: {session_string}")
                try:
                    parts = session_string.split(' - ')
                    if len(parts) != 2:
                        raise ValueError("Formato session_string non valido")

                    luogo = parts[0].strip()
                    data_ora_str = parts[1].strip()

                    giorno_str, ora_str = data_ora_str.split(' ')
                    giorno = giorno_str.strip()
                    ora = ora_str.strip()
                    data_esame_iso = datetime.strptime(f"{giorno} {ora}", "%d/%m/%Y %H:%M").isoformat()

                    raw_key = f"{commission_id}::{session_string}"
                    session_id = hashlib.md5(raw_key.encode()).hexdigest()

                    cursor.execute("""
                        INSERT OR IGNORE INTO sessioni (
                            session_id, commission_id, user_email, session_string,
                            nome, giorno, ora, luogo, data_esame,
                            attiva, candidati_importati, sync_user_email, data_sync
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
                    """, (
                        session_id,
                        commission_id,
                        user_email,
                        session_string,
                        session_string,
                        giorno,
                        ora,
                        luogo,
                        data_esame_iso,
                        user_email,
                        now
                    ))

                    print(f"[DEBUG] Sessione inserita: {session_id}")

                    result.append({
                        "session_id": session_id,
                        "session_string": session_string,
                        "luogo": luogo,
                        "giorno": giorno,
                        "ora": ora
                    })

                except Exception as e:
                    print(f"[ERRORE PARSING] session_string: {session_string} -> {e}")
                    continue

        print(f"[DEBUG] Totale sessioni restituite: {len(result)}")

        return jsonify({
            "success": True,
            "commission_id": commission_id,
            "sessioni": result
        })

    except requests.exceptions.HTTPError as http_err:
        print(f"[ERRORE HTTP] {response.status_code}: {response.text}")
        return jsonify({
            "success": False,
            "error": "HTTP error",
            "status_code": response.status_code,
            "body": response.text
        }), response.status_code

    except Exception as e:
        print(f"[ERRORE GENERICO] {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500



@app.route("/checkin-candidato", methods=["POST"])
def checkin_candidato():
    data = request.json
    uid = data.get("uid")
    session_id = data.get("session_id")
    documento_scaduto = data.get("documento_scaduto", False)

    if not uid or not session_id:
        return jsonify(success=False, message="Parametri mancanti."), 400

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()

            # Verifica che esista il candidato in quella sessione
            cursor.execute("""
                SELECT 1 FROM candidati WHERE uid = ? AND session_id = ?
            """, (uid, session_id))
            if not cursor.fetchone():
                return jsonify(success=False, message="Candidato non trovato."), 404

            # Aggiorna il check-in e lo stato del documento
            cursor.execute("""
                UPDATE candidati
                SET checkin_effettuato = 1, documento_scaduto = ?
                WHERE uid = ? AND session_id = ?
            """, (1 if documento_scaduto else 0, uid, session_id))

            conn.commit()

            return jsonify(success=True, message="Check-in registrato con successo.")

    except Exception as e:
        return jsonify(success=False, message=f"Errore server: {str(e)}"), 500


@app.route("/verifica-candidato", methods=["POST"])
def verifica_candidato():
    data = request.json
    uid = data.get("uid")
    session_id_dispositivo = data.get("session_id")

    if not uid or not session_id_dispositivo:
        return jsonify(success=False, message="Parametri mancanti."), 400

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()

            # Recupera il candidato e lo stato del check-in
            cursor.execute("""
                SELECT first_name, last_name, document_number, session_id, checkin_effettuato
                FROM candidati
                WHERE uid = ?
            """, (uid,))
            row = cursor.fetchone()

            if not row:
                return jsonify(success=False, message="Candidato non trovato."), 404

            nome, cognome, numero_documento, session_id_candidato, checkin_effettuato = row

            # Verifica che il session_id corrisponda
            if session_id_candidato != session_id_dispositivo:
                return jsonify(success=False, message="Sessione non corrispondente."), 403

            # Verifica se ha già fatto il check-in
            if checkin_effettuato == 1:
                return jsonify(success=False, message="Candidato già registrato al check-in."), 409

            # Verifica che la sessione sia attiva e nel tempo corretto
            cursor.execute("""
                SELECT giorno, ora, attiva
                FROM sessioni
                WHERE session_id = ?
            """, (session_id_candidato,))
            sessione = cursor.fetchone()

            if not sessione:
                return jsonify(success=False, message="Sessione non trovata."), 404

            giorno, ora, attiva = sessione
            session_datetime = datetime.strptime(f"{giorno}T{ora}", "%Y-%m-%dT%H:%M")
            now = datetime.now()

            if attiva != 1:
                return jsonify(success=False, message="Sessione non attiva."), 403

            if now < session_datetime:
                return jsonify(success=False, message="Sessione non ancora iniziata."), 403

            # Tutto ok
            return jsonify(success=True, candidato={
                "nome": nome,
                "cognome": cognome,
                "numero_documento": numero_documento,
                "session_id": session_id_candidato
            })

    except Exception as e:
        return jsonify(success=False, message=f"Errore server: {str(e)}"), 500


from flask import request, jsonify
import sqlite3
from datetime import datetime


@app.route("/session-check", methods=["GET"])
def session_check():
    session_id = request.args.get("session_id")
    timestamp = request.args.get("timestamp")

    if not session_id or not timestamp:
        return jsonify(success=False, message="Parametri mancanti."), 400

    try:
        # Converte timestamp ISO con Z finale e lo rende naive (senza fuso orario)
        now = datetime.fromisoformat(timestamp.replace("Z", "")).replace(tzinfo=None)
    except ValueError:
        return jsonify(success=False, message="Timestamp non valido."), 400

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT giorno, ora, attiva
                FROM sessioni
                WHERE session_id = ?
            """, (session_id,))
            row = cursor.fetchone()

            if not row:
                return jsonify(success=False, message="Sessione non trovata."), 404

            giorno, ora, attiva = row
            session_datetime = datetime.strptime(f"{giorno}T{ora}", "%Y-%m-%dT%H:%M")

            if attiva != 1:
                return jsonify(success=False, message="Sessione non attiva."), 403

            if now < session_datetime:
                return jsonify(success=False, message="Sessione non ancora iniziata."), 403

            return jsonify(success=True, message="Sessione valida e attiva.")

    except Exception as e:
        return jsonify(success=False, message=f"Errore server: {str(e)}"), 500


@app.route('/sessione/<session_id>', methods=['GET'])
@login_required
def get_session(session_id):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT nome, giorno, ora, luogo, attiva
                FROM sessioni WHERE session_id = ?
            """, (session_id,))
            session_row = cursor.fetchone()

            if not session_row:
                return jsonify(success=False, message="Sessione non trovata."), 404

            cursor.execute("""
                SELECT uid, first_name, last_name, document_number, checkin_effettuato 
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
                "giorno": session_row[1],
                "ora": session_row[2],
                "luogo": session_row[3],
                "attiva": bool(session_row[4]),
                "candidates": lista_candidati
            })
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500
    

@app.route('/mie-sessioni-esame', methods=['GET'])
@login_required
def mie_sessioni_esame():
    sessioni = [
        {
            "id": "sessione123",
            "nome": "Concorso Area Tecnica",
            "giorno": "2025-07-10",
            "ora": "09:00",
            "luogo": "Aula 3, Via Roma",
            "attiva": 1
        },
        {
            "id": "sessione456",
            "nome": "Concorso Area Amministrativa",
            "giorno": "2025-07-10",
            "ora": "15:00",
            "luogo": "Aula 1, Via Milano",
            "attiva": 1
        },
        {
            "id": "sessione888",
            "nome": "367.434 sessione 1",
            "giorno": "2025-07-10",
            "ora": "15:00",
            "luogo": "Aula 1, Via Napoli",
            "attiva": 1
        },
        
    ]

    importa_sessioni(sessioni)  # salva nel DB
    return jsonify(sessioni)


import requests
from flask import request, jsonify
import sqlite3

DB_PATH = 'checkin.db'

@app.route('/get-candidati', methods=['GET'])
@login_required
def get_candidati():
    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify({"success": False, "message": "Missing session_id"}), 400

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()

            # Verifica se i candidati sono già stati importati
            cursor.execute("SELECT candidati_importati FROM sessioni WHERE session_id = ?", (session_id,))
            row = cursor.fetchone()
            if not row:
                return jsonify({"success": False, "message": "Sessione non trovata."}), 404
            if row[0] == 1:
                return jsonify({"success": False, "message": "I candidati sono già stati importati per questa sessione."}), 400

            # JSON fittizio di esempio
            candidati = [
                {
                    "uid": "eaec8a7c-65d1-433c-8f57-54159329cbca",
                    "firstName": "Mario",
                    "lastName": "Rossi",
                    "birthdate": "01/01/1990",
                    "fiscalCode": "RSSMRA90A01H501X",
                    "documentType": "Carta d'identità",
                    "documentNumber": "AB123456",
                    "documentDate": "01/02/2020",
                    "documentIssuedBy": "Comune di Roma"
                },
                {
                    "uid": "abcde-12345-0002",
                    "firstName": "Lucia",
                    "lastName": "Verdi",
                    "birthdate": "15/07/1988",
                    "fiscalCode": "VRDLUC88L55H501T",
                    "documentType": "Passaporto",
                    "documentNumber": "YA998877",
                    "documentDate": "15/03/2021",
                    "documentIssuedBy": "Questura di Milano"
                },
                # ... altri candidati ...
            ]

            # Inserisci session_id nei record dei candidati
            for c in candidati:
                c['session_id'] = session_id

            # Inserimento nel DB
            for c in candidati:
                cursor.execute("""
                    INSERT OR IGNORE INTO candidati (
                        uid, session_id, first_name, last_name, birthdate,
                        fiscal_code, document_type, document_number,
                        document_date, document_issued_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    c['uid'], c['session_id'], c['firstName'], c['lastName'], c['birthdate'],
                    c['fiscalCode'], c['documentType'], c['documentNumber'],
                    c['documentDate'], c['documentIssuedBy']
                ))


            # Aggiorna lo stato nella tabella sessioni
            cursor.execute("UPDATE sessioni SET candidati_importati = 1 WHERE session_id = ?", (session_id,))

            conn.commit()

    except Exception as e:
        return jsonify({"success": False, "message": f"Errore durante l'importazione: {str(e)}"}), 500

    return jsonify({
        "success": True,
        "message": f"{len(candidati)} candidati importati correttamente nella sessione {session_id}."
    })


        
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



def importa_sessioni(sessioni):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        for sessione in sessioni:
            cursor.execute("""
                INSERT OR REPLACE INTO sessioni (
                    session_id, nome, giorno, ora, luogo, attiva
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                sessione['id'],
                sessione['nome'],
                sessione['giorno'],
                sessione['ora'],
                sessione['luogo'],
                sessione.get('attiva', 0)
            ))
        conn.commit()


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)



