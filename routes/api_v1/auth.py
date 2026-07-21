from functools import wraps

from flask import Blueprint, current_app, jsonify, session

from routes.api_v1.csrf import get_csrf_token
from routes.api_v1.errors import error_response
from utils.oidc import ensure_fresh_access_token
from utils.app_settings import get_app_settings
from utils.permissions import capabilities_for_roles
from utils.roles import get_user_roles


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

    user_info = session.get("user_info") or {}
    roles = get_user_roles(email)
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
        capabilities=capabilities_for_roles(roles),
        csrf_token=get_csrf_token(),
        dev_mode=bool(current_app.config.get("DEV_MODE")),
        app_version=current_app.config.get("APP_VERSION", "n/d"),
        app_build_time=current_app.config.get("APP_BUILD_TIME", "n/d"),
        app_settings=get_app_settings(),
    )


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
