from flask import Blueprint, Flask, request, abort, jsonify, send_from_directory, session, redirect, url_for, render_template, current_app
import requests
from datetime import datetime,  timezone
from db import get_db_connection  
from routes.auth import login_required  # è un decoratore deve essere importato 
from urllib.parse import quote
import traceback
from psycopg2.extras import RealDictCursor
import secrets
from utils.device_tokens import is_device_token_valid, make_reg_token, verify_reg_token
from utils.authorization import session_access_required


dispositivi_bp = Blueprint('dispositivi', __name__)
REG_TOKEN_MAX_AGE_SECONDS = 30 * 60
PING_ACTIVE_SECONDS = 90


@dispositivi_bp.route("/api/dispositivo/registrazione", methods=["POST"])
def registra_dispositivo():
    try:
        data = request.get_json()

        ip_address = data.get("ip_address")
        user_agent = data.get("user_agent")
        session_id = data.get("session_id")
        reg_token = data.get("token")
        timestamp = datetime.now(timezone.utc)

        if not session_id or not reg_token:
            return jsonify(success=False, message="Session ID mancante"), 400

        secret_key = current_app.secret_key
        if not secret_key:
            return jsonify(success=False, message="Server non configurato"), 500

        if not verify_reg_token(reg_token, session_id, secret_key, REG_TOKEN_MAX_AGE_SECONDS):
            return jsonify(success=False, message="Token non valido o scaduto"), 403

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 FROM sessioni WHERE session_id = %s", (session_id,))
                if not cursor.fetchone():
                    return jsonify(success=False, message="Sessione non trovata"), 404

                device_token = secrets.token_urlsafe(32)
                cursor.execute(
                    """
                    INSERT INTO dispositivi (ip_address, user_agent, session_id, timestamp, device_token, last_seen, disconnected_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NULL)
                    """,
                    (ip_address, user_agent, session_id, timestamp, device_token, timestamp)
                )
            conn.commit()

        return jsonify(success=True, message="Dispositivo registrato", device_token=device_token)

    except Exception as e:
        print("❌ Errore durante la registrazione del dispositivo:", e)
        traceback.print_exc()
        return jsonify(success=False, message="Errore interno"), 500



@dispositivi_bp.route("/dispositivi/<session_id>")
@login_required
def pagina_dispositivi(session_id):
    return redirect(f"/sessioni/{session_id}/dispositivi")



@dispositivi_bp.route("/frammenti/dispositivi/<session_id>")
@login_required
@session_access_required()
def frammento_dispositivi(session_id):
    try:
        dispositivi = _load_dispositivi_with_status(session_id)
        return render_template("frammenti/dispositivi_tabella.html", dispositivi=dispositivi, sessione_id=session_id)

    except Exception as e:
        print("❌ Errore nel frammento dispositivi:", e)
        return "Errore caricamento tabella", 500


@dispositivi_bp.route("/api/dispositivo/ping", methods=["POST"])
def ping_dispositivo():
    data = request.get_json()
    session_id = data.get("session_id")
    device_token = data.get("device_token")
    if not session_id or not device_token:
        return jsonify(success=False, message="Parametri mancanti"), 400

    now = datetime.now(timezone.utc)
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, device_token, timestamp, disconnected_at
                  FROM dispositivi
                 WHERE session_id = %s
                """,
                (session_id,),
            )
            device = next(
                (
                    row
                    for row in cursor.fetchall()
                    if is_device_token_valid(
                        device_token,
                        stored_token=row[1],
                        issued_at=row[2],
                        disconnected_at=row[3],
                        now=now,
                    )
                ),
                None,
            )
            if not device:
                return jsonify(success=False, message="Dispositivo non autorizzato"), 403
            cursor.execute("""
                UPDATE dispositivi
                   SET last_seen = %s
                 WHERE id = %s AND disconnected_at IS NULL
            """, (now, device[0]))
        conn.commit()

    return jsonify(success=True)


@dispositivi_bp.route("/api/dispositivo/disconnetti", methods=["POST"])
def disconnetti_dispositivo():
    data = request.get_json()
    session_id = data.get("session_id")
    device_token = data.get("device_token")
    if not session_id or not device_token:
        return jsonify(success=False, message="Parametri mancanti"), 400

    now = datetime.now(timezone.utc)
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, device_token, timestamp, disconnected_at
                  FROM dispositivi
                 WHERE session_id = %s
                """,
                (session_id,),
            )
            device = next(
                (
                    row
                    for row in cursor.fetchall()
                    if is_device_token_valid(
                        device_token,
                        stored_token=row[1],
                        issued_at=row[2],
                        disconnected_at=row[3],
                        now=now,
                    )
                ),
                None,
            )
            if not device:
                return jsonify(success=False, message="Dispositivo non autorizzato"), 403
            cursor.execute("""
                UPDATE dispositivi
                   SET disconnected_at = %s
                 WHERE id = %s AND disconnected_at IS NULL
            """, (now, device[0]))
        conn.commit()

    return jsonify(success=True)


def _load_dispositivi_with_status(session_id):
    now = datetime.now(timezone.utc)
    cutoff = now.timestamp() - PING_ACTIVE_SECONDS
    dispositivi = []

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT timestamp, nome_dispositivo, user_agent, ip_address, last_seen, disconnected_at
                FROM dispositivi
                WHERE session_id = %s
            """, (session_id,))
            rows = cursor.fetchall()

    for d in rows:
        last_seen = d.get("last_seen")
        disconnected_at = d.get("disconnected_at")
        if disconnected_at:
            status = "disconnected"
            status_label = "disconnesso"
        elif last_seen and last_seen.timestamp() >= cutoff:
            status = "online"
            status_label = "connesso"
        else:
            status = "offline"
            status_label = "offline"

        d["status"] = status
        d["status_label"] = status_label
        dispositivi.append(d)

    rank = {"online": 0, "offline": 1, "disconnected": 2}
    def _sort_key(row):
        ts = row.get("last_seen") or row.get("timestamp") or datetime.min.replace(tzinfo=timezone.utc)
        return (rank.get(row["status"], 9), -ts.timestamp())
    dispositivi.sort(key=_sort_key)
    return dispositivi
