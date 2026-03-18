from flask import Blueprint, render_template, request
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
