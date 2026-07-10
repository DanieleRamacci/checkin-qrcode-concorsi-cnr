from flask import Blueprint, render_template, abort, jsonify, session, send_file, Response, request, current_app, redirect, url_for
from routes.auth import login_required
from db import get_db_connection
import io, csv, os, re, requests
from datetime import datetime
from utils.stato import get_stato_corrente, get_azioni_per_stato, set_stato_corrente
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, roles_required_any
from utils.sessioni import (
    get_sessione_by_id, get_sessione_config, save_sessione_config,
    get_bando_config, save_bando_config, update_bando_da_openapi,
)
from utils.candidati import importa_candidati_da_api
from utils.liste import get_candidati_by_sessione_checkin, genera_liste_excel_csv
from utils.send_mail import send_notification_email
from utils.oidc import ensure_fresh_access_token, seconds_left
from utils.authorization import commission_access_required, session_access_required
from utils.jconon_service import fetch_bando_metadata


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
@session_access_required()
def download_file(session_id):
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
@session_access_required()
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



@azioni_bp.route("/sessione/<session_id>/moodle-csv", methods=["POST"])
@login_required
@session_access_required()
def genera_moodle_csv(session_id):
    user_email = session.get("user_email")
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



@azioni_bp.route("/sessione/<session_id>/salva_config", methods=["POST"])
@login_required
@session_access_required()
def salva_config(session_id):
    sessione = get_sessione_by_id(session_id)
    if not sessione:
        abort(404)

    # Salva solo i campi per-sessione (informatico in sede + data accesso piattaforma)
    nome_informatico_sede     = request.form.get("nome_informatico_sede", "").strip()
    email_informatico_sede    = request.form.get("email_informatico_sede", "").strip()
    telefono_informatico_sede = request.form.get("telefono_informatico_sede", "").strip()
    data_accesso_piattaforma  = request.form.get("data_accesso_piattaforma", "").strip()

    save_sessione_config(
        session_id, nome_informatico_sede, email_informatico_sede,
        telefono_informatico_sede, data_accesso_piattaforma,
    )
    set_stato_corrente(session_id, "configurata", utente=session.get("user_email"))
    stato_corrente = get_stato_corrente(session_id)

    return render_template(
        "frammenti/azioni.html",
        sessione=sessione,
        stato_corrente=stato_corrente,
        messaggio="Configurazione sessione salvata.",
        messaggio_tipo="success",
    )


def _avanza_sessioni_bando(commission_id: str, user_email: str):
    """Avanza da 'iniziale' a 'configurata' tutte le sessioni del bando."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT session_id FROM sessioni
                WHERE commission_id = %s AND stato_corrente = 'iniziale'
            """, (commission_id,))
            rows = cur.fetchall()
    for row in rows:
        set_stato_corrente(row[0], "configurata", utente=user_email)


def _fetch_bando_da_openapi(commission_id: str, call_code: str, access_token: str) -> dict:
    return fetch_bando_metadata(commission_id, call_code, access_token)




@azioni_bp.route("/bando/<commission_id>/dettaglio")
@login_required
def dettaglio_bando(commission_id):
    from utils.roles import has_role, ROLE_ADMIN
    user_email = session.get("user_email")
    if not has_role(user_email, ROLE_ADMIN):
        abort(403)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT titolo FROM commissions WHERE commission_id = %s LIMIT 1",
                (commission_id,)
            )
            row = cur.fetchone()
    call_code = request.args.get("callCode", "").strip() or (row[0] if row else "")
    if not call_code:
        abort(404)

    access_token = ensure_fresh_access_token(skew_sec=60)
    if not access_token:
        abort(401)

    bando_data = _fetch_bando_da_openapi(commission_id, call_code, access_token)
    rdps         = bando_data.get("rdps", [])
    commissioners = bando_data.get("commissioners", [])

    return render_template(
        "bando_dettaglio.html",
        commission_id=commission_id,
        call_code=call_code,
        rdps=rdps,
        commissioners=commissioners,
    )


@azioni_bp.route("/debug/exam-moodle-sessions/<commission_id>")
@login_required
@roles_required_any([ROLE_ADMIN])
def debug_exam_moodle_sessions(commission_id):
    """Endpoint temporaneo: chiama exam-moodle-sessions e ritorna il JSON grezzo."""
    if not current_app.config.get("DEV_MODE"):
        abort(404)
    session_param = request.args.get("session", "")
    if not session_param:
        return jsonify({"error": "Parametro ?session= obbligatorio"}), 400

    access_token = ensure_fresh_access_token(skew_sec=60)
    if not access_token:
        return jsonify({"error": "Token OIDC non disponibile"}), 401

    base_url = os.environ.get("BASE_URL", "https://cool-jconon.test.si.cnr.it").rstrip("/")
    url = f"{base_url}/openapi/v1/call/exam-moodle-sessions/{commission_id}"
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        resp = requests.post(url, headers=headers, params={"session": session_param}, timeout=(5, 30))
        current_app.logger.info("[debug-moodle] status=%s content-type=%s url=%s",
                                resp.status_code, resp.headers.get("Content-Type"), url)
        current_app.logger.info("[debug-moodle] body=%s", resp.text[:3000])
        return Response(
            resp.text,
            status=resp.status_code,
            mimetype=resp.headers.get("Content-Type", "text/plain"),
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@azioni_bp.route("/bando/<commission_id>/configura", methods=["GET", "POST"])
@login_required
@commission_access_required()
def configura_bando(commission_id):
    user_email = session.get("user_email")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT titolo FROM commissions WHERE commission_id = %s AND user_email = %s",
                (commission_id, user_email),
            )
            row = cur.fetchone()
    if not row:
        abort(403)
    titolo = row[0]

    if request.method == "GET":
        access_token = ensure_fresh_access_token(skew_sec=60)
        fetch_errori = []
        if access_token:
            try:
                from utils.jconon_referenti import fetch_e_salva_bando_meta
                risultato = fetch_e_salva_bando_meta(commission_id, oidc_access_token=access_token)
                fetch_errori = risultato.get("errori", [])
            except Exception as exc:
                fetch_errori = [str(exc)]

            # Popola commissione_members e RDP dall'API /openapi/v1/call
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT titolo FROM commissions WHERE commission_id = %s LIMIT 1",
                        (commission_id,)
                    )
                    titolo_row = cur.fetchone()
            if titolo_row:
                bando_data = _fetch_bando_da_openapi(commission_id, titolo_row[0], access_token)
                if bando_data:
                    update_bando_da_openapi(
                        commission_id,
                        rdps=bando_data.get("rdps", []),
                        commissioners=bando_data.get("commissioners", []),
                    )
        else:
            fetch_errori = ["Token di autenticazione non disponibile."]

    bando_cfg = get_bando_config(commission_id)

    # Lista esperti informatici per il dropdown
    from utils.roles import ROLE_ESPERTO as _ROLE_ESPERTO
    from psycopg2.extras import RealDictCursor
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT user_email FROM user_roles WHERE role = %s ORDER BY user_email",
                (_ROLE_ESPERTO,)
            )
            esperti_list = [r["user_email"] for r in cur.fetchall()]

    if request.method == "POST":
        email_referente      = request.form.get("email_referente", "").strip()
        email_esperto_remoto = request.form.get("email_esperto_remoto", "").strip()
        email_segretario     = request.form.get("email_segretario", "").strip()
        telefono_segretario  = request.form.get("telefono_segretario", "").strip()
        durata_prova_minuti  = request.form.get("durata_prova_minuti", "").strip()
        data_accesso_piattaforma = request.form.get("data_accesso_piattaforma", "").strip()

        # Componenti commissione: liste parallele nome[] + email[]
        nomi_comm   = request.form.getlist("commissione_nome[]")
        emails_comm = request.form.getlist("commissione_email[]")
        commissione_members = [
            {"nome": n.strip(), "email": e.strip()}
            for n, e in zip(nomi_comm, emails_comm)
            if n.strip() or e.strip()
        ]

        save_bando_config(
            commission_id,
            email_referente=email_referente,
            email_esperto_remoto=email_esperto_remoto,
            email_segretario=email_segretario,
            telefono_segretario=telefono_segretario,
            durata_prova_minuti=durata_prova_minuti,
            commissione_members=commissione_members,
            configured_by=user_email,
            data_accesso_piattaforma=data_accesso_piattaforma,
        )
        if email_referente or email_esperto_remoto:
            _avanza_sessioni_bando(commission_id, user_email)

        return redirect(url_for("dashboard.sessioni", commission_id=commission_id))

    return render_template(
        "bando_config.html",
        commission_id=commission_id,
        titolo=titolo,
        cfg=bando_cfg,
        esperti_list=esperti_list,
        fetch_errori=fetch_errori,
        messaggio=request.args.get("msg"),
        messaggio_tipo=request.args.get("msg_tipo", "info"),
    )


@azioni_bp.route("/bando/<commission_id>/richiedi-configurazione", methods=["POST"])
@login_required
@commission_access_required()
def richiedi_configurazione_bando(commission_id):
    """Invia una mail al referente chiedendo di compilare la configurazione del bando."""
    from utils.send_mail import send_notification_email
    from utils.sessioni import email_to_nome

    user_email = session.get("user_email")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT titolo FROM commissions WHERE commission_id = %s AND user_email = %s",
                (commission_id, user_email),
            )
            row = cur.fetchone()
    if not row:
        abort(403)
    titolo = row[0]

    email_referente = request.form.get("email_referente", "").strip()
    if not email_referente:
        return redirect(url_for("azioni.configura_bando", commission_id=commission_id))

    link = url_for("azioni.configura_bando", commission_id=commission_id, _external=True)
    nome_mittente = email_to_nome(user_email)
    corpo = (
        f"Gentile {email_to_nome(email_referente)},\n\n"
        f"ti scrivo per chiederti di inserire i dati di configurazione per il bando:\n"
        f"  {titolo}\n\n"
        f"Puoi accedere alla pagina di configurazione al seguente link:\n"
        f"  {link}\n\n"
        f"Grazie,\n{nome_mittente}"
    )

    ok, err = send_notification_email(
        to_emails=[email_referente],
        subject=f"Richiesta configurazione bando: {titolo}",
        body=corpo,
        actor_email=user_email,
        source="azioni.richiedi_configurazione_bando",
    )

    # Salva anche l'email referente se appena inserita
    cfg = get_bando_config(commission_id)
    if not (cfg and cfg.get("email_referente")):
        save_bando_config(
            commission_id,
            email_referente=email_referente,
            email_esperto_remoto=cfg.get("email_esperto_remoto") if cfg else None,
            email_segretario=cfg.get("email_segretario") if cfg else None,
            configured_by=user_email,
        )

    messaggio = "Email inviata al referente." if ok else f"Errore invio email: {err}"
    messaggio_tipo = "success" if ok else "warning"
    return redirect(url_for(
        "azioni.configura_bando", commission_id=commission_id,
        msg=messaggio, msg_tipo=messaggio_tipo
    ))


@azioni_bp.route("/debug/jconon/<commission_id>", methods=["GET"])
@login_required
@roles_required_any([ROLE_ADMIN])
def debug_jconon(commission_id):
    """Endpoint di diagnostica temporaneo — rimuovere dopo i test."""
    if not current_app.config.get("DEV_MODE"):
        abort(404)
    from utils.jconon_referenti import JCONON_BASE, _make_session_oidc
    from utils.oidc import ensure_fresh_access_token

    access_token = ensure_fresh_access_token(skew_sec=60)
    result = {"commission_id": commission_id, "jconon_base": JCONON_BASE, "steps": {}}

    # Step 1: fetch call detail (OpenAPI, OIDC token)
    sess_oidc = _make_session_oidc(access_token)
    url1 = f"{JCONON_BASE}/openapi/v1/call/{commission_id}"
    try:
        r1 = sess_oidc.get(url1, timeout=10)
        result["steps"]["call_detail"] = {
            "url": url1, "status": r1.status_code,
            "body": r1.json() if r1.headers.get("content-type", "").startswith("application/json") else r1.text[:500]
        }
        rdp_raw = r1.json().get("jconon_call:rdp", "") if r1.ok else ""
    except Exception as e:
        result["steps"]["call_detail"] = {"url": url1, "error": str(e)}
        rdp_raw = ""

    result["rdp_raw"] = rdp_raw

    # Step 1b: scambia OIDC token con ticket Alfresco
    import requests as _req
    alfresco_ticket = ""

    # prova 1: POST /rest/api/login con il token OIDC come password (username=OIDC)
    for login_payload in [
        {"username": "OIDC", "password": access_token},
        {"ticket": access_token},
    ]:
        try:
            rl = _req.post(f"{JCONON_BASE}/rest/api/login",
                           json=login_payload, timeout=10,
                           headers={"Accept": "application/json", "Content-Type": "application/json"})
            result["steps"][f"alfresco_login_{list(login_payload.keys())[0]}"] = {
                "status": rl.status_code,
                "body": rl.json() if rl.headers.get("content-type","").startswith("application/json") else rl.text[:200]
            }
            if rl.ok:
                data = rl.json()
                alfresco_ticket = (data.get("data") or {}).get("ticket", "")
                if alfresco_ticket:
                    break
        except Exception as e:
            result["steps"][f"alfresco_login_{list(login_payload.keys())[0]}"] = {"error": str(e)}

    result["alfresco_ticket_ottenuto"] = bool(alfresco_ticket)

    # Step 2: fetch RDP members con il ticket ottenuto
    if rdp_raw:
        from urllib.parse import quote as _q
        inner_path = f"service/cnr/groups/GROUP_{rdp_raw}/members"
        inner_enc = _q(inner_path, safe="/:@._-~")
        base_url2 = f"{JCONON_BASE}/rest/proxy?url={inner_enc}"
        url2 = base_url2 + (f"&alf_ticket={alfresco_ticket}" if alfresco_ticket else "")
        result["url_rdp_members"] = url2
        try:
            r2 = _req.get(url2, timeout=10, headers={"Accept": "application/json"})
            result["steps"]["rdp_members"] = {
                "status": r2.status_code,
                "body": r2.json() if r2.headers.get("content-type","").startswith("application/json") else r2.text[:300]
            }
        except Exception as e:
            result["steps"]["rdp_members"] = {"error": str(e)}

    return jsonify(result)


@azioni_bp.route("/sessione/<session_id>/scarica_candidati", methods=["POST"])
@login_required
@session_access_required()
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
@session_access_required()
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
@session_access_required()
def api_get_stato(session_id):
    try:
        stato = get_stato_corrente(session_id)
        return jsonify({"stato_corrente": stato})
    except Exception as e:
        return jsonify({"error": str(e)}), 500




@azioni_bp.route("/sessione/<string:session_id>/azioni-frammento")
@login_required
@session_access_required()
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
@session_access_required()
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
@session_access_required()
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
@session_access_required()
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
@session_access_required(allowed_roles={ROLE_ESPERTO, ROLE_ADMIN})
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
@session_access_required(allowed_roles={ROLE_ESPERTO, ROLE_ADMIN})
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
@session_access_required(allowed_roles={ROLE_ESPERTO, ROLE_ADMIN})
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
@session_access_required(allowed_roles={ROLE_ESPERTO, ROLE_ADMIN})
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
@session_access_required()
def timeline_frammento(session_id):
    stato_corrente = get_stato_corrente(session_id)  # funzione che calcola lo stato attuale
    print("stato corrente timeline: ", stato_corrente)
    return render_template("frammenti/timeline.html", stato_corrente=stato_corrente)





@azioni_bp.route("/sessione/<session_id>/invia-lista-esame", methods=["POST"])
@login_required
@session_access_required()
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

    # 3) Destinatari: config sessione (esperto remoto) -> override form -> utenti commissione
    to_emails = []
    to_override = (request.form.get("to") or "").strip()

    if to_override:
        to_emails = [e.strip() for e in to_override.split(",") if e.strip()]
    else:
        # Prima priorità: email esperto remoto configurata per questa sessione
        cfg = get_sessione_config(session_id)
        if cfg and cfg.get("email_esperto_remoto"):
            to_emails = [cfg["email_esperto_remoto"]]
        else:
            # Fallback: utenti associati alla commissione
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
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT titolo FROM commissions WHERE commission_id = %s LIMIT 1",
            (sessione["commission_id"],),
        )
        _row = cur.fetchone()
    titolo_bando = _row[0] if _row else ""
    nome_sessione = sessione.get("nome") or ""
    giorno = sessione.get("giorno") or ""
    ora    = sessione.get("ora") or ""
    luogo  = sessione.get("luogo") or ""

    label_sessione = nome_sessione
    if giorno:
        label_sessione += f" – {giorno}"
        if ora:
            label_sessione += f" {ora}"
    if luogo:
        label_sessione += f" – {luogo}"

    subject = f"[Check-in] Lista esame – {titolo_bando}"
    body = (
        f"Ciao,\n\n"
        f"in allegato la lista esame per:\n"
        f"  Bando: {titolo_bando}\n"
        f"  Sessione: {label_sessione}\n\n"
        f"Presenti: {num_presenti}\n"
        f"Generata da: {generato_da}\n"
        f"Data: {ts}\n\n"
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
