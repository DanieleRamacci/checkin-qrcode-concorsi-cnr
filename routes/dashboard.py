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
                    SELECT session_id, nome, giorno, ora, luogo, attiva
                    FROM sessioni
                    WHERE commission_id = %s AND user_email = %s
                    ORDER BY giorno, ora
                """, (commission_id, user_email))
                sessioni = cursor.fetchall()
    except Exception as e:
        return f"Errore durante il recupero delle sessioni: {str(e)}", 500

    return render_template('sessioni.html', sessioni=sessioni, commission_id=commission_id)



