from flask import Blueprint, render_template, request, session, redirect, url_for
from psycopg2.extras import RealDictCursor
from routes.auth import login_required
from db import get_db_connection 
from utils.commissioni import get_commissioni_sincronizzate
from utils.sessioni import get_sessioni_internamente

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/')
@login_required
def index():
    user_email = session.get('user_email')
    access_token = session.get('access_token')

    if not access_token or not user_email:
        return redirect(url_for('auth.login'))

    commissioni = get_commissioni_sincronizzate(access_token, user_email)

    if commissioni is None:
        session.clear()
        return redirect(url_for('auth.login'))

    return render_template('dashboard.html', commissioni=commissioni, user_email=user_email, active_page="dashboard")






@dashboard_bp.route('/sessioni')
@login_required
def sessioni():
    commission_id = request.args.get('commission_id')
    if not commission_id:
        return "Commission ID mancante", 400

    access_token = session.get('access_token')
    user_email = session.get('user_email')

    # Sincronizza se necessario
    get_sessioni_internamente(commission_id, access_token, user_email)

    sessioni = []
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT s.session_id, s.nome, s.giorno, s.ora, s.luogo, s.attiva
                    FROM sessioni s
                    JOIN commissions c
                    ON c.commission_id = s.commission_id
                    WHERE s.commission_id = %s
                    AND c.user_email   = %s            -- utente corrente autorizzato
                    ORDER BY s.data_esame
                """, (commission_id, user_email))
                sessioni = cursor.fetchall()
    except Exception as e:
        return f"Errore durante il recupero delle sessioni: {str(e)}", 500

    return render_template('sessioni.html', sessioni=sessioni, commission_id=commission_id)




####api di test per react 
@dashboard_bp.route('/api/commissioni')
@login_required
def api_commissioni():
    user_email = session.get('user_email')
    access_token = session.get('access_token')

    if not access_token or not user_email:
        return {"error": "Unauthorized"}, 401

    commissioni = get_commissioni_sincronizzate(access_token, user_email)

    if commissioni is None:
        return {"error": "Errore nel recupero delle commissioni"}, 500

    return {"commissioni": commissioni}
