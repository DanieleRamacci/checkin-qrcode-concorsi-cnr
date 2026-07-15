from flask import Blueprint, redirect
from routes.auth import login_required


gestione_concorso_bp = Blueprint('gestione-concorso', __name__)



@gestione_concorso_bp.route('/gestione-concorso/<session_id>')
@login_required
def gestione_concorso(session_id):
    return redirect(f"/sessioni/{session_id}")
