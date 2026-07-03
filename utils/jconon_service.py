import os

import requests
from flask import current_app

from db import get_db_connection
from utils.sessioni import update_bando_da_openapi


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
