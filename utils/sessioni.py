import requests
import hashlib
from datetime import datetime, timezone
import os
from db import get_db_connection 
from flask import current_app
import time
from utils.bando_config_status import compute_bando_config_status

BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')

def get_sessioni_internamente(commission_id, access_token, user_email, timeout_s=(3.05, 20), retries: int = 1):
    """
    Sincronizza le sessioni di una commissione.
    Ritorna:
      - int >= 0 : numero di sessioni inserite (successo; anche 0)
      - "UNAUTHORIZED" : token scaduto/invalid (401)
      - -1 : errore (rete/HTTP/parsing/DB, utente non autorizzato, ecc.)
    Non solleva eccezioni.
    """
    try:
        from routes.sessioni import parse_session_string

        # 1) Autorizzazione utente sulla commissione
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 1 FROM commissions
                    WHERE commission_id = %s
                      AND user_email = %s
                      AND COALESCE(access_active, TRUE)
                      AND UPPER(COALESCE(source_role, 'SEGRETARIO')) = 'SEGRETARIO'
                """, (commission_id, user_email))
                if not cursor.fetchone():
                    current_app.logger.debug("[sessioni] no auth commission_id=%s user=%s", commission_id, user_email)
                    return -1  # NON successo: evita di "sporcare" data_sync

        # 2) Chiamata API remota con timeout e retry leggero
        api_url = f"{BASE_URL}/openapi/v1/call/exam-sessions/{commission_id}"
        headers = {'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'}

        attempt = 0
        sessioni_data = None
        last_err = None

        while attempt <= retries:
            attempt += 1
            t0 = time.time()
            try:
                current_app.logger.debug("[sessioni] GET %s (try %d/%d)", api_url, attempt, retries + 1)
                resp = requests.get(api_url, headers=headers, timeout=timeout_s)
                dt = time.time() - t0
                current_app.logger.debug("[sessioni] -> %s in %.2fs", resp.status_code, dt)

                if resp.status_code == 401:
                    current_app.logger.warning("[sessioni] token scaduto o non valido (401)")
                    return "UNAUTHORIZED"

                resp.raise_for_status()
                sessioni_data = resp.json()
                break  # OK

            except (requests.Timeout, requests.ConnectionError) as e:
                last_err = e
                current_app.logger.warning("[sessioni] timeout/conn error %s try %d: %s", api_url, attempt, e)
                if attempt > retries:
                    return -1

            except requests.HTTPError as e:
                body_preview = e.response.text[:300] if e.response is not None else ""
                current_app.logger.error("[sessioni] HTTP %s: %s", getattr(e.response, 'status_code', '?'), body_preview)
                return -1  # errore non transitorio

            except Exception as e:
                last_err = e
                current_app.logger.exception("[sessioni] errore generico chiamata API: %s", e)
                return -1

        if sessioni_data is None:
            current_app.logger.warning("[sessioni] API non ha restituito dati: %s", last_err)
            return -1

        if not isinstance(sessioni_data, dict):
            current_app.logger.error("[sessioni] JSON inatteso (atteso dict), type=%s", type(sessioni_data).__name__)
            return -1

        # 3) Inserimento in DB (parser robusto + tipi corretti)
        now = datetime.now(timezone.utc)  # UTC coerente
        inserted = 0

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                for session_string, candidati in sessioni_data.items():
                    try:
                        p = parse_session_string(session_string)  # deve dare p["data_esame"]
                        raw_key = f"{commission_id}::{session_string}"
                        session_id = hashlib.md5(raw_key.encode()).hexdigest()

                        cursor.execute("""
                            INSERT INTO sessioni (
                                session_id, commission_id, user_email, session_string,
                                nome, giorno, ora, luogo, data_esame,
                                attiva, candidati_importati, sync_user_email, data_sync
                            )
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                            ON CONFLICT (session_id) DO NOTHING
                        """, (
                            session_id, commission_id, user_email, session_string,
                            p.get("nome"), p.get("giorno"), p.get("ora"), p.get("luogo"),
                            p.get("data_esame"),
                            False, False, user_email, now
                        ))

                        if cursor.rowcount > 0:
                            inserted += 1

                    except Exception as e:
                        current_app.logger.warning("[sessioni] PARSE FAIL '%s': %s", session_string, e)
                        continue

            conn.commit()

        current_app.logger.info("[sessioni] sync OK commission_id=%s inserted=%d", commission_id, inserted)
        return inserted  # successo (anche 0)

    except Exception as e:
        current_app.logger.exception("[sessioni] errore generale get_sessioni_internamente: %s", e)
        return -1






def get_sessioni_per_commissione(commission_id):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT session_id, nome, giorno, ora, luogo
                FROM sessioni
                WHERE commission_id = %s
            """, (commission_id,))
            rows = cursor.fetchall()

    return [{
        "session_id": row[0],
        "session_string": row[1],
        "giorno": row[2],
        "ora": row[3],
        "luogo": row[4]
    } for row in rows]


def importa_sessioni(sessioni):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            for sessione in sessioni:
                cursor.execute("""
                    INSERT INTO sessioni (
                        session_id, nome, giorno, ora, luogo, attiva
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (session_id) DO UPDATE SET
                        nome = EXCLUDED.nome,
                        giorno = EXCLUDED.giorno,
                        ora = EXCLUDED.ora,
                        luogo = EXCLUDED.luogo,
                        attiva = EXCLUDED.attiva
                """, (
                    sessione['id'],
                    sessione['nome'],
                    sessione['giorno'],
                    sessione['ora'],
                    sessione['luogo'],
                    sessione.get('attiva', 0)
                ))



def get_sessione_by_id(session_id):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT session_id, commission_id, nome, giorno, ora, luogo, attiva, candidati_importati, stato_corrente
                FROM sessioni
                WHERE session_id = %s
            """, (session_id,))
            row = cursor.fetchone()

            if not row:
                return None

            return {
                "session_id": row[0],
                "commission_id": row[1],
                "nome": row[2],
                "giorno": row[3],
                "ora": row[4],
                "luogo": row[5],
                "attiva": row[6],
                "candidati_importati": row[7],
                "stato_corrente": row[8],
            }


def email_to_nome(email: str) -> str:
    """Deriva nome/cognome dall'email CNR: nome.cognome@cnr.it → Nome Cognome."""
    if not email:
        return ""
    local = email.split("@")[0]
    parts = [p for p in local.replace("_", ".").split(".") if p]
    return " ".join(p.capitalize() for p in parts)


def get_bando_config(commission_id):
    """Restituisce la configurazione del bando (dati comuni a tutte le sessioni)."""
    import json as _json
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT email_referente, email_esperto_remoto, email_segretario,
                       telefono_segretario, durata_prova_minuti,
                       data_accesso_piattaforma, commissione_members,
                       rdp_members, rdp_nomi, commissione_nomi, config_status,
                       expert_assigned, required_data_complete, fetched_at,
                       configured_at, configured_by
                FROM bando_config
                WHERE commission_id = %s
            """, (commission_id,))
            row = cursor.fetchone()
    if not row:
        return None
    config = {
        "email_referente":       row[0],
        "email_esperto_remoto":  row[1],
        "email_segretario":      row[2],
        "telefono_segretario":   row[3],
        "durata_prova_minuti":   row[4],
        "data_accesso_piattaforma": row[5],
        "commissione_members":   _json.loads(row[6] or "[]"),
        "rdp_members":           _json.loads(row[7] or "[]"),
        "rdp_nomi":              _json.loads(row[8] or "[]"),
        "commissione_nomi":      _json.loads(row[9] or "[]"),
        "config_status":         row[10],
        "expert_assigned":       bool(row[11]),
        "required_data_complete": bool(row[12]),
        "fetched_at":            row[13],
        "configured_at":         row[14],
        "configured_by":         row[15],
    }
    computed = compute_bando_config_status(config)
    if not config["config_status"]:
        config.update(computed)
    return config


def save_bando_config(commission_id, email_referente, email_esperto_remoto,
                      email_segretario, telefono_segretario=None,
                      durata_prova_minuti=None, commissione_members=None,
                      configured_by=None, data_accesso_piattaforma=None):
    """Inserisce o aggiorna la configurazione del bando."""
    import json as _json
    from datetime import datetime as _dt
    status = compute_bando_config_status(
        {
            "email_referente": email_referente,
            "email_esperto_remoto": email_esperto_remoto,
            "email_segretario": email_segretario,
            "durata_prova_minuti": durata_prova_minuti,
            "commissione_members": commissione_members,
        }
    )
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO bando_config (
                    commission_id, email_referente, email_esperto_remoto,
                    email_segretario, telefono_segretario, durata_prova_minuti,
                    data_accesso_piattaforma, commissione_members, config_status, expert_assigned,
                    required_data_complete, configured_at, configured_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (commission_id) DO UPDATE SET
                    email_referente      = EXCLUDED.email_referente,
                    email_esperto_remoto = EXCLUDED.email_esperto_remoto,
                    email_segretario     = EXCLUDED.email_segretario,
                    telefono_segretario  = EXCLUDED.telefono_segretario,
                    durata_prova_minuti  = EXCLUDED.durata_prova_minuti,
                    data_accesso_piattaforma = EXCLUDED.data_accesso_piattaforma,
                    commissione_members  = EXCLUDED.commissione_members,
                    config_status        = EXCLUDED.config_status,
                    expert_assigned      = EXCLUDED.expert_assigned,
                    required_data_complete = EXCLUDED.required_data_complete,
                    configured_at        = EXCLUDED.configured_at,
                    configured_by        = EXCLUDED.configured_by
            """, (
                commission_id,
                email_referente or None,
                email_esperto_remoto or None,
                email_segretario or None,
                telefono_segretario or None,
                int(durata_prova_minuti) if durata_prova_minuti else None,
                data_accesso_piattaforma or None,
                _json.dumps(commissione_members or [], ensure_ascii=False),
                status["config_status"],
                status["expert_assigned"],
                status["required_data_complete"],
                _dt.now(),
                configured_by or None,
            ))
        conn.commit()


def refresh_bando_config_status(commission_id: str) -> dict:
    config = get_bando_config(commission_id) or {}
    status = compute_bando_config_status(config)
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE bando_config
                   SET config_status = %s,
                       expert_assigned = %s,
                       required_data_complete = %s
                 WHERE commission_id = %s
                """,
                (
                    status["config_status"],
                    status["expert_assigned"],
                    status["required_data_complete"],
                    commission_id,
                ),
            )
        conn.commit()
    return status


def update_commissione_members(commission_id: str, members: list):
    """Aggiorna solo commissione_members in bando_config senza toccare gli altri campi."""
    import json as _json
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO bando_config (commission_id, commissione_members)
                VALUES (%s, %s)
                ON CONFLICT (commission_id) DO UPDATE SET
                    commissione_members = EXCLUDED.commissione_members
            """, (commission_id, _json.dumps(members, ensure_ascii=False)))
        conn.commit()
    refresh_bando_config_status(commission_id)


def update_bando_da_openapi(commission_id: str, rdps: list, commissioners: list):
    """
    Aggiorna bando_config con i dati freschi dall'API /openapi/v1/call.
    - commissione_members e rdp_nomi vengono sempre sovrascritti (dati API).
    - email_referente viene impostata solo se attualmente vuota.
    - email_segretario viene allineata alla fonte istituzionale: se non c'e'
      alcun commissioner con ruolo SEGRETARIO, il valore locale viene svuotato.
    """
    import json as _json

    commissione_members = [
        {
            "nome": f"{c.get('firstName', '')} {c.get('lastName', '')}".strip(),
            "email": c.get("email", ""),
            "ruolo": c.get("ruolo", ""),
        }
        for c in commissioners if c.get("email")
    ]
    rdp_members = [
        {
            "nome": (
                r.get("name")
                or r.get("nome")
                or f"{r.get('firstName', '')} {r.get('lastName', '')}".strip()
            ),
            "email": (
                r.get("email")
                or r.get("emailcertificatoperpuk")
                or r.get("emailAddress")
                or ""
            ),
        }
        for r in rdps
        if (
            r.get("email")
            or r.get("emailcertificatoperpuk")
            or r.get("emailAddress")
        )
    ]
    rdp_nomi = [
        f"{r.get('firstName', '')} {r.get('lastName', '')}".strip()
        for r in rdps if r.get("firstName") or r.get("lastName")
    ]
    first_rdp_email = rdp_members[0].get("email", "") if rdp_members else ""

    segretari = [c for c in commissioners if (c.get("ruolo") or "").upper() == "SEGRETARIO"]
    segretario_email = segretari[0].get("email", "") if segretari else ""

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO bando_config (commission_id, commissione_members,
                                          rdp_members, rdp_nomi,
                                          email_referente, email_segretario)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (commission_id) DO UPDATE SET
                    commissione_members = EXCLUDED.commissione_members,
                    rdp_members         = EXCLUDED.rdp_members,
                    rdp_nomi            = EXCLUDED.rdp_nomi,
                    email_referente     = CASE
                        WHEN bando_config.email_referente IS NULL OR bando_config.email_referente = ''
                        THEN EXCLUDED.email_referente ELSE bando_config.email_referente END,
                    email_segretario    = EXCLUDED.email_segretario
            """, (
                commission_id,
                _json.dumps(commissione_members, ensure_ascii=False),
                _json.dumps(rdp_members, ensure_ascii=False),
                _json.dumps(rdp_nomi, ensure_ascii=False),
                first_rdp_email or None,
                segretario_email or None,
            ))
        conn.commit()
    refresh_bando_config_status(commission_id)


def get_sessione_config(session_id):
    """Restituisce la configurazione per-sessione (informatico in sede + data accesso piattaforma)."""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT nome_informatico_sede, email_informatico_sede,
                       telefono_informatico_sede, data_accesso_piattaforma
                FROM sessione_config
                WHERE session_id = %s
            """, (session_id,))
            row = cursor.fetchone()
    if not row:
        return None
    return {
        "nome_informatico_sede":     row[0],
        "email_informatico_sede":    row[1],
        "telefono_informatico_sede": row[2],
        "data_accesso_piattaforma":  row[3],
    }


def save_sessione_config(session_id, nome_informatico_sede, email_informatico_sede,
                         telefono_informatico_sede, data_accesso_piattaforma=None):
    """Inserisce o aggiorna la configurazione per-sessione."""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO sessione_config (
                    session_id, nome_informatico_sede, email_informatico_sede,
                    telefono_informatico_sede, data_accesso_piattaforma
                ) VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (session_id) DO UPDATE SET
                    nome_informatico_sede     = EXCLUDED.nome_informatico_sede,
                    email_informatico_sede    = EXCLUDED.email_informatico_sede,
                    telefono_informatico_sede = EXCLUDED.telefono_informatico_sede,
                    data_accesso_piattaforma  = EXCLUDED.data_accesso_piattaforma
            """, (
                session_id,
                nome_informatico_sede or None,
                email_informatico_sede or None,
                telefono_informatico_sede or None,
                data_accesso_piattaforma or None,
            ))
        conn.commit()


def save_bando_meta_from_jconon(commission_id: str, rdp_nomi: list, commissione_nomi: list):
    """Upsert solo i campi auto-fetchati (rdp_nomi, commissione_nomi, fetched_at) in bando_config."""
    import json as _json
    from datetime import datetime as _dt
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO bando_config (commission_id, rdp_nomi, commissione_nomi, fetched_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (commission_id) DO UPDATE SET
                    rdp_nomi         = EXCLUDED.rdp_nomi,
                    commissione_nomi = EXCLUDED.commissione_nomi,
                    fetched_at       = EXCLUDED.fetched_at
            """, (
                commission_id,
                _json.dumps(rdp_nomi, ensure_ascii=False),
                _json.dumps(commissione_nomi, ensure_ascii=False),
                _dt.now(),
            ))
        conn.commit()


def get_merged_config(session_id, commission_id):
    """
    Restituisce la configurazione completa unendo bando_config (livello bando)
    e sessione_config (livello sessione — informatico in sede).
    """
    cfg = {}
    bando = get_bando_config(commission_id)
    if bando:
        cfg.update(bando)
    sessione = get_sessione_config(session_id)
    if sessione:
        session_values = {k: v for k, v in sessione.items() if v is not None}
        if cfg.get("data_accesso_piattaforma"):
            session_values.pop("data_accesso_piattaforma", None)
        cfg.update(session_values)
    return cfg if cfg else None
