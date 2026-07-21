from flask import Flask, request, abort, jsonify, session, redirect, url_for
from urllib.parse import urlencode
from urllib.parse import parse_qs, quote, urlsplit
from functools import wraps
from hmac import compare_digest
import secrets
import requests
from datetime import datetime, timezone
import jwt
from flask import Blueprint
import time
from utils.oidc import validate_oidc_token
auth_bp = Blueprint('auth', __name__)


# === CONFIG OIDC ===
import os

from dotenv import load_dotenv; load_dotenv()
import os


OIDC_CLIENT_ID = os.getenv("OIDC_CLIENT_ID")
OIDC_CLIENT_SECRET = os.getenv("OIDC_CLIENT_SECRET")
OIDC_REDIRECT_URI = os.getenv("OIDC_REDIRECT_URI")
OIDC_AUTH_URL = os.getenv("OIDC_AUTH_URL")
OIDC_TOKEN_URL = os.getenv("OIDC_TOKEN_URL")
OIDC_USERINFO_URL = os.getenv("OIDC_USERINFO_URL")
BASE_URL = os.getenv("BASE_URL", "http://localhost:5050")  



# === DECORATORE LOGIN ===
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'access_token' not in session:
            next_url = request.full_path.rstrip("?")
            return redirect(url_for('auth.login', next=next_url))
        return f(*args, **kwargs)
    return decorated_function

# === LOGIN / CALLBACK / LOGOUT ===
@auth_bp.route('/login')
def login():
    next_url = _safe_next_url(request.args.get('next'))
    state = secrets.token_urlsafe(32)
    session["oidc_state"] = state
    session["oidc_next"] = next_url

    params = {
        'client_id': OIDC_CLIENT_ID,
        'response_type': 'code',
        'scope': 'openid profile email',
        'redirect_uri': OIDC_REDIRECT_URI,
        'state': state
    }
    return redirect(f"{OIDC_AUTH_URL}?{urlencode(params)}")

from flask import redirect, session
import jwt


@auth_bp.route('/oidc-callback')
def oidc_callback():
    try:
        code = request.args.get('code')
        if not code:
            return "Codice non trovato", 400
        expected_state = session.pop("oidc_state", None)
        received_state = request.args.get("state")
        if (
            not expected_state
            or not received_state
            or not compare_digest(expected_state, received_state)
        ):
            session.pop("oidc_next", None)
            return "State OIDC non valido", 400

        # Scambio del codice per un access token
        token_response = requests.post(
            OIDC_TOKEN_URL,
            data={
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': OIDC_REDIRECT_URI,
                'client_id': OIDC_CLIENT_ID,
                'client_secret': OIDC_CLIENT_SECRET
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )

        token_response.raise_for_status()

        tokens = token_response.json()
        access_token = tokens['access_token']
        refresh_token = tokens.get('refresh_token')  
        expires_in    = int(tokens.get('expires_in', 300))
        refresh_expires_in = int(tokens.get('refresh_expires_in', 0))  # opzionale

        id_token = tokens.get('id_token')
        decoded = validate_oidc_token(id_token or access_token)

        #  Controllo utente CNR
        is_cnr_user = decoded.get("is_cnr_user", False)
        if not is_cnr_user:
            return "Accesso riservato agli utenti CNR", 403

        # Salva access token e dati utente decodificati in sessione
        email = decoded.get('email')
        if not email:
            return "Errore: il token non contiene un'email valida", 400
        session['user_email'] = email
        session['user'] = decoded.get('preferred_username') or decoded.get('email') or decoded.get('sub')
        session['access_token'] = access_token
        session['user_info'] = decoded
        session['id_token'] = id_token  
        session['refresh_token'] = refresh_token
        session['expires_at'] = int(time.time()) + expires_in
        session['refresh_expires_at'] = int(time.time()) + refresh_expires_in
        next_url = session.pop("oidc_next", "/")
        return redirect(next_url)


    except Exception as e:
        from flask import current_app
        current_app.logger.error("Errore nella richiesta token: %s", str(e), exc_info=True)
        return f"Errore: {str(e)}", 500


def _safe_next_url(candidate):
    if not candidate:
        return "/"
    parsed = urlsplit(candidate)
    if parsed.scheme or parsed.netloc or not candidate.startswith("/") or candidate.startswith("//"):
        return "/"
    return _normalize_legacy_next_url(parsed)


def _normalize_legacy_next_url(parsed):
    path = parsed.path or "/"
    query = parse_qs(parsed.query, keep_blank_values=True)

    if path == "/dashboard/segretario":
        return "/bandi"

    if path == "/sessioni":
        commission_id = (query.get("commission_id") or [""])[0]
        if not commission_id:
            return "/bandi"
        mode = (query.get("mode") or [""])[0]
        target = f"/bandi/{quote(commission_id, safe='')}/sessioni"
        if mode:
            target += f"?{urlencode({'mode': mode})}"
        return target

    if path.startswith("/gestione-concorso/"):
        session_id = path.rsplit("/", 1)[-1]
        return f"/sessioni/{quote(session_id, safe='')}" if session_id else "/bandi"

    if path.startswith("/dispositivi/"):
        session_id = path.rsplit("/", 1)[-1]
        return f"/sessioni/{quote(session_id, safe='')}/dispositivi" if session_id else "/bandi"

    if path == "/device-link":
        session_id = (query.get("session_id") or [""])[0]
        token = (query.get("token") or [""])[0]
        if session_id and token:
            return f"/scanner?{urlencode({'sessionId': session_id, 'token': token})}"
        return "/scanner"

    if path.startswith("/bando/") and path.endswith("/configura"):
        commission_id = path.split("/")[2]
        return f"/bandi/{quote(commission_id, safe='')}/config" if commission_id else "/bandi"

    if path.startswith("/bando/") and path.endswith("/dettaglio"):
        commission_id = path.split("/")[2]
        return f"/bandi/{quote(commission_id, safe='')}/detail" if commission_id else "/bandi"

    if path == "/user":
        return "/"

    return parsed.geturl()


def _external_app_url(path="/"):
    redirect_base = urlsplit(OIDC_REDIRECT_URI or "")
    if redirect_base.scheme and redirect_base.netloc:
        clean_path = path if path.startswith("/") else f"/{path}"
        return f"{redirect_base.scheme}://{redirect_base.netloc}{clean_path}"
    proto = request.headers.get("X-Forwarded-Proto", request.scheme)
    host = request.headers.get("X-Forwarded-Host", request.host)
    clean_path = path if path.startswith("/") else f"/{path}"
    return f"{proto}://{host}{clean_path}"


@auth_bp.route('/logout')
def logout():
    id_token = session.get("id_token")  # Assicurati che venga salvato nella sessione dopo il login
    session.clear()
    session.modified = True

    base_logout_url = OIDC_AUTH_URL.rsplit("/auth", 1)[0] + "/logout"
    params = {
        "post_logout_redirect_uri": _external_app_url("/logged-out"),
    }
    if id_token:
        params["id_token_hint"] = id_token
    elif OIDC_CLIENT_ID:
        params["client_id"] = OIDC_CLIENT_ID

    return redirect(f"{base_logout_url}?{urlencode(params)}")







##api react 

@auth_bp.route('/api/userinfo')
@login_required
def userinfo():
    return jsonify({
        "email": session.get("user_email"),
        "username": session.get("user"),
    })
