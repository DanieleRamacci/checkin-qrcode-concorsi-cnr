from flask import Blueprint, render_template, abort, jsonify,session, send_file
from routes.auth import login_required
from db import get_db_connection
from utils.stato import get_stato_corrente, get_azioni_per_stato, set_stato_corrente 
from utils.sessioni import get_sessione_by_id
from utils.candidati import importa_candidati_da_api
from utils.liste import genera_liste_excel_csv
from db import get_db_connection
from utils.liste import get_candidati_by_sessione_checkin, get_candidati_per_lista_completa, get_ultima_lista_generata


azioni_bp = Blueprint("azioni", __name__)



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
    try:
        user_email = session.get("user_email")
        set_stato_corrente(session_id, "liste_inviate", utente=user_email)
    except Exception as e:
        print(f"Errore invia_lista_esame: {e}")
        return jsonify({"success": False, "message": str(e)}), 400

    # Recupera sessione aggiornata e stato per il render del frammento
    sessione = get_sessione_by_id(session_id)
    stato_corrente = get_stato_corrente(session_id)
    
    return render_template(
        "frammenti/azioni.html",
        sessione=sessione,
        stato_corrente=stato_corrente
    )
