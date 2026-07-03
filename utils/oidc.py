import os
import time, json, base64, requests
import jwt
from flask import current_app, session


def validate_oidc_token(token: str) -> dict:
    issuer = os.environ.get("OIDC_ISSUER")
    audience = os.environ.get("OIDC_AUDIENCE")
    jwks_url = os.environ.get("OIDC_JWKS_URL")
    algorithm = os.environ.get("OIDC_ALLOWED_ALGORITHM", "RS256")
    if not all((issuer, audience, jwks_url)):
        raise RuntimeError("Configurazione validazione OIDC incompleta")
    signing_key = jwt.PyJWKClient(jwks_url).get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[algorithm],
        audience=audience,
        issuer=issuer,
        leeway=30,
        options={"require": ["exp", "iss", "aud"]},
    )

def _b64url_decode(s: str) -> bytes:
    s += '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)

def seconds_left(jwt_token: str) -> int | None:
    try:
        payload = json.loads(_b64url_decode(jwt_token.split('.')[1]))
        return int(payload.get("exp", 0)) - int(time.time())
    except Exception:
        return None

def refresh_token_in_session() -> bool:
    rt  = session.get("refresh_token")
    url = current_app.config.get("OIDC_TOKEN_URL")
    cid = current_app.config.get("OIDC_CLIENT_ID")
    csc = current_app.config.get("OIDC_CLIENT_SECRET")  # opzionale
    if not (rt and url and cid):
        current_app.logger.warning("[auth] refresh non configurato (manca rt/url/cid)")
        return False
    data = {"grant_type": "refresh_token", "refresh_token": rt, "client_id": cid}
    if csc: data["client_secret"] = csc
    try:
        resp = requests.post(url, data=data, timeout=(5, 15))
        if resp.status_code != 200:
            try:
                j = resp.json()
            except Exception:
                j = {}
            if resp.status_code == 400 and j.get("error") == "invalid_grant":
                current_app.logger.info("[auth] refresh invalid_grant: pulisco sessione e chiedo re-login")
                session.clear()
            else:
                current_app.logger.warning("[auth] refresh KO: %s %s", resp.status_code, resp.text[:200])
            return False
        tok = resp.json()
        session["access_token"] = tok["access_token"]
        session["expires_at"]  = int(time.time()) + int(tok.get("expires_in", 3600))
        if "refresh_token" in tok:
            session["refresh_token"] = tok["refresh_token"]
        return True
    except Exception as e:
        current_app.logger.warning("[auth] refresh exc: %s", e)
        return False


def ensure_fresh_access_token(skew_sec: int = 30) -> str | None:
    """
    Ritorna un access_token valido, rinnovandolo se mancano <= skew_sec secondi alla scadenza.
    Se il refresh fallisce o non c'è refresh_token, ritorna None.
    """
    at = session.get("access_token")
    left = seconds_left(at) if at else None

    # se token mancante, illeggibile o in scadenza → prova refresh
    if left is None or left <= skew_sec:
        ok = refresh_token_in_session()
        if not ok:
            return None
        at = session.get("access_token")

    return at
