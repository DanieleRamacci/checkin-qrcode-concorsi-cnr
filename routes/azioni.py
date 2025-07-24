from flask import Blueprint, render_template, abort, jsonify,session
from routes.auth import login_required
from db import get_db_connection
from utils.stato import get_stato_corrente, get_azioni_per_stato, set_stato_corrente 
from utils.sessioni import get_sessione_by_id
from utils.candidati import importa_candidati_da_api



azioni_bp = Blueprint("azioni", __name__)

 

@azioni_bp.route("/sessione/<session_id>/scarica_candidati", methods=["POST"])
@login_required
def scarica_candidati(session_id):
    try:
       
        user_email = session.get('user_email')
        access_token = session.get('token')

        if not user_email or not access_token:
            return jsonify({"success": False, "message": "Token o email non presenti nella sessione"}), 401

        risultato = importa_candidati_da_api(session_id, user_email, access_token)
        
        # Se tutto ok, aggiorna lo stato
        if risultato["success"]:
            set_stato_corrente(session_id, "candidati_scaricati", utente=user_email)
            return jsonify(risultato)
        else:
            return jsonify(risultato), 400

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500




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
    print("stato sessione", stato_corrente)
    return render_template("frammenti/azioni.html", sessione=sessione, stato_corrente=stato_corrente)



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
    return jsonify({"success": True, "message": "Check-in avviato con successo!"})


@azioni_bp.route("/sessione/<session_id>/concludi_checkin", methods=["POST"])
@login_required
def concludi_checkin(session_id):
    user_email = session.get("user_email")
    if not user_email:
        return jsonify({"success": False, "message": "Utente non autenticato"}), 401

    set_stato_corrente(session_id, "checkin_concluso", utente=user_email)
    return jsonify({"success": True, "message": "Check-in concluso con successo!"})


@azioni_bp.route("/sessione/<session_id>/genera_liste", methods=["POST"])
@login_required
def genera_liste(session_id):
    return jsonify({"status": "ok", "message": "Funzione non ancora implementata."})

