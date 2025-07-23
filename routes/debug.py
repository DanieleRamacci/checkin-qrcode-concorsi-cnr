from flask import Blueprint, render_template, jsonify
from db import get_db_connection

debug_bp = Blueprint("debug", __name__)

@debug_bp.route("/debug/sessioni")
def debug_sessioni():
    db = get_db_connection()
    with db.cursor() as cursor:
        # Estrai sessioni
        cursor.execute("SELECT * FROM sessioni ORDER BY data_esame DESC, ora DESC")
        sessioni = cursor.fetchall()
        sessioni_colnames = [desc[0] for desc in cursor.description]
        sessioni_data = [dict(zip(sessioni_colnames, row)) for row in sessioni]

        # Estrai log stati
        cursor.execute("SELECT * FROM session_state_log ORDER BY timestamp DESC")
        log = cursor.fetchall()
        log_colnames = [desc[0] for desc in cursor.description]
        log_data = [dict(zip(log_colnames, row)) for row in log]

    db.close()

    return render_template("debug_sessioni.html", sessioni=sessioni_data, logs=log_data)
