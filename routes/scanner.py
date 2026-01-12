from flask import Blueprint, render_template, request, redirect, url_for
from utils.candidati import get_candidato_by_uid
from utils.checkin import registra_checkin
from routes.auth import login_required


scanner_bp = Blueprint('scanner', __name__)

@scanner_bp.route('/device-link', methods=['GET'])
@login_required
def device_link():
    session_id = request.args.get('session_id')
    reg_token = request.args.get('token')
    if not session_id or not reg_token:
        return "Parametri mancanti", 400
    return render_template('scanner.html', session_id=session_id, reg_token=reg_token)

@scanner_bp.route('/scanner', methods=['GET', 'POST'])
def verifica_candidato():
    if request.method == 'POST':
        uid = request.form.get('uid')
        session_id = request.form.get('session_id')

        candidato = get_candidato_by_uid(uid, session_id)
        if candidato:
            return render_template('scanner.html', candidato=candidato, session_id=session_id)
        else:
            return render_template('scanner.html', errore="Candidato non trovato o UID/sessione errati.")
    
    return render_template('scanner.html')

@scanner_bp.route('/scanner/checkin', methods=['POST'])
def checkin_candidato():
    uid = request.form.get('uid')
    session_id = request.form.get('session_id')

    success, msg = registra_checkin(uid, session_id)
    if success:
        return render_template('scanner.html', candidato={'uid': uid}, session_id=session_id, success=True)
    else:
        return render_template('scanner.html', errore=msg)
