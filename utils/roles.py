from functools import wraps
from flask import session, redirect, url_for, request, abort
from db import get_db_connection

ROLE_ADMIN = "admin_globale"
ROLE_ESPERTO = "esperto_informatico"


def get_user_roles(user_email: str):
    if not user_email:
        return set()
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT role FROM user_roles WHERE user_email = %s",
                (user_email,)
            )
            return {row[0] for row in cursor.fetchall()}


def has_role(user_email: str, role: str) -> bool:
    return role in get_user_roles(user_email)

def has_any_role(user_email: str, roles):
    if not user_email:
        return False
    user_roles = get_user_roles(user_email)
    return any(role in user_roles for role in roles)


def role_required(role: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            email = session.get("user_email")
            if not email:
                return redirect(url_for("auth.login", next=request.url))
            if not has_role(email, role):
                return abort(403)
            return f(*args, **kwargs)
        return wrapper
    return decorator


def roles_required_any(roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            email = session.get("user_email")
            if not email:
                return redirect(url_for("auth.login", next=request.url))
            if not has_any_role(email, roles):
                return abort(403)
            return f(*args, **kwargs)
        return wrapper
    return decorator
