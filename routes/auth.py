from flask import Flask, request, abort, jsonify, session, redirect, url_for
from urllib.parse import urlencode
from functools import wraps
import requests
from datetime import datetime, timezone
import json
import jwt
from flask import Blueprint

auth_bp = Blueprint('auth', __name__)


# === CONFIG OIDC ===
import os

from dotenv import load_dotenv; load_dotenv()
import os, sys
print("DEBUG OIDC:", os.getenv("OIDC_CLIENT_ID"), os.getenv("OIDC_AUTH_URL"), os.getenv("OIDC_REDIRECT_URI"), file=sys.stderr)


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
            next_url = request.url
            return redirect(url_for('auth.login', next=next_url))
        return f(*args, **kwargs)
    return decorated_function

# === LOGIN / CALLBACK / LOGOUT ===
@auth_bp.route('/login')
def login():
    next_url = request.args.get('next') or url_for('dashboard.index', _external=True)

    params = {
        'client_id': OIDC_CLIENT_ID,
        'response_type': 'code',
        'scope': 'openid profile email',
        'redirect_uri': OIDC_REDIRECT_URI,
        'state': next_url  # <--- qui salviamo l'URL da cui proveniva l'utente
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
        id_token = tokens.get('id_token')
        session['token']= access_token


        # DEBUG: stampa il token completo
        print("TOKEN:", json.dumps(tokens, indent=2))
        print("Access token:", access_token)


        # Decodifica JWT senza verifica (solo per visualizzazione interna)
        decoded = jwt.decode(access_token, options={"verify_signature": False, "verify_aud": False})
        print("JWT Decodificato:", json.dumps(decoded, indent=2))

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
        next_url = request.args.get('state', '/')
        return redirect(next_url)


    except Exception as e:
        print("Errore nella richiesta token:")
        try:
            print("Status code:", token_response.status_code)
            print("Response body:", token_response.text)
        except:
            pass
        import traceback
        traceback.print_exc()
        return f"Errore: {str(e)}", 500

@auth_bp.route('/logout')
def logout():
    id_token = session.get("id_token")  # Assicurati che venga salvato nella sessione dopo il login
    session.clear()
    session.modified = True

    # Ottieni dinamicamente la URL base del realm dal valore OIDC_AUTH_URL
    # (es: https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/auth)
    # Rimuoviamo /auth e costruiamo /logout
    base_logout_url = OIDC_AUTH_URL.rsplit("/auth", 1)[0] + "/logout"

    logout_url = (
        f"{base_logout_url}"
        f"?post_logout_redirect_uri={url_for('auth.login', _external=True)}"
        f"&scope=openid email profile"
        f"&prompt=login"
    )

    if id_token:
        logout_url += f"&id_token_hint={id_token}"

    return redirect(logout_url)







##api react 

@auth_bp.route('/api/userinfo')
@login_required
def userinfo():
    return jsonify({
        "email": session.get("user_email"),
        "username": session.get("user"),
    })
