from flask import Blueprint, render_template, abort, jsonify, session, send_file, Response, request, current_app
from routes.auth import login_required
from db import get_db_connection
import io, csv, os, re, requests
from datetime import datetime
from utils.stato import get_stato_corrente, get_azioni_per_stato, set_stato_corrente
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, roles_required_any
from utils.sessioni import get_sessione_by_id
from utils.candidati import importa_candidati_da_api
from utils.liste import get_candidati_by_sessione_checkin, genera_liste_excel_csv
from utils.send_mail import send_notification_email
from utils.oidc import ensure_fresh_access_token, seconds_left


azioni_bp = Blueprint("azioni", __name__)

def _abs_path(name: str) -> str:
    """
    Converte il 'leafname' salvato nel DB in un path assoluto dentro FILES_BASE_DIR.
    Accetta anche path già assoluti o con prefisso 'files_liste/'.
    """
    if not name:
        return ""
    base = current_app.config.get("FILES_BASE_DIR") or os.path.join(current_app.root_path, "files_liste")
    os.makedirs(base, exist_ok=True)

    # Path assoluto: restituisci com'è
    if os.path.isabs(name):
        return name

    # Normalizza eventuale prefisso 'files_liste/'
    norm = name.replace("\\", "/")
    if norm.startswith("files_liste/"):
        norm = norm.split("files_liste/", 1)[1]

    return os.path.join(base, norm)

@azioni_bp.get("/sessione/<session_id>/download")
@login_required
def download_file(session_id):
    user_email = session.get("user_email")
    if not _check_auth_for_session(session_id, user_email):
        abort(403)

    file_type = request.args.get("type", "").strip()  # xlsx | moodle_csv
    if file_type not in ("xlsx", "moodle_csv"):
        return Response("Tipo file non valido.", status=400)

    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT file_xlsx, file_csv_moodle
            FROM liste_generate
            WHERE session_id = %s
            ORDER BY timestamp_creazione DESC
            LIMIT 1
        """, (session_id,))
        row = cur.fetchone()

    if not row:
        return Response("Nessuna lista generata per questa sessione.", status=404)

    file_xlsx, file_csv_moodle = row
    selected = file_xlsx if file_type == "xlsx" else file_csv_moodle
    abs_path = _abs_path(selected)
    if (not abs_path) or (not os.path.exists(abs_path)):
        return Response("File non trovato sul server.", status=404)

    return send_file(abs_path, as_attachment=True, download_name=os.path.basename(abs_path))


@azioni_bp.route("/sessione/<session_id>/genera_liste", methods=["POST"])
@login_required
def genera_liste(session_id):
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"success": False, "message": "Utente non autenticato"}), 401

    # Stato minimo richiesto
    stato_corrente = get_stato_corrente(session_id)
    if stato_corrente != "checkin_concluso":
        sessione = get_sessione_by_id(session_id)
        messaggio = "Il check-in non è ancora concluso. Non puoi generare le liste."
        return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente=stato_corrente, messaggio=messaggio)

    # Presenti
    candidati = get_candidati_by_sessione_checkin(session_id)
    if not candidati:
        sessione = get_sessione_by_id(session_id)
        messaggio = "Nessun candidato ha ancora effettuato il check-in. Non è possibile generare le liste."
        return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente=stato_corrente, messaggio=messaggio)

    try:
        # 1) Genera XLSX presenti su disco
        risultati_x = genera_liste_excel_csv(session_id, candidati)  # restituisce xlsx_name, csv_name (uid), num_presenti

        # 2) Genera CSV Moodle su disco (formato “storico”)
        risultati_m = genera_moodle_csv_su_disco(session_id)         # restituisce file_csv_moodle, num_presenti

        # Salva/aggiorna riga "liste_generate"
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO liste_generate (session_id, file_xlsx, file_csv_moodle, num_presenti, generato_da)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            session_id,
            risultati_x["file_xlsx"],
            risultati_m["file_csv_moodle"],   # <-- QUI salviamo il Moodle CSV “giusto”
            risultati_m["num_presenti"],      # usa il conteggio dei presenti (coerente col Moodle)
            user_email
        ))
        conn.commit()
        cur.close()
        conn.close()

        # Stato
        set_stato_corrente(session_id, "liste_generate", utente=user_email)

        # Refresh del frammento con i pulsanti download/invio
        sessione = get_sessione_by_id(session_id)
        stato_corrente = get_stato_corrente(session_id)
        return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente=stato_corrente)

    except Exception as e:
        sessione = get_sessione_by_id(session_id)
        return render_template("frammenti/azioni.html",
                               sessione=sessione,
                               stato_corrente=stato_corrente,
                               messaggio=f"Errore generazione liste: {e}"), 500


def genera_moodle_csv_su_disco(session_id) -> dict:
    """
    Genera il CSV Moodle aggiornato con i presenti e lo salva su disco.
    Ritorna: {"file_csv_moodle": <leafname>, "num_presenti": <int>}
    """
    # -- Autorizzazione e contesto --
    user_email = session.get("user_email")
    if not _check_auth_for_session(session_id, user_email):
        raise PermissionError("Utente non autorizzato sulla sessione.")

    # -- Access token fresco (se serve) --
    access_token = ensure_fresh_access_token(skew_sec=60)
    if not access_token:
        raise RuntimeError("Autenticazione scaduta o mancante.")

    # -- Dati sessione + titolo bando (per course2) --
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT s.commission_id, s.session_string, COALESCE(c.titolo, s.commission_id) AS titolo_bando
            FROM sessioni s
            LEFT JOIN commissions c ON c.commission_id = s.commission_id AND c.user_email = %s
            WHERE s.session_id = %s
        """, (user_email, session_id))
        row = cur.fetchone()

    if not row:
        raise ValueError("Sessione non trovata.")

    commission_id, session_string, titolo_bando = row
    session_string = (session_string or "").strip()
    if not session_string:
        raise ValueError("Sessione senza session_string.")

    # -- 1) Candidati da API esterna --
    base_url = os.environ.get("BASE_URL", "https://cool-jconon.test.si.cnr.it")
    api_url  = f"{base_url}/openapi/v1/call/exam-sessions/{commission_id}"
    headers  = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "User-Agent": "checkin-app/1.0",
    }
    params = {"session": session_string}

    API_CONNECT_TIMEOUT = 5
    API_READ_TIMEOUT_1  = 45
    API_READ_TIMEOUT_2  = 120

    try:
        res = requests.get(api_url, headers=headers, params=params,
                           timeout=(API_CONNECT_TIMEOUT, API_READ_TIMEOUT_1))
    except requests.ReadTimeout:
        try:
            res = requests.get(api_url, headers=headers, params=params,
                               timeout=(API_CONNECT_TIMEOUT, API_READ_TIMEOUT_2))
        except requests.ReadTimeout:
            raise TimeoutError(f"L'API impiega troppo a rispondere (timeout {API_READ_TIMEOUT_2}s).")
        except requests.RequestException as e:
            raise ConnectionError(f"Errore di rete verso Selezioni Online: {e}")
    except requests.RequestException as e:
        raise ConnectionError(f"Errore di rete verso Selezioni Online: {e}")

    if res.status_code == 401:
        new_at = ensure_fresh_access_token(skew_sec=60)
        if not new_at:
            raise PermissionError("Autenticazione scaduta.")
        headers["Authorization"] = f"Bearer {new_at}"
        res = requests.get(api_url, headers=headers, params=params,
                           timeout=(API_CONNECT_TIMEOUT, API_READ_TIMEOUT_1))

    if res.status_code != 200:
        raise RuntimeError(f"Errore chiamata API Selezioni Online: {res.status_code} - {res.text[:300]}")

    try:
        json_data = res.json()
    except Exception:
        raise RuntimeError("La risposta non è JSON valido.")

    candidati_raw = json_data.get(session_string)
    if not candidati_raw:
        raise RuntimeError("Nessun candidato trovato nella sessione indicata.")

    # -- 2) Presenti dal DB per enrolstatus2 --
    presenti = get_candidati_by_sessione_checkin(session_id)
    present_usernames = {(c.get("uid") or "").strip().lower() for c in presenti if c.get("uid")}

    # -- 3) Righe CSV (stesso formato tua funzione) --
    fieldnames = ["username","firstname","lastname","password","course1","role1","course2","role2","enrolstatus2","email"]
    rows = []
    course1 = "esercitazione"
    role1   = "esercitazione"
    course2 = str(titolo_bando)
    password = "esercitazione"

    def _split_name_from_email(email: str):
        local = (email or '').split('@', 1)[0]
        if '.' in local:
            first, last = local.split('.', 1)
        else:
            first, last = local, ''
        return (first or '').upper(), (last or '').upper()

    for c in candidati_raw:
        uid   = (c.get("uid") or c.get("username") or "").strip()
        email = (c.get("email") or "").strip()
        first = (c.get("first_name") or c.get("firstname") or c.get("firstName") or "").strip()
        last  = (c.get("last_name")  or c.get("lastname")  or c.get("lastName")  or "").strip()

        if not (first or last):
            if email:
                first, last = _split_name_from_email(email)
            elif uid:
                if '.' in uid:
                    f, l = uid.split('.', 1)
                    first, last = (f or '').upper(), (l or '').upper()
                else:
                    first, last = uid.upper(), ""

        username = uid or (email.split('@', 1)[0] if email else "")
        enrolstatus2 = "0" if (username or "").lower() in present_usernames else "1"

        rows.append({
            "username": username,
            "firstname": first or "",
            "lastname":  last or "",
            "password":  password,
            "course1":   course1,
            "role1":     role1,
            "course2":   course2,
            "role2":     "candidato",
            "enrolstatus2": enrolstatus2,
            "email":     email,
        })

    # -- 4) Valutatori --
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT DISTINCT user_email FROM commissions WHERE commission_id = %s", (commission_id,))
        valutatori_emails = [r[0] for r in cur.fetchall()]

    for vmail in valutatori_emails:
        if not vmail:
            continue
        username = vmail.split('@', 1)[0]
        f, l = _split_name_from_email(vmail)
        rows.append({
            "username": username,
            "firstname": f,
            "lastname":  l,
            "password":  password,
            "course1":   course1,
            "role1":     role1,
            "course2":   course2,
            "role2":     "valutatore",
            "enrolstatus2": "1",
            "email":     vmail,
        })

    # -- 5) Scrivi su disco (come fai per l’XLSX) --
    base_dir = current_app.config.get("FILES_BASE_DIR") or os.path.join(current_app.root_path, "files_liste")
    os.makedirs(base_dir, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_name = f"lista_moodle_{session_id}_{ts}.csv"
    csv_path = os.path.join(base_dir, csv_name)

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    return {
        "file_csv_moodle": csv_name,
        "num_presenti": len(presenti),
    }


def _check_auth_for_session(session_id, user_email) -> bool:
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT 1
            FROM sessioni s
            JOIN commissions c ON c.commission_id = s.commission_id
            WHERE s.session_id = %s AND c.user_email = %s
        """, (session_id, user_email))
        return cur.fetchone() is not None

def _sanitize_filename(name: str) -> str:
    return re.sub(r'[\\/*?:"<>|]', '_', (name or '').strip()) or f"export_{datetime.now():%Y%m%d_%H%M%S}"

def _split_name_from_email(email: str):
    """
    Heuristica: da 'nome.cognome@...' -> ('NOME','COGNOME').
    Se non riconosce il formato, mette tutto in FIRSTNAME e LASTNAME vuoto.
    """
    local = (email or '').split('@', 1)[0]
    if '.' in local:
        first, last = local.split('.', 1)
    else:
        first, last = local, ''
    return (first or '').upper(), (last or '').upper()


##funzioni oper gestire il download 



@login_required
@azioni_bp.route("/sessione/<session_id>/moodle-csv", methods=["POST"])
def genera_moodle_csv(session_id):
    # -- Autorizzazione utente sulla commissione della sessione --
    user_email = session.get("user_email")
    if not _check_auth_for_session(session_id, user_email):
        abort(403)

    # -- Access token fresco (usa il refresh se sta per scadere) --
    access_token = ensure_fresh_access_token(skew_sec=60)
    if not access_token:
        return Response("Autenticazione scaduta o mancante. Effettua di nuovo il login.", status=401)

    # -- Dati sessione + titolo bando (per course2) --
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT s.commission_id, s.session_string, COALESCE(c.titolo, s.commission_id) AS titolo_bando
            FROM sessioni s
            LEFT JOIN commissions c ON c.commission_id = s.commission_id AND c.user_email = %s
            WHERE s.session_id = %s
        """, (user_email, session_id))
        row = cur.fetchone()
    if not row:
        return Response("Sessione non trovata.", status=404)

    commission_id, session_string, titolo_bando = row
    session_string = (session_string or "").strip()
    if not session_string:
        return Response("Sessione senza session_string.", status=400)

    # -- 1) Prendi CANDIDATI dalla API JSON con Bearer --
    base_url = os.environ.get("BASE_URL", "https://cool-jconon.test.si.cnr.it")
    api_url = f"{base_url}/openapi/v1/call/exam-sessions/{commission_id}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "User-Agent": "checkin-app/1.0",
    }
    params = {"session": session_string}

    # timeout: (conn, read) + 1 retry manuale solo su ReadTimeout
    API_CONNECT_TIMEOUT = 5
    API_READ_TIMEOUT_1  = 45
    API_READ_TIMEOUT_2  = 120

    try:
        res = requests.get(api_url, headers=headers, params=params,
                           timeout=(API_CONNECT_TIMEOUT, API_READ_TIMEOUT_1))
    except requests.ReadTimeout:
        # secondo tentativo con finestra di lettura più ampia
        try:
            res = requests.get(api_url, headers=headers, params=params,
                               timeout=(API_CONNECT_TIMEOUT, API_READ_TIMEOUT_2))
        except requests.ReadTimeout:
            return Response(f"L'API impiega troppo a rispondere (timeout {API_READ_TIMEOUT_2}s).", status=504)
        except requests.RequestException as e:
            return Response(f"Errore di rete verso Selezioni Online: {e}", status=502)
    except requests.RequestException as e:
        return Response(f"Errore di rete verso Selezioni Online: {e}", status=502)

    # retry cortese se 401 (token scaduto al millisecondo)
    if res.status_code == 401:
        new_at = ensure_fresh_access_token(skew_sec=60)
        if new_at:
            headers["Authorization"] = f"Bearer {new_at}"
            try:
                res = requests.get(api_url, headers=headers, params=params,
                                   timeout=(API_CONNECT_TIMEOUT, API_READ_TIMEOUT_1))
            except requests.RequestException as e:
                return Response(f"Errore di rete verso Selezioni Online: {e}", status=502)

    if res.status_code != 200:
        return Response(f"Errore chiamata API Selezioni Online: {res.status_code} - {res.text[:300]}", status=502)

    try:
        json_data = res.json()
    except Exception:
        return Response("La risposta non è in formato JSON valido.", status=500)

    candidati_raw = json_data.get(session_string)
    if not candidati_raw:
        return Response("Nessun candidato trovato nella sessione indicata.", status=404)

    # -- 2) Mappa PRESENTI dal DB per settare enrolstatus2=0 --
    presenti = get_candidati_by_sessione_checkin(session_id)  # [{'uid':..., ...}]
    present_usernames = {(c.get("uid") or "").strip().lower() for c in presenti if c.get("uid")}

    # -- 3) Prepara righe CSV per candidati --
    fieldnames = ["username","firstname","lastname","password","course1","role1","course2","role2","enrolstatus2","email"]

    rows = []
    course1 = "esercitazione"
    role1   = "esercitazione"
    course2 = str(titolo_bando)
    password = "esercitazione"

    for c in candidati_raw:
        uid   = (c.get("uid") or c.get("username") or "").strip()
        email = (c.get("email") or "").strip()
        first = (c.get("first_name") or c.get("firstname") or c.get("firstName") or "").strip()
        last  = (c.get("last_name")  or c.get("lastname")  or c.get("lastName")  or "").strip()
        if not (first or last):
            if email:
                first, last = _split_name_from_email(email)
            elif uid:
                if '.' in uid:
                    f, l = uid.split('.', 1)
                    first, last = (f or '').upper(), (l or '').upper()
                else:
                    first, last = uid.upper(), ""

        username = uid or (email.split('@', 1)[0] if email else "")
        enrolstatus2 = "0" if (username or "").lower() in present_usernames else "1"

        rows.append({
            "username": username,
            "firstname": first or "",
            "lastname":  last or "",
            "password":  password,
            "course1":   course1,
            "role1":     role1,
            "course2":   course2,
            "role2":     "candidato",
            "enrolstatus2": enrolstatus2,
            "email":     email,
        })

    # -- 4) Aggiungi VALUTATORI --
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT DISTINCT user_email FROM commissions WHERE commission_id = %s", (commission_id,))
        valutatori_emails = [r[0] for r in cur.fetchall()]

    for vmail in valutatori_emails:
        if not vmail:
            continue
        username = vmail.split('@', 1)[0]
        first, last = _split_name_from_email(vmail)
        rows.append({
            "username": username,
            "firstname": first,
            "lastname":  last,
            "password":  password,
            "course1":   course1,
            "role1":     role1,
            "course2":   course2,
            "role2":     "valutatore",
            "enrolstatus2": "1",
            "email":     vmail,
        })

    # -- 5) Scrivi CSV e invia --
    out_io = io.StringIO()
    writer = csv.DictWriter(out_io, fieldnames=fieldnames)
    writer.writeheader()
    for r in rows:
        writer.writerow(r)

    filename = _sanitize_filename(f"{session_string}.csv")
    return send_file(
        io.BytesIO(out_io.getvalue().encode("utf-8")),
        mimetype="text/csv; charset=utf-8",
        as_attachment=True,
        download_name=filename
    )



@azioni_bp.route("/sessione/<session_id>/scarica_candidati", methods=["POST"])
@login_required
def scarica_candidati(session_id):
    try:
        user_email = session.get('user_email')

        # 1) Ottieni un access token valido (auto-refresh se mancano <= 60s)
        access_token = ensure_fresh_access_token(skew_sec=60)
        if not user_email or not access_token:
            return render_template("error_fragment.html", message="Autenticazione mancante"), 401

        # (facoltativo) log diagnostico
        secs = seconds_left(access_token) or -1
        current_app.logger.info("[importa] token secs_left=%s", secs)

        # 2) Prima chiamata all'API
        risultato = importa_candidati_da_api(session_id, user_email, access_token)

        # 3) Se 401, fai UN solo refresh + retry
        if (not risultato.get("success")) and ("401" in (risultato.get("message") or "")):
            current_app.logger.info("[importa] 401: provo refresh e retry")
            access_token = ensure_fresh_access_token(skew_sec=60)
            if access_token:
                risultato = importa_candidati_da_api(session_id, user_email, access_token)

        # 4) Esito
        if risultato.get("success"):
            set_stato_corrente(session_id, "candidati_scaricati", utente=user_email)
            sessione = get_sessione_by_id(session_id)
            return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente="candidati_scaricati")
        else:
            return render_template("error_fragment.html", message=risultato.get("message", "Errore sconosciuto")), 400

    except Exception as e:
        return render_template("error_fragment.html", message=str(e)), 500


@azioni_bp.route("/sessione/<session_id>/azioni", methods=["GET"])
@login_required
def azioni_view(session_id):
    db = get_db_connection()
    with db.cursor() as cursor:
        cursor.execute("SELECT * FROM sessioni WHERE session_id = %s", (session_id,))
        sessione = cursor.fetchone()

    db.close()

    if not sessione:
        abort(404, description="Sessione non trovata")

    stato_corrente = get_stato_corrente(session_id)
    azioni_disponibili = get_azioni_per_stato(session_id)

    return render_template(
        "azioni.html",
        sessione=sessione,
        stato_corrente=stato_corrente,
        azioni_disponibili=azioni_disponibili
    )


@azioni_bp.route("/sessione/<session_id>/stato_corrente")
@login_required
def api_get_stato(session_id):
    try:
        stato = get_stato_corrente(session_id)
        return jsonify({"stato_corrente": stato})
    except Exception as e:
        return jsonify({"error": str(e)}), 500




@azioni_bp.route("/sessione/<string:session_id>/azioni-frammento")
@login_required
def azioni_frammento(session_id):
    view_mode = request.args.get("view")
    sessione = get_sessione_by_id(session_id)
    if not sessione:
        return "Sessione non trovata", 404
    stato_corrente = get_stato_corrente(session_id)
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM dispositivi WHERE session_id = %s", (session_id,))
            numero_dispositivi = cursor.fetchone()[0]
    print("stato sessione", stato_corrente)
    return render_template("frammenti/azioni.html",
                            sessione=sessione, 
                            stato_corrente=stato_corrente, 
                            numero_dispositivi_connessi=numero_dispositivi,
                            view_mode=view_mode

                            )



@azioni_bp.route("/sessione/<session_id>/verifica_dispositivi", methods=["POST"])
@login_required
def verifica_dispositivi(session_id):
    print("dentro verifica dispositivi")
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"success": False, "message": "Utente non autenticato"}), 401

    db = get_db_connection()
    with db.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM dispositivi WHERE session_id = %s", (session_id,))
        count = cursor.fetchone()[0]
        print("conteggio dispositivi", count)
    db.close()

    if count > 0:
        set_stato_corrente(session_id, "dispositivi_connessi", utente=user_email)
        return jsonify({"success": True, "message": "Dispositivi connessi correttamente"})
    else:
        return jsonify({"success": False, "message": "Nessun dispositivo connesso per questa sessione."})



@azioni_bp.route("/sessione/<session_id>/avvia_checkin", methods=["POST"])
@login_required
def avvia_checkin(session_id):
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"success": False, "message": "Utente non autenticato"}), 401

    set_stato_corrente(session_id, "checkin_avviato", utente=user_email)

    # Ricarica il frammento aggiornato e restituiscilo come HTML
    sessione = get_sessione_by_id(session_id)
    stato_corrente = get_stato_corrente(session_id)
    return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente=stato_corrente)



@azioni_bp.route("/sessione/<session_id>/concludi_checkin", methods=["POST"])
@login_required
def concludi_checkin(session_id):
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"success": False, "message": "Utente non autenticato"}), 401

    set_stato_corrente(session_id, "checkin_concluso", utente=user_email)
    sessione = get_sessione_by_id(session_id)
    stato_corrente = get_stato_corrente(session_id)
    return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente=stato_corrente)


@azioni_bp.route("/sessione/<session_id>/lista_presenti_moodle", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def lista_presenti_moodle(session_id):
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"success": False, "message": "Utente non autenticato"}), 401

    set_stato_corrente(session_id, "lista_presenti_aggiornata_su_moodle", utente=user_email)
    sessione = get_sessione_by_id(session_id)
    stato_corrente = get_stato_corrente(session_id)
    return render_template(
        "frammenti/azioni.html",
        sessione=sessione,
        stato_corrente=stato_corrente,
        view_mode="esperto"
    )


@azioni_bp.route("/sessione/<session_id>/avvia_esame", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def avvia_esame(session_id):
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"success": False, "message": "Utente non autenticato"}), 401

    set_stato_corrente(session_id, "avvia_esame", utente=user_email)
    sessione = get_sessione_by_id(session_id)
    stato_corrente = get_stato_corrente(session_id)
    return render_template(
        "frammenti/azioni.html",
        sessione=sessione,
        stato_corrente=stato_corrente,
        view_mode="esperto"
    )


@azioni_bp.route("/sessione/<session_id>/inizia_esame", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def inizia_esame(session_id):
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"success": False, "message": "Utente non autenticato"}), 401

    set_stato_corrente(session_id, "esame_in_corso", utente=user_email)
    sessione = get_sessione_by_id(session_id)
    stato_corrente = get_stato_corrente(session_id)
    return render_template(
        "frammenti/azioni.html",
        sessione=sessione,
        stato_corrente=stato_corrente,
        view_mode="esperto"
    )


@azioni_bp.route("/sessione/<session_id>/concludi_esame", methods=["POST"])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def concludi_esame(session_id):
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"success": False, "message": "Utente non autenticato"}), 401

    set_stato_corrente(session_id, "esame_concluso", utente=user_email)
    sessione = get_sessione_by_id(session_id)
    stato_corrente = get_stato_corrente(session_id)
    return render_template(
        "frammenti/azioni.html",
        sessione=sessione,
        stato_corrente=stato_corrente,
        view_mode="esperto"
    )



@azioni_bp.route("/sessione/<session_id>/timeline-frammento")
@login_required
def timeline_frammento(session_id):
    stato_corrente = get_stato_corrente(session_id)  # funzione che calcola lo stato attuale
    print("stato corrente timeline: ", stato_corrente)
    return render_template("frammenti/timeline.html", stato_corrente=stato_corrente)





@azioni_bp.route("/sessione/<session_id>/invia-lista-esame", methods=["POST"])
@login_required
def invia_lista_esame(session_id):
    # opzionale: tieni fresco il token, anche se l’invio SMTP non lo usa
    _ = ensure_fresh_access_token(skew_sec=60)

    # 1) Recupera l’ultima lista generata per la sessione
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT file_xlsx, file_csv_moodle, num_presenti, generato_da, timestamp_creazione
            FROM liste_generate
            WHERE session_id = %s
            ORDER BY timestamp_creazione DESC
            LIMIT 1
            """,
            (session_id,),
        )
        row = cur.fetchone()

    if not row:
        # nessuna lista generata -> messaggio chiaro nel frammento
        return render_template(
            "frammenti/azioni.html",
            sessione=get_sessione_by_id(session_id),
            stato_corrente="liste_generate",
            messaggio="Nessuna lista generata per questa sessione: crea prima la lista e riprova."
        )

    file_xlsx, file_csv, num_presenti, generato_da, ts = row

    # 2) Prepara allegati (solo quelli che esistono)
    attachments = []
    abs_xlsx = _abs_path(file_xlsx)
    abs_csv  = _abs_path(file_csv)

    # DIAGNOSTICA: mostra base, realpath e listing della cartella
    base = current_app.config.get("FILES_BASE_DIR") or os.path.join(current_app.root_path, "files_liste")
    try:
        listing = ", ".join(sorted(os.listdir(base))[:10])
    except Exception:
        listing = "<impossibile leggere la directory>"

    current_app.logger.warning(
        "[invia-lista] base=%s | xlsx=%s (real=%s exists=%s) | csv=%s (real=%s exists=%s) | primi file in base=[%s]",
        base,
        abs_xlsx, os.path.realpath(abs_xlsx), os.path.exists(abs_xlsx),
        abs_csv,  os.path.realpath(abs_csv),  os.path.exists(abs_csv),
        listing
    )


    print("percorso_xls:",abs_xlsx)
    print("percorso_csv:",abs_csv)
    if abs_xlsx and os.path.exists(abs_xlsx):
        attachments.append(abs_xlsx)
    if abs_csv and os.path.exists(abs_csv):
        attachments.append(abs_csv)

    if not attachments:
        return render_template(
            "frammenti/azioni.html",
            sessione=get_sessione_by_id(session_id),
            stato_corrente="liste_generate",
            messaggio="La lista risulta generata ma i file non sono più presenti sul server."
        )

    # 3) Destinatari: override form -> utenti associati alla commissione
    to_emails = []
    to_override = (request.form.get("to") or "").strip()

    if to_override:
        to_emails = [e.strip() for e in to_override.split(",") if e.strip()]
    else:
        # Destinatari dinamici dalla commissione della sessione corrente.
        with get_db_connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT c.user_email
                FROM sessioni s
                JOIN commissions c ON c.commission_id = s.commission_id
                WHERE s.session_id = %s
                ORDER BY c.user_email
                """,
                (session_id,),
            )
            to_emails = [r[0].strip() for r in cur.fetchall() if r and r[0] and r[0].strip()]

    if not to_emails:
        return render_template(
            "frammenti/azioni.html",
            sessione=get_sessione_by_id(session_id),
            stato_corrente="liste_generate",
            messaggio="Destinatario mancante: nessun utente associato alla commissione oppure campo 'to' non valorizzato."
        )

    # 4) Oggetto e corpo
    sessione = get_sessione_by_id(session_id)
    titolo = getattr(sessione, "nome", None) or getattr(sessione, "session_string", None) or session_id
    subject = f"[Check-in] Lista esame – {titolo}"
    body = (
        f"Ciao,\n\nin allegato la lista esame per la sessione {titolo}.\n"
        f"Presenti: {num_presenti}\nGenerata da: {generato_da}\nData: {ts}\n\n"
        "Cordiali saluti,\nSistema Check-in"
    )

    # 5) Invia email (senza autenticazione, come configurato nel tuo helper)
    current_app.logger.info(
        "[invia-lista-esame] start session_id=%s to=%s cc=%s reply_to=%s allegati=%s",
        session_id,
        ",".join(to_emails),
        session.get("user_email") or "-",
        session.get("user_email") or "-",
        ",".join(os.path.basename(x) for x in attachments),
    )
    try:
        sender_email = (session.get("user_email") or "").strip()
        cc_emails = [sender_email] if sender_email else []
        ok, err = send_notification_email(
            to_emails,
            subject,
            body,
            attachments=attachments,
            cc_emails=cc_emails,
            reply_to=sender_email or None,
            actor_email=sender_email or None,
            source="azioni.invia_lista_esame",
        )
    except Exception:
        current_app.logger.exception(
            "[invia-lista-esame] errore inatteso durante invio session_id=%s",
            session_id,
        )
        ok = False
        err = "Errore inatteso lato server durante invio email (controllare i log)."

    if not ok:
        current_app.logger.warning("[invia-lista-esame] invio KO session_id=%s err=%s", session_id, err)

    # Lo stato avanza sempre: è il segretario che decide di procedere.
    # Se l'email non è partita può scaricare la lista manualmente e inviarla.
    set_stato_corrente(session_id, "liste_inviate", utente=session.get("user_email"))
    stato_corrente = get_stato_corrente(session_id)

    if ok:
        messaggio = "Lista inviata all'esperto informatico via email."
        messaggio_tipo = "success"
    else:
        messaggio = f"Email non inviata ({err}). Scarica la lista manualmente e inviala. Lo stato è stato comunque aggiornato."
        messaggio_tipo = "warning"

    return render_template(
        "frammenti/azioni.html",
        sessione=sessione,
        stato_corrente=stato_corrente,
        messaggio=messaggio,
        messaggio_tipo=messaggio_tipo
    )
