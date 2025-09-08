from flask import Blueprint, render_template, abort, jsonify,session, send_file, abort, Response ,request, current_app, make_response, render_template, sessions
from routes.auth import login_required
from db import get_db_connection
import io, csv, os, re , requests
from datetime import datetime
from requests.auth import HTTPBasicAuth
from utils.stato import get_stato_corrente, get_azioni_per_stato, set_stato_corrente 
from utils.sessioni import get_sessione_by_id
from utils.candidati import importa_candidati_da_api
from utils.liste import genera_liste_excel_csv
from db import get_db_connection
from utils.liste import get_candidati_by_sessione_checkin, get_ultima_lista_generata, genera_liste_excel_csv, get_lista_by_id, get_liste_generate
from utils.send_mail import send_notification_email
from urllib.parse import quote


azioni_bp = Blueprint("azioni", __name__)

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

@login_required
@azioni_bp.route("/sessione/<session_id>/moodle-csv", methods=["POST"])
def genera_moodle_csv(session_id):
    # -- Autorizzazione utente sulla commissione della sessione --
    user_email = session.get("user_email")
    if not _check_auth_for_session(session_id, user_email):
        abort(403)

    access_token = session.get("access_token")
    if not access_token:
        return Response("Autenticazione mancante.", status=401)

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

    # -- 1) PRNDI CANDIDATI dalla API JSON con Bearer --
    base_url = os.environ.get("BASE_URL", "https://cool-jconon.test.si.cnr.it")
    encoded_session = quote(session_string, safe='')
    api_url = f"{base_url}/openapi/v1/call/exam-sessions/{commission_id}?session={encoded_session}"
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "*/*"}

    try:
        res = requests.get(api_url, headers=headers, timeout=30)
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
    present_usernames = { (c.get("uid") or "").strip().lower() for c in presenti if c.get("uid") }

    # -- 3) Prepara righe CSV per candidati --
    # Colonne Moodle richieste
    fieldnames = ["username","firstname","lastname","password","course1","role1","course2","role2","enrolstatus2","email"]

    rows = []
    course1 = "esercitazione"
    role1   = "esercitazione"
    course2 = str(titolo_bando)  # es: "Bando999.999" (se il titolo non è già così, va bene anche il titolo intero)
    password = "esercitazione"

    for c in candidati_raw:
        # l'API può dare diverse chiavi; gestiamo varianti comuni
        uid   = (c.get("uid") or c.get("username") or "").strip()
        email = (c.get("email") or "").strip()
        # nomi: se non ci sono, prova a derivarli
        first = (c.get("first_name") or c.get("firstname") or c.get("firstName") or "").strip()
        last  = (c.get("last_name")  or c.get("lastname")  or c.get("lastName")  or "").strip()
        if not (first or last):
            # fallback: prova da email
            if email:
                first, last = _split_name_from_email(email)
            elif uid:
                # ultimo fallback: deriviamo i nomi dall'uid
                if '.' in uid:
                    f, l = uid.split('.', 1)
                    first, last = (f or '').upper(), (l or '').upper()
                else:
                    first, last = uid.upper(), ""

        username = uid or (email.split('@',1)[0] if email else "")
        username_l = username.lower()
        enrolstatus2 = "0" if username_l in present_usernames else "1"

        rows.append({
            "username": username,
            "firstname": first if first else "",
            "lastname":  last if last else "",
            "password": password,
            "course1":  course1,
            "role1":    role1,
            "course2":  course2,
            "role2":    "candidato",
            "enrolstatus2": enrolstatus2,
            "email":    email
        })

    # -- 4) Aggiungi VALUTATORI (tutti gli user_email della commissione) --
    #      Se hai una tabella ruoli, filtra qui; altrimenti tutti come 'valutatore'.
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT DISTINCT user_email FROM commissions WHERE commission_id = %s", (commission_id,))
        valutatori_emails = [r[0] for r in cur.fetchall()]

    for vmail in valutatori_emails:
        if not vmail:
            continue
        username = vmail.split('@',1)[0]
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
            "email":     vmail
        })

    # -- 5) Scrivi CSV in memoria e invia come download --
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
        access_token = session.get('token')

        if not user_email or not access_token:
            return render_template("error_fragment.html", message="Autenticazione mancante"), 401

        risultato = importa_candidati_da_api(session_id, user_email, access_token)

        if risultato["success"]:
            set_stato_corrente(session_id, "candidati_scaricati", utente=user_email)
            sessione = get_sessione_by_id(session_id)
            return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente="candidati_scaricati")
                
        else:
            return render_template("error_fragment.html", message=risultato["message"]), 400

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
                            numero_dispositivi_connessi=numero_dispositivi

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




@azioni_bp.route("/sessione/<session_id>/timeline-frammento")
@login_required
def timeline_frammento(session_id):
    stato_corrente = get_stato_corrente(session_id)  # funzione che calcola lo stato attuale
    print("stato corrente timeline: ", stato_corrente)
    return render_template("frammenti/timeline.html", stato_corrente=stato_corrente)




@azioni_bp.route("/sessione/<session_id>/genera_liste", methods=["POST"])
@login_required
def genera_liste(session_id):
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"success": False, "message": "Utente non autenticato"}), 401
    # Verifica che il check-in sia stato concluso
    stato_corrente = get_stato_corrente(session_id)
    if stato_corrente != "checkin_concluso":
        messaggio = "Il check-in non è ancora concluso. Non puoi generare le liste."
        sessione = get_sessione_by_id(session_id)
        return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente=stato_corrente, messaggio=messaggio)


    # Recupera i candidati che hanno fatto il check-in
    candidati = get_candidati_by_sessione_checkin(session_id)

    if not candidati:
        messaggio = "Nessun candidato ha ancora effettuato il check-in. Non è possibile generare le liste."
        sessione = get_sessione_by_id(session_id)
        stato_corrente = get_stato_corrente(session_id)
        return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente=stato_corrente, messaggio=messaggio)


    # Genera i file
    risultati = genera_liste_excel_csv(session_id, candidati)

    # Salva nel DB
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO liste_generate (session_id, file_xlsx, file_csv_moodle, num_presenti, generato_da)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            session_id,
            risultati["file_xlsx"],
            risultati["file_csv_moodle"],
            risultati["num_presenti"],
            user_email
        )
    )
    conn.commit()
    cur.close()
    conn.close()

    # Usa la funzione centralizzata per aggiornare lo stato
    try:
        set_stato_corrente(session_id, "liste_generate", utente=user_email)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400


    # Ritorna il frammento aggiornato
    sessione = get_sessione_by_id(session_id)
    stato_corrente = get_stato_corrente(session_id)
    return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente=stato_corrente)




@azioni_bp.route("/sessione/<session_id>/invia-lista-esame", methods=["POST"])
@login_required
def invia_lista_esame(session_id):
    # 1) Leggi quale lista inviare
    lista_id = request.form.get("lista_id")
    if not lista_id:
        # fallback: puoi rifiutare o usare l’ultima lista
        return render_template(
            "frammenti/azioni.html",
            sessione=get_sessione_by_id(session_id),
            stato_corrente="liste_generate",
            messaggio="Seleziona una lista da inviare."
        ), 400

    # 2) Recupera e valida che la lista appartenga alla sessione
    lista = get_lista_by_id(session_id, lista_id)   # implementa/usa questa funzione
    if not lista:
        return render_template(
            "frammenti/azioni.html",
            sessione=get_sessione_by_id(session_id),
            stato_corrente="liste_generate",
            messaggio="Lista non trovata per questa sessione."
        ), 404

    # 3) Costruisci il percorso del CSV da allegare
    if not getattr(lista, "file_csv_moodle", None):
        return render_template(
            "frammenti/azioni.html",
            sessione=get_sessione_by_id(session_id),
            stato_corrente="liste_generate",
            messaggio="File CSV Moodle non disponibile per la lista selezionata."
        ), 400

    file_path = os.path.join(current_app.static_folder, lista.file_csv_moodle)
    if not os.path.exists(file_path):
        return render_template(
            "frammenti/azioni.html",
            sessione=get_sessione_by_id(session_id),
            stato_corrente="liste_generate",
            messaggio=f"File non trovato: {lista.file_csv_moodle}"
        ), 400

    # 4) Invia email all’esperto
    destinatario = os.environ.get("ESPERTO_EMAIL")
    if not destinatario:
        return render_template(
            "frammenti/azioni.html",
            sessione=get_sessione_by_id(session_id),
            stato_corrente="liste_generate",
            messaggio="Configurare ESPERTO_EMAIL nelle variabili d'ambiente."
        ), 500

    try:
        send_notification_email(
            to_emails=[destinatario],
            subject=f"Lista candidati – sessione {session_id} (lista {lista.id})",
            body=(
                f"Gentile esperto,\n"
                f"in allegato la lista dei candidati per la sessione {session_id}.\n"
                f"Presenti: {getattr(lista, 'num_presenti', 'N/D')}.\n"
            ),
            attachments=[file_path]
        )
        # 5) Solo se ok → aggiorno stato
        set_stato_corrente(session_id, "liste_inviate", utente=session.get("user_email"))
        stato = "liste_inviate"
        msg = None
        status_code = 200
    except Exception as e:
        stato = "liste_generate"
        msg = f"Errore invio email: {e}"
        status_code = 400

    # 6) Rendi di nuovo il frammento + trigger per ricaricare timeline
    html = render_template(
        "frammenti/azioni.html",
        sessione=get_sessione_by_id(session_id),
        stato_corrente=stato,
        messaggio=msg,
        numero_dispositivi_connessi=conta_dispositivi(session_id),
        get_ultima_lista_generata=get_ultima_lista_generata,
        get_liste_generate=get_liste_generate  # se usi la select
    )
    resp = make_response(html, status_code)
    resp.headers["HX-Trigger"] = "azioniAggiornate"
    return resp




