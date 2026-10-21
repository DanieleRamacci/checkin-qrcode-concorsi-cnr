from functools import wraps

from flask import Blueprint, current_app, jsonify, request, session

from routes.api_v1.csrf import get_csrf_token
from routes.api_v1.errors import error_response
from utils.authorization import has_any_assigned_sede_session
from utils.oidc import ensure_fresh_access_token
from utils.app_settings import get_app_settings
from utils.permissions import CAPABILITY_SEDE_WORKFLOW, capabilities_for_roles
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, get_user_roles
from db import get_db_connection


def _profiles_for_user(email: str, roles: set[str]) -> list[str]:
    profiles = []
    with get_db_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT 1 FROM commissions WHERE LOWER(TRIM(user_email)) = %s AND COALESCE(access_active, TRUE) AND UPPER(COALESCE(source_role, 'SEGRETARIO')) = 'SEGRETARIO' LIMIT 1", (email.strip().lower(),))
        secretary = cursor.fetchone() is not None
        cursor.execute("SELECT 1 FROM bando_referenti WHERE LOWER(TRIM(user_email)) = %s LIMIT 1", (email.strip().lower(),))
        referente = cursor.fetchone() is not None
    if secretary: profiles.append("segretario")
    if referente: profiles.append("referente")
    support = []
    if has_any_assigned_sede_session(email): support.append("sede")
    if ROLE_ESPERTO in roles: support.append("esperto")
    if ROLE_ADMIN in roles: support.append("admin")
    # Primo accesso senza dati locali: si propongono segretario e referente,
    # che si popolano con la prima sincronizzazione. Chi ha già un profilo di
    # supporto (sede, esperto, admin) non li vede finché non risultano davvero.
    if not secretary and not referente and not support:
        profiles.extend(["segretario", "referente"])
    return profiles + support


auth_api_bp = Blueprint("api_v1_auth", __name__)


def api_auth_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("user_email"):
            return error_response(
                "authentication_required",
                "Autenticazione richiesta.",
                401,
            )
        return view(*args, **kwargs)

    return wrapper


@auth_api_bp.get("/me")
def me():
    email = session.get("user_email")
    if not email:
        return error_response(
            "authentication_required",
            "Autenticazione richiesta.",
            401,
        )
    if not ensure_fresh_access_token(skew_sec=60):
        return error_response(
            "reauthentication_required",
            "La sessione OIDC non può essere aggiornata. Effettuare nuovamente l'accesso.",
            401,
        )

    user_info = session.get("user_info") or {}
    roles = get_user_roles(email)
    capabilities = set(capabilities_for_roles(roles))
    if ROLE_ADMIN in roles or has_any_assigned_sede_session(email):
        capabilities.add(CAPABILITY_SEDE_WORKFLOW)
    display_name = (
        user_info.get("name")
        or user_info.get("preferred_username")
        or session.get("user")
        or email
    )
    return jsonify(
        authenticated=True,
        email=email,
        display_name=display_name,
        roles=sorted(roles),
        profiles=_profiles_for_user(email, roles),
        capabilities=sorted(capabilities),
        csrf_token=get_csrf_token(),
        dev_mode=bool(current_app.config.get("DEV_MODE")),
        api_test_access=bool(current_app.config.get("API_TEST_ACCESS")) and ROLE_ADMIN in roles,
        app_version=current_app.config.get("APP_VERSION", "n/d"),
        app_build_time=current_app.config.get("APP_BUILD_TIME", "n/d"),
        app_settings=get_app_settings(),
    )


@auth_api_bp.get("/me/test-access")
@api_auth_required
def test_access():
    """Accesso API dell'utente per test automatici: il cookie di sessione che il
    browser ha appena inviato e il token CSRF. Solo amministratori e solo con
    API_TEST_ACCESS attivo; vale finché la sessione resta valida (Esci per revocarlo)."""
    email = session["user_email"]
    if not current_app.config.get("API_TEST_ACCESS") or ROLE_ADMIN not in get_user_roles(email):
        return error_response("not_found", "Risorsa API non trovata.", 404)
    cookie_name = current_app.config.get("SESSION_COOKIE_NAME") or "session"
    cookie_value = request.cookies.get(cookie_name)
    if not cookie_value:
        return error_response("authentication_required", "Cookie di sessione non trovato.", 401)
    current_app.logger.warning("[api-test] accesso API di test mostrato a %s", email)
    response = jsonify(
        base_url=request.host_url.rstrip("/") + "/api/v1",
        cookie_name=cookie_name,
        cookie_value=cookie_value,
        csrf_header="X-CSRF-Token",
        csrf_token=get_csrf_token(),
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@auth_api_bp.post("/session/refresh")
@api_auth_required
def refresh_session():
    access_token = ensure_fresh_access_token(skew_sec=60)
    if not access_token:
        return error_response(
            "reauthentication_required",
            "La sessione OIDC non può essere aggiornata. Effettuare nuovamente l'accesso.",
            401,
        )
    return jsonify(
        authenticated=True,
        refreshed=True,
        expires_at=session.get("expires_at"),
    )


@auth_api_bp.post("/logout")
@api_auth_required
def logout():
    session.clear()
    session.modified = True
    return jsonify(authenticated=False)
