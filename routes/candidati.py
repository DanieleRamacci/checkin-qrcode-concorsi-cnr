from flask import Blueprint, Flask, make_response, request, abort, jsonify, send_from_directory, session, redirect, url_for, render_template
import requests
import os
from datetime import datetime
from db import get_db_connection  # se hai una funzione centralizzata
from routes.auth import login_required  # è un decoratore deve essere importato 
from urllib.parse import quote
from utils.candidati import importa_candidati_da_api 
from utils.stato import get_stato_corrente
from utils.commissioni import  now_iso_utc
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, roles_required_any
from utils.notifications import add_notification

BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')


candidati_bp = Blueprint('candidati', __name__)


def _sessione_autorizzata(session_id, user_email):
    if not session_id or not user_email:
        return False
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 1
                FROM sessioni s
                JOIN commissions c ON c.commission_id = s.commission_id
                WHERE s.session_id = %s AND c.user_email = %s
                LIMIT 1
            """, (session_id, user_email))
            return cur.fetchone() is not None


def _render_reset_list(session_id, view_mode, q="", filtro="all"):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            where = ["session_id = %s", "COALESCE(checkin_effettuato, FALSE) = TRUE"]
            params = [session_id]
            if q:
                like = f"%{q.lower()}%"
                where.append("(LOWER(first_name) LIKE %s OR LOWER(last_name) LIKE %s OR LOWER(document_number) LIKE %s)")
                params += [like, like, like]

            if filtro in ("richiesto", "da_evade"):
                where.append("COALESCE(reset_password_richiesto, FALSE) = TRUE")
                if view_mode == "esperto":
                    where.append("COALESCE(reset_password_effettuato, FALSE) = FALSE")
            elif filtro in ("effettuato", "evasi"):
                where.append("COALESCE(reset_password_effettuato, FALSE) = TRUE")

            query = f"""
                SELECT uid, first_name, last_name, document_number,
                       COALESCE(checkin_effettuato, FALSE) AS checkin_effettuato,
                       COALESCE(reset_password_richiesto, FALSE) AS reset_password_richiesto,
                       reset_password_richiesto_at, reset_password_richiesto_by,
                       COALESCE(reset_password_effettuato, FALSE) AS reset_password_effettuato,
                       reset_password_effettuato_at, reset_password_effettuato_by
                FROM candidati
                WHERE {" AND ".join(where)}
                ORDER BY
                  COALESCE(reset_password_richiesto, FALSE) DESC,
                  COALESCE(reset_password_effettuato, FALSE) ASC,
                  last_name ASC, first_name ASC
            """
            cur.execute(query, params)
            rows = cur.fetchall()
    candidati = [
        {
            "uid": r[0],
            "first_name": r[1],
            "last_name": r[2],
            "document_number": r[3],
            "checkin_effettuato": bool(r[4]),
            "reset_password_richiesto": bool(r[5]),
            "reset_password_richiesto_at": r[6],
            "reset_password_richiesto_by": r[7],
            "reset_password_effettuato": bool(r[8]),
            "reset_password_effettuato_at": r[9],
            "reset_password_effettuato_by": r[10],
        }
        for r in rows
    ]
    return render_template(
        "frammenti/reset_password_list.html",
        candidati=candidati,
        session_id=session_id,
        view_mode=view_mode,
        q=q,
        filtro=filtro
    )

def _device_authorized(session_id: str, device_token: str) -> bool:
    if not session_id or not device_token:
        return False
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 1
                FROM dispositivi
                WHERE session_id = %s AND device_token = %s
                LIMIT 1
            """, (session_id, device_token))
            return cursor.fetchone() is not None

def _checkin_gate(session_id: str):
    stato_corrente = get_stato_corrente(session_id)
    if stato_corrente is None:
        return False, stato_corrente, "Sessione non trovata."
    if stato_corrente == "checkin_avviato":
        return True, stato_corrente, None
    if stato_corrente == "checkin_concluso":
        return False, stato_corrente, "Check-in concluso: impossibile registrare utenti."
    return False, stato_corrente, "Check-in non ancora avviato."


@candidati_bp.route("/checkin-candidato", methods=["POST"])
def checkin_candidato():
    data = request.json
    uid = data.get("uid")
    session_id = data.get("session_id")
    device_token = data.get("device_token")

    if not uid or not session_id or not device_token:
        return jsonify(success=False, message="Parametri mancanti."), 400
    if not _device_authorized(session_id, device_token):
        return jsonify(success=False, message="Dispositivo non autorizzato."), 403
    checkin_allowed, stato_corrente, blocco_msg = _checkin_gate(session_id)
    if not checkin_allowed:
        return jsonify(
            success=False,
            message=blocco_msg,
            checkin_allowed=False,
            stato_corrente=stato_corrente
        ), 403

    try:
        with get_db_connection() as conn:
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


@candidati_bp.route("/verifica-candidato", methods=["POST"])
def verifica_candidato():
    data = request.json
    uid = data.get("uid")
    session_id = data.get("session_id")
    device_token = data.get("device_token")

    if not uid or not session_id or not device_token:
        return jsonify(success=False, message="Parametri mancanti."), 400
    if not _device_authorized(session_id, device_token):
        return jsonify(success=False, message="Dispositivo non autorizzato."), 403

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT first_name, last_name, document_number, document_date, checkin_effettuato
                    FROM candidati 
                    WHERE uid = %s AND session_id = %s
                """, (uid, session_id))
                candidato = cursor.fetchone()

                if not candidato:
                    return jsonify(success=False, message="Candidato non trovato o non appartiene alla sessione."), 404

                nome, cognome, numero_documento, document_date, checkin_effettuato = candidato

                # Calcola se il documento è scaduto (formato dd/mm/YYYY)
                documento_scaduto = False
                if document_date:
                    try:
                        from datetime import datetime, date
                        data_doc = datetime.strptime(document_date, "%d/%m/%Y").date()
                        documento_scaduto = data_doc < date.today()
                    except Exception:
                        documento_scaduto = True  # se parsing fallisce consideralo scaduto

                checkin_allowed, stato_corrente, blocco_msg = _checkin_gate(session_id)

                candidato_payload = {
                    "nome": nome,
                    "cognome": cognome,
                    "numero_documento": numero_documento,
                    "documento_scaduto": documento_scaduto,
                    "checkin_effettuato": bool(checkin_effettuato),
                    "session_id": session_id
                }

                if checkin_effettuato:
                    return jsonify(
                        success=False,
                        message="Candidato già registrato al check-in.",
                        candidato=candidato_payload,
                        checkin_allowed=checkin_allowed,
                        stato_corrente=stato_corrente,
                        checkin_block_message=blocco_msg if not checkin_allowed else None
                    ), 409

                if not checkin_allowed:
                    return jsonify(
                        success=False,
                        message=blocco_msg,
                        candidato=candidato_payload,
                        checkin_allowed=False,
                        stato_corrente=stato_corrente,
                        checkin_block_message=blocco_msg
                    ), 403

                return jsonify(success=True, candidato={
                    "nome": nome,
                    "cognome": cognome,
                    "numero_documento": numero_documento,
                    "documento_scaduto": documento_scaduto,
                    "checkin_effettuato": False,
                    "session_id": session_id
                }, checkin_allowed=True, stato_corrente=stato_corrente)
    except Exception as e:
        return jsonify(success=False, message=f"Errore server: {str(e)}"), 500

@candidati_bp.route("/sessione/<session_id>/tabella_candidati", methods=["GET"])
@login_required
def frammento_tabella_candidati(session_id):
    from datetime import datetime
    from psycopg2.extras import RealDictCursor

    # --- querystring ---
    q            = (request.args.get('q') or '').strip()
    sort         = request.args.get('sort', 'alpha')       # alpha | checkin_no | checkin_yes
    checkin_f    = request.args.get('checkin', 'all')      # all | yes | no
    expired_only = request.args.get('expired_only') == '1'  # True/False

    # --- build WHERE dinamico ---
    where   = ["c.session_id = %s"]
    params  = [session_id]

    if q:
        like = f"%{q.lower()}%"
        where.append("(LOWER(c.first_name) LIKE %s OR LOWER(c.last_name) LIKE %s OR LOWER(c.document_number) LIKE %s)")
        params += [like, like, like]

    if checkin_f == 'yes':
        where.append("c.checkin_effettuato = TRUE")
    elif checkin_f == 'no':
        where.append("c.checkin_effettuato = FALSE")

    # --- ORDER BY ---
    if sort == 'checkin_no':
        order_by = "c.checkin_effettuato ASC, c.last_name ASC, c.first_name ASC"   # prima non effettuati
    elif sort == 'checkin_yes':
        order_by = "c.checkin_effettuato DESC, c.last_name ASC, c.first_name ASC"  # prima effettuati
    else:
        order_by = "c.last_name ASC, c.first_name ASC"  # default A→Z

    sql = f"""
        SELECT
            c.uid AS candidato_id,            
            c.first_name,
            c.last_name,
            c.document_number,
            c.document_date,                
            c.checkin_effettuato
        FROM candidati c
        WHERE {" AND ".join(where)}
        ORDER BY {order_by}
    """

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(sql, params)
            righe = cursor.fetchall()

    # --- arricchimento: validità documento (in Python perché document_date è testo) ---
    candidati = []
    oggi = datetime.now().date()
    for r in righe:
        doc_str = r.get("document_date")
        validita_documento = 'scaduto'
        if doc_str:
            try:
                data_doc = datetime.strptime(doc_str, "%d/%m/%Y").date()
                validita_documento = 'valido' if data_doc >= oggi else 'scaduto'
            except Exception:
                # parsing fallito => consideriamo scaduto
                validita_documento = 'scaduto'

        # filtro "solo scaduti"
        if expired_only and validita_documento == 'valido':
            continue

        candidati.append({
            "candidato_id": r["candidato_id"],
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "document_number": r["document_number"],
            "checkin_effettuato": r["checkin_effettuato"],
            "validita_documento": validita_documento,
        })

    return render_template(
        "frammenti/tabella_candidati.html",
        sessione_id=session_id,          # per i pulsanti/toggle
        candidati=candidati,
        # stato filtri per mantenerli nel form
        q=q,
        sort=sort,
        checkin=checkin_f,
        expired_only=expired_only
    )




@candidati_bp.route('/get-candidati', methods=['GET'])
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

        with get_db_connection() as conn:
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
                api_url = f"{BASE_URL}/openapi/v1/call/exam-sessions/{commission_id}?session={encoded_session}"
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

                # Verifica completezza import: i candidati nel DB devono combaciare con quelli ricevuti.
                cursor.execute("SELECT COUNT(*) FROM candidati WHERE session_id = %s", (session_id,))
                db_count = cursor.fetchone()[0]
                expected = len(candidati)
                if db_count != expected:
                    return jsonify({
                        "success": False,
                        "message": f"Import parziale: attesi {expected}, presenti {db_count}."
                    }), 500

                # Aggiorna stato sessione
                cursor.execute("""
                        UPDATE sessioni
                        SET candidati_importati = TRUE,
                            sync_user_email = %s,
                            data_sync = %s
                        WHERE session_id = %s
                    """, (user_email, now_iso_utc(), session_id))

                conn.commit()

                return jsonify({
                    "success": True,
                    "message": f"{inseriti} candidati importati correttamente dal file JSON."
                })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500



# routes/candidati.py

@candidati_bp.route('/sessione/<session_id>/candidato/<candidato_uid>/toggle_checkin', methods=['POST'])
@login_required
def toggle_checkin(session_id, candidato_uid):
    from psycopg2.extras import RealDictCursor

    checkin_allowed, stato_corrente, blocco_msg = _checkin_gate(session_id)
    if not checkin_allowed:
        return render_template("error_fragment.html", message=blocco_msg), 403

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1) esiste ed è della sessione?
            cur.execute("""
                SELECT uid, COALESCE(checkin_effettuato, FALSE) AS checkin_effettuato
                FROM candidati
                WHERE uid = %s AND session_id = %s
                LIMIT 1
            """, (candidato_uid, session_id))
            row = cur.fetchone()
            if not row:
                return ("Candidato non trovato nella sessione", 404)

            # 2) toggle
            cur.execute("""
                UPDATE candidati
                   SET checkin_effettuato = NOT COALESCE(checkin_effettuato, FALSE)
                 WHERE uid = %s AND session_id = %s
            """, (candidato_uid, session_id))
            conn.commit()

    # 3) risposta HTMX: ricarica tabella con i filtri correnti
    resp = make_response("", 204)
    resp.headers['HX-Trigger'] = 'candidatiAggiornati'
    return resp


@candidati_bp.route('/sessione/<session_id>/reset-password-frammento', methods=['GET'])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def reset_password_frammento(session_id):
    user_email = session.get("user_email")
    if not _sessione_autorizzata(session_id, user_email):
        return ("Utente non autorizzato", 403)
    view_mode = request.args.get("view", "sede")
    q = (request.args.get("q") or "").strip()
    filtro = request.args.get("filtro") or ("da_evade" if view_mode == "esperto" else "all")
    return _render_reset_list(session_id, view_mode, q=q, filtro=filtro)


@candidati_bp.route('/sessione/<session_id>/candidato/<candidato_uid>/reset_password', methods=['POST'])
@login_required
@roles_required_any([ROLE_ESPERTO, ROLE_ADMIN])
def toggle_reset_password(session_id, candidato_uid):
    user_email = session.get("user_email")
    if not _sessione_autorizzata(session_id, user_email):
        return ("Utente non autorizzato", 403)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT first_name, last_name,
                       COALESCE(reset_password_richiesto, FALSE),
                       COALESCE(reset_password_effettuato, FALSE)
                FROM candidati
                WHERE uid = %s AND session_id = %s
                LIMIT 1
            """, (candidato_uid, session_id))
            row = cur.fetchone()
            if not row:
                return ("Candidato non trovato nella sessione", 404)

            first_name, last_name, current_flag, current_done = row
            view_mode = request.args.get("view", "sede")
            if view_mode == "esperto":
                new_done = not bool(current_done)
                cur.execute("""
                    UPDATE candidati
                    SET reset_password_effettuato = %s,
                        reset_password_effettuato_at = CASE WHEN %s THEN NOW() ELSE NULL END,
                        reset_password_effettuato_by = CASE WHEN %s THEN %s ELSE NULL END,
                        reset_password_richiesto = CASE WHEN %s THEN FALSE ELSE reset_password_richiesto END,
                        reset_password_richiesto_at = CASE WHEN %s THEN NULL ELSE reset_password_richiesto_at END,
                        reset_password_richiesto_by = CASE WHEN %s THEN NULL ELSE reset_password_richiesto_by END
                    WHERE uid = %s AND session_id = %s
                """, (
                    new_done, new_done, new_done, user_email,
                    new_done, new_done, new_done,
                    candidato_uid, session_id
                ))
                action_msg = "Reset password effettuato" if new_done else "Reset password riaperto"
            else:
                new_flag = not bool(current_flag)
                cur.execute("""
                    UPDATE candidati
                    SET reset_password_richiesto = %s,
                        reset_password_richiesto_at = CASE WHEN %s THEN NOW() ELSE NULL END,
                        reset_password_richiesto_by = CASE WHEN %s THEN %s ELSE NULL END,
                        reset_password_effettuato = CASE WHEN %s THEN FALSE ELSE reset_password_effettuato END,
                        reset_password_effettuato_at = CASE WHEN %s THEN NULL ELSE reset_password_effettuato_at END,
                        reset_password_effettuato_by = CASE WHEN %s THEN NULL ELSE reset_password_effettuato_by END
                    WHERE uid = %s AND session_id = %s
                """, (
                    new_flag, new_flag, new_flag, user_email,
                    new_flag, new_flag, new_flag,
                    candidato_uid, session_id
                ))
                action_msg = "Reset password richiesto" if new_flag else "Reset password rimosso"
        conn.commit()

    add_notification(
        session_id,
        "reset",
        payload=f"{action_msg}: {first_name} {last_name}",
        author_email=user_email
    )

    view_mode = request.args.get("view", "sede")
    q = (request.args.get("q") or "").strip()
    filtro = request.args.get("filtro") or ("da_evade" if view_mode == "esperto" else "all")
    return _render_reset_list(session_id, view_mode, q=q, filtro=filtro)
