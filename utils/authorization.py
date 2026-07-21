from collections.abc import Callable, Iterable
from functools import wraps

from flask import abort, request, session

from db import get_db_connection
from utils.roles import ROLE_ADMIN, ROLE_ESPERTO, get_user_roles


TECHNICAL_MODE_SEDE = "sede"
TECHNICAL_MODE_EXPERT = "esperto"


def normalize_operational_mode(mode: str | None) -> str | None:
    normalized = (mode or "").strip().lower()
    if normalized in ("expert", "esperto"):
        return TECHNICAL_MODE_EXPERT
    if normalized == TECHNICAL_MODE_SEDE:
        return TECHNICAL_MODE_SEDE
    return None


def _normalized_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _has_allowed_role(user_email: str, allowed_roles: Iterable[str]) -> bool:
    roles = get_user_roles(user_email)
    return ROLE_ADMIN in roles or bool(roles.intersection(set(allowed_roles)))


def _has_admin_role(user_email: str) -> bool:
    return ROLE_ADMIN in get_user_roles(user_email)


def is_assigned_remote_expert(user_email: str | None, commission_id: str) -> bool:
    if not user_email:
        return False
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                  FROM bando_config
                 WHERE commission_id = %s
                   AND LOWER(TRIM(COALESCE(email_esperto_remoto, ''))) = %s
                 LIMIT 1
                """,
                (commission_id, _normalized_email(user_email)),
            )
            return cursor.fetchone() is not None


def has_assigned_sede_session(user_email: str | None, commission_id: str) -> bool:
    if not user_email:
        return False
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                  FROM sessioni AS s
                  JOIN sessione_config AS sc
                    ON sc.session_id = s.session_id
                 WHERE s.commission_id = %s
                   AND LOWER(TRIM(COALESCE(sc.email_informatico_sede, ''))) = %s
                 LIMIT 1
                """,
                (commission_id, _normalized_email(user_email)),
            )
            return cursor.fetchone() is not None


def is_assigned_sede_session(user_email: str | None, session_id: str) -> bool:
    if not user_email:
        return False
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                  FROM sessione_config
                 WHERE session_id = %s
                   AND LOWER(TRIM(COALESCE(email_informatico_sede, ''))) = %s
                 LIMIT 1
                """,
                (session_id, _normalized_email(user_email)),
            )
            return cursor.fetchone() is not None


def is_assigned_remote_expert_for_session(
    user_email: str | None,
    session_id: str,
) -> bool:
    if not user_email:
        return False
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                  FROM sessioni AS s
                  JOIN bando_config AS b
                    ON b.commission_id = s.commission_id
                 WHERE s.session_id = %s
                   AND LOWER(TRIM(COALESCE(b.email_esperto_remoto, ''))) = %s
                 LIMIT 1
                """,
                (session_id, _normalized_email(user_email)),
            )
            return cursor.fetchone() is not None


def can_access_commission(
    user_email: str | None,
    commission_id: str,
    *,
    allowed_roles: Iterable[str] = (),
    allow_referente: bool = False,
    profile_mode: str | None = None,
) -> bool:
    if not user_email:
        return False
    mode = normalize_operational_mode(profile_mode)
    if mode == TECHNICAL_MODE_EXPERT:
        return _has_admin_role(user_email) or is_assigned_remote_expert(
            user_email,
            commission_id,
        )
    if mode == TECHNICAL_MODE_SEDE:
        return _has_admin_role(user_email) or has_assigned_sede_session(
            user_email,
            commission_id,
        )
    if _has_allowed_role(user_email, allowed_roles):
        return True

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            if allow_referente:
                # L'RDP/referente è autorizzato tramite la relazione esplicita
                # in bando_referenti, non tramite il possesso della
                # commissione: le due platee restano distinte.
                cursor.execute(
                    """
                    SELECT 1
                      FROM commissions
                     WHERE commission_id = %s
                       AND user_email = %s
                       AND COALESCE(access_active, TRUE)
                       AND UPPER(COALESCE(source_role, 'SEGRETARIO')) = 'SEGRETARIO'
                     UNION ALL
                    SELECT 1
                      FROM bando_referenti
                     WHERE commission_id = %s
                       AND user_email = %s
                     LIMIT 1
                    """,
                    (
                        commission_id,
                        user_email,
                        commission_id,
                        user_email.strip().lower(),
                    ),
                )
            else:
                cursor.execute(
                    """
                    SELECT 1
                      FROM commissions
                     WHERE commission_id = %s
                       AND user_email = %s
                       AND COALESCE(access_active, TRUE)
                       AND UPPER(COALESCE(source_role, 'SEGRETARIO')) = 'SEGRETARIO'
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
    profile_mode: str | None = None,
) -> bool:
    if not user_email:
        return False
    mode = normalize_operational_mode(profile_mode)
    if mode == TECHNICAL_MODE_EXPERT:
        return _has_admin_role(user_email) or is_assigned_remote_expert_for_session(
            user_email,
            session_id,
        )
    if mode == TECHNICAL_MODE_SEDE:
        return _has_admin_role(user_email) or is_assigned_sede_session(
            user_email,
            session_id,
        )
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
                   AND COALESCE(c.access_active, TRUE)
                   AND UPPER(COALESCE(c.source_role, 'SEGRETARIO')) = 'SEGRETARIO'
                 LIMIT 1
                """,
                (session_id, user_email),
            )
            return cursor.fetchone() is not None


def is_session_owner(user_email: str | None, session_id: str) -> bool:
    if not user_email:
        return False
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
                   AND COALESCE(c.access_active, TRUE)
                   AND UPPER(COALESCE(c.source_role, 'SEGRETARIO')) = 'SEGRETARIO'
                 LIMIT 1
                """,
                (session_id, user_email),
            )
            return cursor.fetchone() is not None


def commission_access_required(
    *,
    parameter: str = "commission_id",
    allowed_roles: Iterable[str] = (),
    allow_referente: bool = False,
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
                allow_referente=allow_referente,
                profile_mode=request.args.get("mode"),
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
                profile_mode=request.args.get("mode"),
            ):
                abort(403)
            return view(*args, **kwargs)

        return wrapper

    return decorator
