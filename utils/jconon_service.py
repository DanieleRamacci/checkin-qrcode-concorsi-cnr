import os
import json
from datetime import datetime, timezone

import requests
from flask import current_app

from db import get_db_connection
from utils.sessioni import get_bando_config, update_bando_da_openapi


def _normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _person_email(person: dict) -> str:
    return _normalize_email(
        person.get("email")
        or person.get("emailcertificatoperpuk")
        or person.get("emailAddress")
    )


def _person_name(person: dict) -> str:
    return (
        person.get("name")
        or person.get("nome")
        or f"{person.get('firstName', '')} {person.get('lastName', '')}".strip()
        or _person_email(person)
    )


def _json_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _item_id(item: dict) -> str:
    return str(
        item.get("cmis:objectId")
        or item.get("id")
        or item.get("uuid")
        or ""
    ).strip()


def _item_title(item: dict) -> str:
    return str(
        item.get("title")
        or item.get("titolo")
        or item.get("jconon_call:codice")
        or item.get("jconon_call:title")
        or item.get("jconon_call:descrizione")
        or _item_id(item)
    ).strip()


def _is_current_user_rdp(item: dict, user_email: str) -> bool:
    normalized = _normalize_email(user_email)
    if not normalized:
        return False
    return any(_person_email(rdp) == normalized for rdp in item.get("rdps", []) or [])


def _serialize_referente_bando(item: dict, user_email: str) -> dict | None:
    commission_id = _item_id(item)
    if not commission_id or not _is_current_user_rdp(item, user_email):
        return None
    rdps = item.get("rdps", []) or []
    commissioners = item.get("commissioners", []) or []
    title = _item_title(item)
    return {
        "commission_id": commission_id,
        "title": title,
        "configured": False,
        "referente_email": user_email,
        "esperto_remoto_email": None,
        "session_count": 0,
        "last_sync": None,
        "config_status": "da_configurare",
        "expert_assigned": False,
        "required_data_complete": False,
        "capabilities": ["configure", "view"],
        "rdps": rdps,
        "commissioners": commissioners,
        "rdp_names": [_person_name(rdp) for rdp in rdps if _person_name(rdp)],
    }


def fetch_bando_metadata(
    commission_id: str,
    call_code: str,
    access_token: str,
) -> dict:
    base_url = os.environ.get(
        "BASE_URL",
        "https://cool-jconon.test.si.cnr.it",
    ).rstrip("/")
    params = {
        "page": 0,
        "offset": 20,
        "filterType": "all",
        "callCode": call_code,
        "detailRdP": "true",
        "detailCommission": "true",
    }
    try:
        response = requests.get(
            f"{base_url}/openapi/v1/call",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            params=params,
            timeout=(5, 30),
        )
        response.raise_for_status()
        items = response.json().get("items", [])
    except (requests.RequestException, ValueError) as error:
        current_app.logger.warning(
            "[jconon] metadata commission_id=%s fallita: %s",
            commission_id,
            error,
        )
        return {}

    item = next(
        (
            candidate
            for candidate in items
            if candidate.get("cmis:objectId") == commission_id
        ),
        items[0] if items else None,
    )
    if not item:
        return {}
    return {
        "rdps": item.get("rdps", []) or [],
        "commissioners": item.get("commissioners", []) or [],
    }


def sync_bando_metadata(commission_id: str, access_token: str) -> dict:
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT titolo
                  FROM commissions
                 WHERE commission_id = %s
                 UNION ALL
                SELECT nome
                  FROM bando_referenti
                 WHERE commission_id = %s
                 LIMIT 1
                """,
                (commission_id, commission_id),
            )
            row = cursor.fetchone()
    if not row:
        return {"success": False, "message": "Bando non trovato."}

    metadata = fetch_bando_metadata(commission_id, row[0], access_token)
    if not metadata:
        return {
            "success": False,
            "message": "Metadati JConon non disponibili.",
        }
    update_bando_da_openapi(
        commission_id,
        rdps=metadata["rdps"],
        commissioners=metadata["commissioners"],
    )
    return {
        "success": True,
        "rdp_count": len(metadata["rdps"]),
        "commissioner_count": len(metadata["commissioners"]),
        "rdps": metadata["rdps"],
        "commissioners": metadata["commissioners"],
    }


def list_local_referente_bandi(user_email: str) -> list[dict]:
    normalized_email = _normalize_email(user_email)
    if not normalized_email:
        return []
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT r.commission_id,
                       MAX(r.nome) AS title,
                       BOOL_OR(b.commission_id IS NOT NULL) AS configured,
                       MAX(b.email_referente) AS referente_email,
                       MAX(b.email_esperto_remoto) AS esperto_remoto_email,
                       COALESCE(MAX(b.config_status), 'da_configurare') AS config_status,
                       BOOL_OR(COALESCE(b.expert_assigned, FALSE)) AS expert_assigned,
                       BOOL_OR(COALESCE(b.required_data_complete, FALSE)) AS required_data_complete,
                       COUNT(DISTINCT s.session_id) AS session_count,
                       MAX(COALESCE(b.configured_at, b.fetched_at, r.synced_at)) AS last_sync,
                       MAX(b.rdp_nomi) AS rdp_nomi
                  FROM bando_referenti AS r
             LEFT JOIN bando_config AS b
                    ON b.commission_id = r.commission_id
             LEFT JOIN sessioni AS s
                    ON s.commission_id = r.commission_id
                 WHERE r.user_email = %s
              GROUP BY r.commission_id
              ORDER BY MAX(r.nome), r.commission_id
                """,
                (normalized_email,),
            )
            rows = cursor.fetchall()

    items = []
    for row in rows:
        try:
            rdp_names = json.loads(row[10] or "[]")
        except (TypeError, ValueError):
            rdp_names = []
        items.append(
            {
                "commission_id": row[0],
                "title": row[1] or row[0],
                "configured": bool(row[2]),
                "referente_email": row[3] or normalized_email,
                "esperto_remoto_email": row[4],
                "config_status": row[5] or "da_configurare",
                "expert_assigned": bool(row[6]),
                "required_data_complete": bool(row[7]),
                "session_count": int(row[8] or 0),
                "last_sync": _json_value(row[9]),
                "capabilities": ["configure", "view"],
                "rdps": [],
                "commissioners": [],
                "rdp_names": rdp_names,
            }
        )
    return items


def fetch_referente_bandi(access_token: str, user_email: str) -> dict:
    base_url = os.environ.get(
        "BASE_URL",
        "https://cool-jconon.test.si.cnr.it",
    ).rstrip("/")
    offset = 100
    items: list[dict] = []
    page = 0
    complete = True

    try:
        while page < 5:
            response = requests.get(
                f"{base_url}/openapi/v1/call",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                },
                params={
                    "page": page,
                    "offset": offset,
                    "filterType": "all",
                    "detailRdP": "true",
                    "detailCommission": "false",
                },
                timeout=(5, 12),
            )
            response.raise_for_status()
            batch = response.json().get("items", [])
            if not isinstance(batch, list):
                break
            items.extend(batch)
            if len(batch) < offset:
                break
            page += 1
        if page >= 5:
            complete = False
    except (requests.RequestException, ValueError) as error:
        current_app.logger.warning(
            "[jconon] referente bandi user=%s fallita: %s",
            user_email,
            error,
        )
        return {
            "success": False,
            "message": "Metadati referente non disponibili.",
            "items": [],
        }

    referenti = [
        serialized
        for item in items
        if (serialized := _serialize_referente_bando(item, user_email)) is not None
    ]
    _persist_referente_bandi(user_email, referenti, revoke_missing=complete)
    return {
        "success": True,
        "items": list_local_referente_bandi(user_email),
    }


def _persist_referente_bandi(
    user_email: str,
    items: list[dict],
    *,
    revoke_missing: bool = True,
) -> None:
    """Sincronizza la relazione bando<->referente in bando_referenti.

    A differenza del vecchio meccanismo (che inseriva l'RDP come riga
    fittizia in `commissions`), qui la fonte istituzionale è considerata
    autorevole anche in negativo: i bandi non più restituiti per questo
    utente vengono cancellati, così un vecchio RDP perde l'accesso invece
    di restare autorizzato per sempre.
    """
    normalized_email = _normalize_email(user_email)
    synced_at = datetime.now(timezone.utc)
    remote_ids = {item["commission_id"] for item in items}

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            for item in items:
                cursor.execute(
                    """
                    INSERT INTO bando_referenti (commission_id, user_email, nome, synced_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (commission_id, user_email)
                    DO UPDATE SET nome = EXCLUDED.nome, synced_at = EXCLUDED.synced_at
                    """,
                    (item["commission_id"], normalized_email, item["title"], synced_at),
                )
            if not revoke_missing:
                pass
            elif remote_ids:
                cursor.execute(
                    """
                    DELETE FROM bando_referenti
                     WHERE user_email = %s
                       AND commission_id != ALL(%s)
                    """,
                    (normalized_email, list(remote_ids)),
                )
            else:
                cursor.execute(
                    "DELETE FROM bando_referenti WHERE user_email = %s",
                    (normalized_email,),
                )
        conn.commit()
    for item in items:
        if item.get("commissioners"):
            update_bando_da_openapi(
                item["commission_id"],
                rdps=item.get("rdps", []),
                commissioners=item.get("commissioners", []),
            )
