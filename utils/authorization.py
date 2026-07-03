from collections.abc import Callable, Iterable
from functools import wraps

from flask import abort, session

from db import get_db_connection
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, get_user_roles


def _has_allowed_role(user_email: str, allowed_roles: Iterable[str]) -> bool:
    roles = get_user_roles(user_email)
    return ROLE_ADMIN in roles or bool(roles.intersection(set(allowed_roles)))


def can_access_commission(
    user_email: str | None,
    commission_id: str,
    *,
    allowed_roles: Iterable[str] = (),
) -> bool:
    if not user_email:
        return False
    if _has_allowed_role(user_email, allowed_roles):
        return True

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                  FROM commissions
                 WHERE commission_id = %s
                   AND user_email = %s
                 LIMIT 1
                """,
                (commission_id, user_email),
            )
            return cursor.fetchone() is not None


def can_access_session(
    user_email: str | None,
    session_id: str,
    *,
    allowed_roles: Iterable[str] = (),
) -> bool:
    if not user_email:
        return False
    if _has_allowed_role(user_email, allowed_roles):
        return True

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                  FROM sessioni AS s
                  JOIN commissions AS c
                    ON c.commission_id = s.commission_id
                 WHERE s.session_id = %s
                   AND c.user_email = %s
                 LIMIT 1
                """,
                (session_id, user_email),
            )
            return cursor.fetchone() is not None


def commission_access_required(
    *,
    parameter: str = "commission_id",
    allowed_roles: Iterable[str] = (),
) -> Callable:
    def decorator(view: Callable) -> Callable:
        @wraps(view)
        def wrapper(*args, **kwargs):
            user_email = session.get("user_email")
            if not user_email:
                abort(401)
            if not can_access_commission(
                user_email,
                kwargs[parameter],
                allowed_roles=allowed_roles,
            ):
                abort(403)
            return view(*args, **kwargs)

        return wrapper

    return decorator


def session_access_required(
    *,
    parameter: str = "session_id",
    allowed_roles: Iterable[str] = (),
) -> Callable:
    def decorator(view: Callable) -> Callable:
        @wraps(view)
        def wrapper(*args, **kwargs):
            user_email = session.get("user_email")
            if not user_email:
                abort(401)
            if not can_access_session(
                user_email,
                kwargs[parameter],
                allowed_roles=allowed_roles,
            ):
                abort(403)
            return view(*args, **kwargs)

        return wrapper

    return decorator
