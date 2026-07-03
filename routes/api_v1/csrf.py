import secrets
from hmac import compare_digest
from functools import wraps
from typing import MutableMapping

from flask import current_app, request, session

from routes.api_v1.errors import error_response


CSRF_SESSION_KEY = "api_csrf_token"
CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def csrf_exempt(view):
    view._api_csrf_exempt = True
    return view


def get_csrf_token(session_data: MutableMapping | None = None) -> str:
    target = session_data if session_data is not None else session
    token = target.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        target[CSRF_SESSION_KEY] = token
    return token


def validate_api_csrf():
    if request.method in SAFE_METHODS:
        return None
    view = current_app.view_functions.get(request.endpoint)
    if view and getattr(view, "_api_csrf_exempt", False):
        return None
    if not (session.get("user_email") or session.get("access_token")):
        return None

    expected = session.get(CSRF_SESSION_KEY)
    provided = request.headers.get(CSRF_HEADER)
    if (
        not expected
        or not provided
        or not compare_digest(str(expected), str(provided))
    ):
        return error_response(
            "csrf_invalid",
            "Token CSRF mancante o non valido.",
            403,
        )
    return None
