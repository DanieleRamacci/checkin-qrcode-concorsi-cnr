import os
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


def _with_local_config_status(item: dict) -> dict:
    config = get_bando_config(item["commission_id"]) or {}
    return {
        **item,
        "configured": bool(config),
        "referente_email": config.get("email_referente") or item.get("referente_email"),
        "esperto_remoto_email": config.get("email_esperto_remoto"),
        "config_status": config.get("config_status") or "da_configurare",
        "expert_assigned": bool(config.get("expert_assigned")),
        "required_data_complete": bool(config.get("required_data_complete")),
        "last_sync": _json_value(
            config.get("configured_at")
            or config.get("fetched_at")
            or item.get("last_sync")
        ),
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
                 LIMIT 1
                """,
                (commission_id,),
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


def fetch_referente_bandi(access_token: str, user_email: str) -> dict:
    base_url = os.environ.get(
        "BASE_URL",
        "https://cool-jconon.test.si.cnr.it",
    ).rstrip("/")
    offset = 100
    items: list[dict] = []
    page = 0

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
                timeout=(5, 30),
            )
            response.raise_for_status()
            batch = response.json().get("items", [])
            if not isinstance(batch, list):
                break
            items.extend(batch)
            if len(batch) < offset:
                break
            page += 1
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
    for item in referenti:
        if item.get("commissioners"):
            continue
        metadata = fetch_bando_metadata(
            item["commission_id"],
            item["title"],
            access_token,
        )
        if metadata:
            item["rdps"] = metadata.get("rdps") or item.get("rdps", [])
            item["commissioners"] = metadata.get("commissioners") or []
            item["rdp_names"] = [
                _person_name(rdp)
                for rdp in item["rdps"]
                if _person_name(rdp)
            ]
    _persist_referente_bandi(user_email, referenti)
    referenti = [_with_local_config_status(item) for item in referenti]
    return {
        "success": True,
        "items": referenti,
    }


def _persist_referente_bandi(user_email: str, items: list[dict]) -> None:
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
            if remote_ids:
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
        update_bando_da_openapi(
            item["commission_id"],
            rdps=item.get("rdps", []),
            commissioners=item.get("commissioners", []),
        )
