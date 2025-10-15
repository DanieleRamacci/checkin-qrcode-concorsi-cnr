# routes/user.py
from flask import Blueprint, jsonify, session, send_from_directory, request
from datetime import datetime, timezone
from routes.auth import login_required
from utils.oidc import seconds_left, ensure_fresh_access_token
import time, jwt

user_bp = Blueprint('user', __name__)

@user_bp.route('/me')
@login_required
def me():
    # per sicurezza: evita di restituire l'access_token intero
    at = session.get('access_token')
    payload = {}
    exp = None
    if at:
        try:
            payload = jwt.decode(at, options={"verify_signature": False, "verify_aud": False})
            exp = int(payload.get("exp")) if payload.get("exp") else None
        except Exception:
            pass

    return jsonify({
        "user_info": session.get('user_info'),
        "token_info": {
            "exp": exp,                            # epoch seconds
            "seconds_left": seconds_left(at),      # secondi residui o None
        }
    })

@user_bp.route('/user')
@login_required
def user_page():
    return send_from_directory('static', 'user.html')

# --- NUOVO: stato sessione per il contatore ---
@user_bp.route('/user/session/status')
@login_required
def session_status():
    at = session.get('access_token')
    left = seconds_left(at)
    # calcolo exp: se ho left, exp = now + left; altrimenti provo dal JWT
    exp = None
    if at and left is not None:
        exp = int(time.time()) + int(left)
    elif at:
        try:
            payload = jwt.decode(at, options={"verify_signature": False, "verify_aud": False})
            exp = int(payload.get("exp")) if payload.get("exp") else None
        except Exception:
            exp = None

    return jsonify({
        "now": int(time.time()),
        "exp": exp,
        "seconds_left": left,
        "user": session.get("user"),
        "can_refresh": bool(session.get("refresh_token")),
    })


# --- NUOVO: refresh on-demand (usato dal countdown) ---
@user_bp.route('/user/session/refresh', methods=['POST'])
@login_required
def session_refresh():
    at = ensure_fresh_access_token(skew_sec=60)   # rinnova se mancano <= 60s
    if not at:
        return jsonify({"ok": False, "reason": "reauth_required"}), 401
    return jsonify({
        "ok": True,
        "seconds_left": seconds_left(at),
    })


@user_bp.route('/user/session/debug')
@login_required
def session_debug():
    from flask import current_app, jsonify, session
    return jsonify({
        "has_refresh_token": bool(session.get("refresh_token")),
        "OIDC_TOKEN_URL": bool(current_app.config.get("OIDC_TOKEN_URL")),
        "OIDC_CLIENT_ID": bool(current_app.config.get("OIDC_CLIENT_ID")),
        "OIDC_CLIENT_SECRET": bool(current_app.config.get("OIDC_CLIENT_SECRET")),
    })



