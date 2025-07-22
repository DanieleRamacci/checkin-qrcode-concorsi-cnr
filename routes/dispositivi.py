from flask import Blueprint, Flask, request, abort, jsonify, send_from_directory, session, redirect, url_for, render_template
import requests
from datetime import datetime,  timezone
from db import get_db_connection  
from routes.auth import login_required  # è un decoratore deve essere importato 
from urllib.parse import quote
import traceback
from psycopg2.extras import RealDictCursor


dispositivi_bp = Blueprint('dispositivi', __name__)


@dispositivi_bp.route("/api/dispositivo/registrazione", methods=["POST"])
def registra_dispositivo():
    try:
        data = request.get_json()

        ip_address = data.get("ip_address")
        user_agent = data.get("user_agent")
        session_id = data.get("session_id")
        timestamp = datetime.now(timezone.utc)

        if not session_id:
            return jsonify(success=False, message="Session ID mancante"), 400

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO dispositivi (ip_address, user_agent, session_id, timestamp)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (ip_address, user_agent, session_id, timestamp)
                )
            conn.commit()

        return jsonify(success=True, message="Dispositivo registrato")

    except Exception as e:
        print("❌ Errore durante la registrazione del dispositivo:", e)
        traceback.print_exc()
        return jsonify(success=False, message="Errore interno"), 500


@dispositivi_bp.route("/dispositivi/<session_id>")
@login_required
def pagina_dispositivi(session_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Recupera info sessione
                cursor.execute("SELECT * FROM sessioni WHERE session_id = %s", (session_id,))
                sessione = cursor.fetchone()
                if not sessione:
                    abort(404, description="Sessione non trovata")

                # Recupera dispositivi associati
                cursor.execute("""
                    SELECT timestamp, nome_dispositivo, user_agent, ip_address
                    FROM dispositivi
                    WHERE session_id = %s
                    ORDER BY timestamp DESC
                """, (session_id,))
                dispositivi = cursor.fetchall()

        # Costruzione QR code e link
        qr_url = url_for("genera_qr_code", session_id=session_id)
        qr_url_text = qr_url

        return render_template(
            "dispositivi.html",
            sessione=sessione,
            dispositivi=dispositivi,
            qr_url=qr_url,
            qr_url_text=qr_url_text
        )

    except Exception as e:
        print("❌ Errore:", e)
        traceback.print_exc()
        abort(500)
