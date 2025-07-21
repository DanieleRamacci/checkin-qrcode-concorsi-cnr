from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for, render_template
from flask_session import Session
from urllib.parse import urlencode
from functools import wraps
import psycopg2
import requests
from datetime import datetime
import os
import json
import random
import jwt
import csv
from urllib.parse import quote
from flask import send_file
import qrcode
import io
import hashlib
import psycopg2
from psycopg2.extras import RealDictCursor


# === FLASK APP ===
app = Flask(__name__, static_folder='static')

# === CONFIGURAZIONE SESSIONE ===
app.secret_key = 'supersecretkey'  # 🔐 Sposta in .env in produzione
app.config['SESSION_TYPE'] = 'filesystem'

# Assicura che la cartella 'instance/flask_session' esista
session_dir = os.path.join(app.instance_path, 'flask_session')
os.makedirs(session_dir, exist_ok=True)
app.config['SESSION_FILE_DIR'] = session_dir

print(">>> Session directory:", session_dir)
Session(app)

# === CONFIG DATABASE POSTGRES ===
DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'dbname': 'checkin',
    'user': 'postgres',
    'password': ''  # ✅ sostituisci con la tua password o prendi da .env
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

# === CONFIG OIDC ===
OIDC_CLIENT_ID = 'selezioni'
OIDC_CLIENT_SECRET = '17812d1a-6bdc-412f-acf8-ba0d9aa130de'
OIDC_REDIRECT_URI = 'https://83c08f8aeab0.ngrok-free.app/oidc-callback'
OIDC_AUTH_URL = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/auth'
OIDC_TOKEN_URL = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/token'
OIDC_USERINFO_URL = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/userinfo'

# === DECORATORE LOGIN ===
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'access_token' not in session:
            next_url = request.url
            return redirect(url_for('login', next=next_url))
        return f(*args, **kwargs)
    return decorated_function

# === LOGIN / CALLBACK / LOGOUT ===
@app.route('/login')
def login():
    next_url = request.args.get('next') or url_for('index', _external=True)

    params = {
        'client_id': OIDC_CLIENT_ID,
        'response_type': 'code',
        'scope': 'openid profile email',
        'redirect_uri': OIDC_REDIRECT_URI,
        'state': next_url  # <--- qui salviamo l'URL da cui proveniva l'utente
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
        session['token']= access_token


        # DEBUG: stampa il token completo
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
        next_url = request.args.get('state', '/')
        return redirect(next_url)


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



# Funzione di utilità per la validità del documento
def is_document_valid(document_date_str):
    try:
        # Adatta questo parsing alla formattazione dei tuoi dati (es. YYYY-MM-DD o DD/MM/YYYY)
        document_date = datetime.strptime(document_date_str, "%Y-%m-%d")
        return document_date > datetime.now()
    except:
        return False


@app.route('/gestione-concorso/<session_id>')
@login_required
def gestione_concorso(session_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Recupera i dati della sessione
                cursor.execute("""
                    SELECT nome, giorno, ora, luogo, attiva
                    FROM sessioni WHERE session_id = %s
                """, (session_id,))
                session_row = cursor.fetchone()

                if not session_row:
                    return render_template("gestione-concorso.html", messaggi=["Sessione non trovata."], sessione=None, candidati=[])

                # Recupera i candidati
                cursor.execute("""
                    SELECT uid, first_name, last_name, document_number, document_date, checkin_effettuato 
                    FROM candidati WHERE session_id = %s
                """, (session_id,))
                candidati_raw = cursor.fetchall()

        candidati = []
        for c in candidati_raw:
            candidati.append({
                "id": c[0],
                "nome": c[1],
                "cognome": c[2],
                "numero_documento": c[3],
                "document_date": c[4],
                "checkin_effettuato": bool(c[5]),
                "validita_documento": "valido" if is_document_valid(c[4]) else "scaduto"
            })

        sessione = {
            "session_id": session_id,
            "nome": session_row[0],
            "giorno": session_row[1],
            "ora": session_row[2],
            "luogo": session_row[3],
            "attiva": bool(session_row[4])
        }

        return render_template("gestione-concorso.html", sessione=sessione, candidati=candidati, messaggi=[])

    except Exception as e:
        import traceback
        traceback.print_exc()
        return render_template("gestione-concorso.html", messaggi=[str(e)], sessione=None, candidati=[])


@app.route('/sessioni')
@login_required
def sessioni():
    commission_id = request.args.get('commission_id')
    if not commission_id:
        return "Commission ID mancante", 400

    access_token = session.get('access_token')
    user_email = session.get('user_email')

    # 🔁 Sincronizzazione se necessaria
    get_sessioni_internamente(commission_id, access_token, user_email)

    # ✅ Lettura da DB PostgreSQL
    try:
        sessioni = []
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT session_id, nome, giorno, ora, luogo, attiva
                    FROM sessioni
                    WHERE commission_id = %s AND user_email = %s
                    ORDER BY giorno, ora
                """, (commission_id, user_email))
                sessioni = cursor.fetchall()
    except Exception as e:
        return f"Errore durante il recupero delle sessioni: {str(e)}", 500

    return render_template('sessioni.html', sessioni=sessioni, commission_id=commission_id)


@app.route('/')
@login_required
def index():
    user_email = session.get('user_email')
    access_token = session.get('access_token')

    if not access_token or not user_email:
        return redirect(url_for('login'))

    commissioni = get_commissioni_sincronizzate(access_token, user_email)

    if commissioni is None:
        # Token scaduto, logout forzato
        session.clear()
        return redirect(url_for('login'))

    return render_template('dashboard.html', commissioni=commissioni, user_email=user_email)




@app.route('/qr-test')
@login_required
def qr_test():
    return send_from_directory('static', 'qr-test.html')

@app.route("/scanner")
@login_required
def scanner_page():
    return render_template("scanner.html")



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
        remote_commissions = response.json()

        remote_ids = {c['id'] for c in remote_commissions}

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 2. Recupera commissioni locali per l'utente
                cursor.execute("""
                    SELECT commission_id FROM commissions
                    WHERE user_email = %s
                """, (user_email,))
                local_ids = {row[0] for row in cursor.fetchall()}

                # 3. INSERT nuove commissioni
                nuovi = remote_ids - local_ids
                for c in remote_commissions:
                    if c['id'] in nuovi:
                        cursor.execute("""
                            INSERT INTO commissions (commission_id, titolo, user_email, data_sync)
                            VALUES (%s, %s, %s, %s)
                        """, (c['id'], c['title'], user_email, datetime.now().isoformat()))

                # 4. DELETE commissioni non più autorizzate
                da_eliminare = local_ids - remote_ids
                for cid in da_eliminare:
                    cursor.execute("""
                        DELETE FROM commissions
                        WHERE commission_id = %s AND user_email = %s
                    """, (cid, user_email))

                # 5. Recupera la lista aggiornata
                cursor.execute("""
                    SELECT commission_id, titolo FROM commissions
                    WHERE user_email = %s
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
        # Verifica autorizzazione commissione
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s AND user_email = %s
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    print(f"[DEBUG] Nessuna autorizzazione trovata per commission_id={commission_id}")
                    return jsonify({"success": False, "message": "Commissione non autorizzata"}), 403

        # Chiamata all’API per le sessioni
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

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
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
                            INSERT INTO sessioni (
                                session_id, commission_id, user_email, session_string,
                                nome, giorno, ora, luogo, data_esame,
                                attiva, candidati_importati, sync_user_email, data_sync
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, 0, %s, %s)
                            ON CONFLICT (session_id) DO NOTHING
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

    if not uid or not session_id:
        return jsonify(success=False, message="Parametri mancanti."), 400

    try:
        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 FROM candidati WHERE uid = %s AND session_id = %s", (uid, session_id))
                if not cursor.fetchone():
                    return jsonify(success=False, message="Candidato non trovato."), 404

                cursor.execute("""
                    UPDATE candidati
                    SET checkin_effettuato = TRUE
                    WHERE uid = %s AND session_id = %s
                """, (uid, session_id))
                conn.commit()

        return jsonify(success=True, message="Check-in registrato con successo.")
    except Exception as e:
        return jsonify(success=False, message=f"Errore server: {str(e)}"), 500


@app.route("/verifica-candidato", methods=["POST"])
def verifica_candidato():
    data = request.json
    uid = data.get("uid")
    session_id = data.get("session_id")

    if not uid or not session_id:
        return jsonify(success=False, message="Parametri mancanti."), 400

    try:
        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT first_name, last_name, document_number, checkin_effettuato
                    FROM candidati 
                    WHERE uid = %s AND session_id = %s
                """, (uid, session_id))
                candidato = cursor.fetchone()

                if not candidato:
                    return jsonify(success=False, message="Candidato non trovato o non appartiene alla sessione."), 404

                nome, cognome, numero_documento, checkin_effettuato = candidato

                if checkin_effettuato:
                    return jsonify(success=False, message="Candidato già registrato al check-in."), 409

                return jsonify(success=True, candidato={
                    "nome": nome,
                    "cognome": cognome,
                    "numero_documento": numero_documento,
                    "session_id": session_id
                })
    except Exception as e:
        return jsonify(success=False, message=f"Errore server: {str(e)}"), 500


@app.route("/session-check", methods=["GET"])
def session_check():
    session_id = request.args.get("session_id")
    timestamp = request.args.get("timestamp")
    debug_mode = request.args.get("debug", "false").lower() == "false"

    if not session_id or not timestamp:
        return jsonify(success=False, message="Parametri mancanti."), 400

    try:
        now = datetime.fromisoformat(timestamp.replace("Z", "")).replace(tzinfo=None)
    except ValueError:
        return jsonify(success=False, message="Timestamp non valido."), 400

    try:
        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT giorno, ora, attiva 
                    FROM sessioni 
                    WHERE session_id = %s
                """, (session_id,))
                row = cursor.fetchone()

                if not row:
                    return jsonify(success=False, message="Sessione non trovata."), 404

                giorno, ora, attiva = row
                try:
                    session_datetime = datetime.strptime(f"{giorno}T{ora}", "%d/%m/%YT%H:%M")
                except ValueError:
                    return jsonify(success=False, message="Formato data/ora non valido."), 400

                if not debug_mode:
                    if not attiva:
                        return jsonify(success=False, message="Sessione non attiva."), 403
                    if now < session_datetime:
                        return jsonify(success=False, message="Sessione non ancora iniziata."), 403

                return jsonify(success=True, message="Sessione valida e attiva (debug abilitato)." if debug_mode else "Sessione valida e attiva.")
    except Exception as e:
        return jsonify(success=False, message=f"Errore server: {str(e)}"), 500
    

@app.route('/sessione/<session_id>', methods=['GET'])
@login_required
def get_session(session_id):
    try:
        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT nome, giorno, ora, luogo, attiva
                    FROM sessioni WHERE session_id = %s
                """, (session_id,))
                session_row = cursor.fetchone()

                if not session_row:
                    return jsonify(success=False, message="Sessione non trovata."), 404

                cursor.execute("""
                    SELECT uid, first_name, last_name, document_number, checkin_effettuato 
                    FROM candidati WHERE session_id = %s
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
    

from urllib.parse import quote

@app.route('/get-candidati', methods=['GET'])
@login_required
def get_candidati():
    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify({"success": False, "message": "Missing session_id"}), 400

    try:
        access_token = session.get('access_token')
        user_email = session.get('user_email')

        if not access_token or not user_email:
            return jsonify({"success": False, "message": "Autenticazione mancante"}), 401

        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor() as cursor:
                # Dati della sessione
                cursor.execute("""
                    SELECT commission_id, session_string, candidati_importati
                    FROM sessioni
                    WHERE session_id = %s
                """, (session_id,))
                row = cursor.fetchone()

                if not row:
                    return jsonify({"success": False, "message": "Sessione non trovata."}), 404

                commission_id, session_string, candidati_importati = row

                if candidati_importati:
                    return jsonify({"success": False, "message": "I candidati sono già stati importati per questa sessione."}), 400

                # Verifica autorizzazione utente
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s AND user_email = %s
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    return jsonify({"success": False, "message": "Commissione non autorizzata"}), 403

                # Chiamata API
                encoded_session = quote(session_string, safe='')
                api_url = f"https://cool-jconon.test.si.cnr.it/openapi/v1/call/exam-sessions/{commission_id}?session={encoded_session}"
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "*/*"
                }

                res = requests.get(api_url, headers=headers)
                if res.status_code != 200:
                    return jsonify({"success": False, "message": f"Errore chiamata API Selezioni Online: {res.status_code}"}), 502

                try:
                    json_data = res.json()
                except Exception as e:
                    return jsonify({"success": False, "message": "La risposta non è in formato JSON valido."}), 500

                candidati = json_data.get(session_string)
                if not candidati:
                    return jsonify({"success": False, "message": "Nessun candidato trovato nella sessione indicata."}), 404

                inseriti = 0
                for row in candidati:
                    if not row.get("uid"):
                        continue
                    cursor.execute("""
                        INSERT INTO candidati (
                            uid, session_id, first_name, last_name, birthdate,
                            fiscal_code, document_type, document_number,
                            document_date, document_issued_by
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (uid, session_id) DO NOTHING
                    """, (
                        row.get("uid"),
                        session_id,
                        row.get("firstName"),
                        row.get("lastName"),
                        row.get("birthdate"),
                        row.get("fiscalCode"),
                        row.get("documentType"),
                        row.get("documentNumber"),
                        row.get("documentDate"),
                        row.get("documentIssuedBy"),
                    ))
                    inseriti += cursor.rowcount

                if inseriti == 0:
                    return jsonify({"success": False, "message": "Nessun candidato è stato importato dal file JSON."}), 500

                # Aggiorna stato sessione
                cursor.execute("""
                    UPDATE sessioni
                    SET candidati_importati = TRUE,
                        sync_user_email = %s,
                        data_sync = CURRENT_TIMESTAMP
                    WHERE session_id = %s
                """, (user_email, session_id))

                conn.commit()

                return jsonify({
                    "success": True,
                    "message": f"{inseriti} candidati importati correttamente dal file JSON."
                })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


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
    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cursor:
            for sessione in sessioni:
                cursor.execute("""
                    INSERT INTO sessioni (
                        session_id, nome, giorno, ora, luogo, attiva
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (session_id) DO UPDATE SET
                        nome = EXCLUDED.nome,
                        giorno = EXCLUDED.giorno,
                        ora = EXCLUDED.ora,
                        luogo = EXCLUDED.luogo,
                        attiva = EXCLUDED.attiva
                """, (
                    sessione['id'],
                    sessione['nome'],
                    sessione['giorno'],
                    sessione['ora'],
                    sessione['luogo'],
                    sessione.get('attiva', 0)
                ))

@app.route('/sessioni')
@login_required
def pagina_sessioni():
    commission_id = request.args.get('commission_id')
    if not commission_id:
        return "Commission ID mancante", 400

    sessioni = get_sessioni_per_commissione(commission_id)
    return render_template('sessioni.html', sessioni=sessioni, commission_id=commission_id)

def get_sessioni_per_commissione(commission_id):
    with psycopg2.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT session_id, nome, giorno, ora, luogo
                FROM sessioni
                WHERE commission_id = %s
            """, (commission_id,))
            rows = cursor.fetchall()

    return [{
        "session_id": row[0],
        "session_string": row[1],
        "giorno": row[2],
        "ora": row[3],
        "luogo": row[4]
    } for row in rows]

def get_commissioni_sincronizzate(access_token, user_email):
    try:
        api_url = 'https://cool-jconon.test.si.cnr.it/openapi/v1/call/commissions'
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }
        response = requests.get(api_url, headers=headers)

        if response.status_code == 401:
            print("[DEBUG] Token scaduto o non valido")
            return None

        response.raise_for_status()
        remote_commissions = response.json()
        remote_ids = {c['id'] for c in remote_commissions}

        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT commission_id FROM commissions
                    WHERE user_email = %s
                """, (user_email,))
                local_ids = {row[0] for row in cursor.fetchall()}

                nuovi = remote_ids - local_ids
                for c in remote_commissions:
                    if c['id'] in nuovi:
                        cursor.execute("""
                            INSERT INTO commissions (commission_id, titolo, user_email, data_sync)
                            VALUES (%s, %s, %s, %s)
                        """, (c['id'], c['title'], user_email, datetime.now().isoformat()))

                da_eliminare = local_ids - remote_ids
                for cid in da_eliminare:
                    cursor.execute("""
                        DELETE FROM commissions
                        WHERE commission_id = %s AND user_email = %s
                    """, (cid, user_email))

                cursor.execute("""
                    SELECT commission_id, titolo FROM commissions
                    WHERE user_email = %s
                    ORDER BY titolo
                """, (user_email,))
                risultati = [{"id": r[0], "title": r[1]} for r in cursor.fetchall()]

        for c in remote_commissions:
            commission_id = c['id']
            print(f"[DEBUG] Sincronizzo anche le sessioni per commission_id={commission_id}")
            _ = get_sessioni_internamente(commission_id, access_token, user_email)

        return risultati

    except Exception as e:
        print(f"[ERRORE SYNC GENERICO] {e}")
        return []

def get_sessioni_internamente(commission_id, access_token, user_email):
    try:
        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s AND user_email = %s
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    print(f"[DEBUG] Nessuna autorizzazione per commission_id={commission_id}")
                    return None

        api_url = f'https://cool-jconon.test.si.cnr.it/openapi/v1/call/exam-sessions/{commission_id}'
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }

        response = requests.get(api_url, headers=headers)
        print(f"[DEBUG] Status code API: {response.status_code}")
        if response.status_code == 401:
            print("[DEBUG] Token scaduto")
            return None

        response.raise_for_status()
        sessioni_data = response.json()

        result = []
        now = datetime.now().isoformat()

        with psycopg2.connect(**DB_CONFIG) as conn:
            with conn.cursor() as cursor:
                for session_string, candidati in sessioni_data.items():
                    try:
                        parts = session_string.split(' - ')
                        if len(parts) != 2:
                            continue

                        luogo = parts[0].strip()
                        giorno_str, ora_str = parts[1].strip().split(' ')
                        giorno = giorno_str.strip()
                        ora = ora_str.strip()
                        data_esame_iso = datetime.strptime(f"{giorno} {ora}", "%d/%m/%Y %H:%M").isoformat()

                        raw_key = f"{commission_id}::{session_string}"
                        session_id = hashlib.md5(raw_key.encode()).hexdigest()

                        cursor.execute("""
                            INSERT INTO sessioni (
                                session_id, commission_id, user_email, session_string,
                                nome, giorno, ora, luogo, data_esame,
                                attiva, candidati_importati, sync_user_email, data_sync
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, 0, %s, %s)
                            ON CONFLICT (session_id) DO NOTHING
                        """, (
                            session_id, commission_id, user_email, session_string,
                            session_string, giorno, ora, luogo, data_esame_iso,
                            user_email, now
                        ))

                        result.append({
                            "session_id": session_id,
                            "session_string": session_string,
                            "luogo": luogo,
                            "giorno": giorno,
                            "ora": ora
                        })
                    except Exception as e:
                        print(f"[ERRORE PARSING] {session_string}: {e}")
                        continue

        return result

    except Exception as e:
        print(f"[ERRORE GENERICO get_sessioni] {e}")
        return None

def is_document_valid(date_str):
    try:
        if not date_str:
            return False
        day, month, year = map(int, date_str.split("/"))
        document_date = datetime(year, month, day)
        return document_date >= datetime.today()
    except:
        return False

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)