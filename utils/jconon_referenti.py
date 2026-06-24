"""
utils/jconon_referenti.py

Estrazione referenti RDP/RUP e membri commissione da JCOnon CNR.

Variabili d'ambiente:
  JCONON_BASE_URL      default: https://selezionionline.cnr.it/jconon
  JCONON_USERNAME      username basic-auth
  JCONON_PASSWORD      password basic-auth
  AUTH_B64             alternativa: base64("user:pass") già codificato
  OIDC_ACCESS_TOKEN    opzionale: Bearer token OIDC (prioritario)
"""

import base64
import io
import logging
import os
import re
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# ─── Configurazione ───────────────────────────────────────────────────────────

JCONON_BASE    = os.getenv("JCONON_BASE_URL", os.getenv("BASE_URL", "https://selezionionline.cnr.it/jconon")).rstrip("/")
JCONON_USER    = os.getenv("JCONON_USERNAME", "")
JCONON_PASS    = os.getenv("JCONON_PASSWORD", "")
AUTH_B64       = os.getenv("AUTH_B64", "")
JCONON_BEARER  = os.getenv("JCONON_BEARER_TOKEN", "")  # token dedicato per JCOnon (non OIDC Flask)

TIMEOUT     = 20
MAX_RETRIES = 2

# ─── Pattern regex ────────────────────────────────────────────────────────────

_RE_RDP = re.compile(
    r"(?:responsabil[ea]\s+del\s+procediment[oa]|RUP)\s*[:\-]?\s*"
    r"([A-ZÀ-Ùa-zà-ù][^.;:\n<]{3,80})",
    re.IGNORECASE,
)

_RE_COMMISSIONE_BLOCK = re.compile(
    r"(?:commissione\s+(?:esaminatrice|giudicatrice)?|nomina\s+commissione)"
    r"(?:[^<]{0,600})",
    re.IGNORECASE | re.DOTALL,
)

_RE_ALLEGATO_COMMISSIONE = re.compile(
    r"nomina.{0,30}commissione|commissione.{0,30}nomina",
    re.IGNORECASE,
)

_RE_NOME_PROPRIO = re.compile(
    r"(?:Dott(?:\.ssa)?\.?\s+|Prof(?:\.ssa)?\.?\s+|Ing\.?\s+|Dr\.?\s+)?"
    r"(?:[A-ZÀ-Ù][a-zà-ù]+\s+){1,3}[A-ZÀ-Ù][a-zà-ù]+"
)

_RE_LINK = re.compile(
    r'<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)

# ─── HTTP session ─────────────────────────────────────────────────────────────

def _make_retry_adapter() -> HTTPAdapter:
    retry = Retry(
        total=MAX_RETRIES,
        backoff_factor=0.5,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    return HTTPAdapter(max_retries=retry)


def _make_session_oidc(access_token: str) -> requests.Session:
    """
    Sessione per endpoint OpenAPI (/openapi/v1/...) — usa OIDC Bearer token.
    """
    s = requests.Session()
    s.mount("https://", _make_retry_adapter())
    s.mount("http://", _make_retry_adapter())
    s.headers["Accept"] = "application/json"
    if access_token:
        s.headers["Authorization"] = f"Bearer {access_token}"
    return s


def _make_session() -> requests.Session:
    """
    Sessione per endpoint Alfresco REST (/rest/proxy/...) — usa Basic auth da env.
    Priorità: JCONON_BEARER_TOKEN > AUTH_B64 > JCONON_USERNAME:PASSWORD
    """
    s = requests.Session()
    s.mount("https://", _make_retry_adapter())
    s.mount("http://", _make_retry_adapter())
    s.headers["Accept"] = "application/json"

    if JCONON_BEARER:
        s.headers["Authorization"] = f"Bearer {JCONON_BEARER}"
    elif AUTH_B64:
        s.headers["Authorization"] = f"Basic {AUTH_B64}"
    elif JCONON_USER:
        encoded = base64.b64encode(f"{JCONON_USER}:{JCONON_PASS}".encode()).decode()
        s.headers["Authorization"] = f"Basic {encoded}"

    return s


# Ticket Alfresco in cache (evita login ad ogni chiamata)
_alf_ticket_cache: dict = {"ticket": "", "ts": 0.0}
_ALF_TICKET_TTL = 3600  # secondi


def _get_alfresco_ticket() -> str:
    """
    Login a Alfresco con JCONON_USERNAME/PASSWORD e ritorna un ticket (alf_ticket).
    Il ticket viene cachato per _ALF_TICKET_TTL secondi.
    Necessario perché /rest/proxy?url=service/cnr/... richiede sessione Alfresco,
    non accetta Bearer OIDC né Basic auth header.
    """
    import time as _time
    global _alf_ticket_cache

    if not JCONON_USER or not JCONON_PASS:
        return ""

    now = _time.monotonic()
    if _alf_ticket_cache["ticket"] and (now - _alf_ticket_cache["ts"]) < _ALF_TICKET_TTL:
        return _alf_ticket_cache["ticket"]

    url = f"{JCONON_BASE}/rest/api/login"
    try:
        resp = requests.post(url, json={"username": JCONON_USER, "password": JCONON_PASS}, timeout=10)
        resp.raise_for_status()
        ticket = resp.json().get("data", {}).get("ticket", "")
        if ticket:
            _alf_ticket_cache = {"ticket": ticket, "ts": now}
            logger.debug("_get_alfresco_ticket: nuovo ticket ottenuto")
        return ticket
    except Exception as exc:
        logger.warning("_get_alfresco_ticket: %s", exc)
        return ""


# ─── Utility ──────────────────────────────────────────────────────────────────

def _dedup(lst: list) -> list:
    """Rimuove duplicati (case-insensitive) mantenendo l'ordine di apparizione."""
    seen: set = set()
    out = []
    for item in lst:
        key = item.lower().strip()
        if key and key not in seen:
            seen.add(key)
            out.append(item.strip())
    return out


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text)


def _estrai_nomi_da_testo(testo: str) -> list:
    return [m.group(0).strip() for m in _RE_NOME_PROPRIO.finditer(testo)]


# ─── Step 1: ricerca bando via CMIS ──────────────────────────────────────────

def search_call(codice: str, sess: requests.Session) -> tuple:
    """
    Cerca il bando per codice su /rest/search con query CMIS.
    Ritorna (uuid: str, props_raw: dict).
    """
    url = f"{JCONON_BASE}/rest/search"

    def _run_query(q: str) -> list:
        resp = sess.get(url, params={"q": q, "maxItems": 5, "skipCount": 0}, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json().get("list", {}).get("entries", [])

    # Prima prova: campo dedicato jconon_call:codice
    queries = [
        f"SELECT * FROM jconon_call:folder WHERE jconon_call:codice = '{codice}'",
        f"SELECT * FROM jconon_call:folder WHERE cmis:name LIKE '%{codice}%'",
    ]

    entries = []
    for q in queries:
        try:
            entries = _run_query(q)
            if entries:
                break
        except Exception as exc:
            logger.debug("CMIS query %r fallita: %s", q, exc)

    if not entries:
        return "", {}

    props = entries[0].get("entry", {})

    # Estrai uuid da alfcmis:nodeRef (workspace://SpacesStore/<uuid>)
    node_ref = props.get("alfcmis:nodeRef", "")
    uuid = node_ref.rsplit("/", 1)[-1] if node_ref else ""
    if not uuid:
        # fallback: cmis:objectId può essere "workspace://.../<uuid>;1.0"
        uuid = props.get("cmis:objectId", "").split(";")[0].rsplit("/", 1)[-1]

    logger.info("search_call: trovato uuid=%r per codice=%r", uuid, codice)
    return uuid, props


# ─── Step 1b: risali al bando dalla commissione ──────────────────────────────

def _get_call_uuid_from_commission(commission_id: str, sess: requests.Session) -> str:
    """
    Data la commissione UUID (quello in local DB), risale all'UUID del bando (call)
    tramite l'API Alfresco parent node.
    In JCOnon la commissione è figlia diretta del bando, quindi il parent è il bando.
    """
    from urllib.parse import quote as _q
    url = f"{JCONON_BASE}/rest/proxy"
    params = {
        "url": f"api/node/workspace/SpacesStore/{_q(commission_id)}/parent",
        "ajax": "true",
    }
    try:
        resp = sess.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        # Alfresco risponde con {"parent": {"nodeRef": "workspace://SpacesStore/<uuid>", ...}}
        # oppure direttamente {"nodeRef": ...}
        node_ref = ""
        if isinstance(data, dict):
            parent = data.get("parent") or data
            node_ref = (
                parent.get("nodeRef", "")
                or parent.get("alfcmis:nodeRef", "")
            )
        if node_ref:
            call_uuid = node_ref.rsplit("/", 1)[-1].split(";")[0]
            logger.debug("_get_call_uuid_from_commission: commission=%s -> call=%s", commission_id, call_uuid)
            return call_uuid
    except Exception as exc:
        logger.debug("_get_call_uuid_from_commission(%s): %s", commission_id, exc)
    return ""


# ─── Step 2: dettaglio bando via OpenAPI ─────────────────────────────────────

def fetch_call_detail_api(uuid: str, sess: requests.Session) -> dict:
    """GET /openapi/v1/call/{uuid} — ritorna il JSON del bando."""
    if not uuid:
        return {}
    url = f"{JCONON_BASE}/openapi/v1/call/{uuid}"
    try:
        resp = sess.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("fetch_call_detail_api(%s): %s", uuid, exc)
        return {}


# ─── Step 3: membri gruppo RDP ───────────────────────────────────────────────

def fetch_rdp_members(rdp_raw: str, sess: requests.Session) -> list:
    """
    Dato il valore di jconon_call:rdp, ritorna la lista dei membri del gruppo RDP.
    Endpoint: /rest/proxy?url=service/cnr/groups/GROUP_{rdp}/members

    NOTA: l'URL del proxy va costruito manualmente — requests con params= codifica
    le barre come %2F, rompendo il routing Alfresco. Le barre devono restare letterali.
    """
    if not rdp_raw:
        return []

    from urllib.parse import quote as _q
    inner_path = f"service/cnr/groups/GROUP_{rdp_raw}/members"
    inner_enc = _q(inner_path, safe="/:@._-~")
    ticket = _get_alfresco_ticket()
    url = f"{JCONON_BASE}/rest/proxy?url={inner_enc}"
    if ticket:
        url += f"&alf_ticket={ticket}"
    try:
        resp = sess.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        logger.debug("fetch_rdp_members(%s) raw: %s", rdp_raw, data)

        # la risposta può essere una lista diretta o un dict con "data" o "people"
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            rows = data.get("people") or data.get("data") or data.get("members") or []
        else:
            rows = []

        members = []
        for item in rows:
            if not isinstance(item, dict):
                if isinstance(item, str) and item.strip():
                    members.append(item.strip())
                continue
            name = (
                item.get("displayName")
                or item.get("fullName")
                or item.get("name")
                or item.get("userName")
                or item.get("shortName")
                or ""
            )
            if isinstance(name, str) and name.strip():
                members.append(name.strip())

        logger.info("fetch_rdp_members(%s): trovati %d membri", rdp_raw, len(members))
        return _dedup(members)
    except Exception as exc:
        logger.warning("fetch_rdp_members(%s): %s", rdp_raw, exc)
        return []


# ─── Step 4: fallback referenti da HTML ──────────────────────────────────────

def parse_call_detail_referenti(html: str) -> list:
    """
    Cerca pattern RUP/responsabile procedimento nell'HTML della pagina call-detail.
    """
    nomi = []
    for m in _RE_RDP.finditer(html):
        candidate = _strip_html(m.group(1)).strip()
        if candidate:
            nomi.append(candidate)
    return _dedup(nomi)


# ─── Step 5: commissione (best effort) ───────────────────────────────────────

def _estrai_pdf_nomi(url: str, sess: requests.Session) -> list:
    """Scarica un PDF e tenta l'estrazione di nomi propri."""
    try:
        resp = sess.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        content = resp.content
    except Exception as exc:
        logger.debug("_estrai_pdf_nomi download fallito (%s): %s", url, exc)
        return []

    try:
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                testo = "\n".join(page.extract_text() or "" for page in pdf.pages)
        except ImportError:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            testo = "\n".join(page.extract_text() or "" for page in reader.pages)
        return _estrai_nomi_da_testo(testo)
    except Exception as exc:
        logger.debug("_estrai_pdf_nomi parsing fallito: %s", exc)
        return []


def parse_commissione(html: str, sess: requests.Session) -> tuple:
    """
    Estrae nomi della commissione dall'HTML e da eventuali PDF allegati.
    Ritorna (nomi: list, fonti: list).
    """
    nomi: list = []
    fonti: list = []

    # 1) Cerca blocchi testo con "commissione"
    for m in _RE_COMMISSIONE_BLOCK.finditer(html):
        testo = _strip_html(m.group(0))
        nomi.extend(_estrai_nomi_da_testo(testo))
    if nomi:
        fonti.append("call_detail_html_commissione")

    # 2) Cerca link allegati con titolo/href simile a "nomina commissione"
    for lm in _RE_LINK.finditer(html):
        href = lm.group(1)
        testo_link = _strip_html(lm.group(2))
        if _RE_ALLEGATO_COMMISSIONE.search(testo_link) or _RE_ALLEGATO_COMMISSIONE.search(href):
            full_url = (
                href if href.startswith("http")
                else f"{JCONON_BASE.rstrip('/')}/{href.lstrip('/')}"
            )
            pdf_nomi = _estrai_pdf_nomi(full_url, sess)
            if pdf_nomi:
                nomi.extend(pdf_nomi)
                fonti.append("allegato_pdf")
                break  # basta il primo PDF utile

    return _dedup(nomi), fonti


# ─── Funzione principale ──────────────────────────────────────────────────────

def estrai_referenti_e_commissione(codice_concorso: str) -> dict:
    """
    Dato il codice concorso CNR, restituisce referenti RDP e commissione.

    Args:
        codice_concorso: es. "367.493 RIC"

    Returns:
        {
            "codice": str,
            "uuid": str,
            "referenti_rdp": [str, ...],
            "membri_commissione": [str, ...],
            "fonti": [str, ...],
            "errori": [str, ...],
        }
    """
    result: dict = {
        "codice": codice_concorso,
        "uuid": "",
        "referenti_rdp": [],
        "membri_commissione": [],
        "fonti": [],
        "errori": [],
    }

    sess = _make_session()

    # ── Step 1: cerca il bando ───────────────────────────────────────────────
    try:
        uuid, _ = search_call(codice_concorso, sess)
        result["uuid"] = uuid
        if uuid:
            result["fonti"].append("cmis_search")
        else:
            result["errori"].append("bando non trovato via CMIS search")
    except Exception as exc:
        result["errori"].append(f"search_call: {exc}")
        uuid = ""

    # ── Step 2: dettaglio via OpenAPI ────────────────────────────────────────
    rdp_raw = ""
    if uuid:
        try:
            call_data = fetch_call_detail_api(uuid, sess)
            if call_data:
                result["fonti"].append("openapi_call_detail")
                rdp_raw = call_data.get("jconon_call:rdp", "")
        except Exception as exc:
            result["errori"].append(f"fetch_call_detail_api: {exc}")

    # ── Step 3: membri gruppo RDP ────────────────────────────────────────────
    if rdp_raw:
        try:
            membri = fetch_rdp_members(rdp_raw, sess)
            if membri:
                result["referenti_rdp"].extend(membri)
                result["fonti"].append("groups_children")
        except Exception as exc:
            result["errori"].append(f"fetch_rdp_members: {exc}")

    # ── Step 4+5: scarica HTML call-detail (base per fallback e commissione) ─
    html_text = ""
    try:
        from urllib.parse import quote as urlquote
        resp = sess.get(
            f"{JCONON_BASE}/call-detail",
            params={"callCode": codice_concorso},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        html_text = resp.text
        result["fonti"].append("call_detail_html")
    except Exception as exc:
        result["errori"].append(f"call_detail_html fetch: {exc}")

    # Fallback referenti da HTML (se non già trovati via gruppo)
    if html_text and not result["referenti_rdp"]:
        try:
            fallback = parse_call_detail_referenti(html_text)
            result["referenti_rdp"].extend(fallback)
            if fallback:
                result["fonti"].append("call_detail_html_referenti")
        except Exception as exc:
            result["errori"].append(f"parse_call_detail_referenti: {exc}")

    # Commissione (best effort)
    if html_text:
        try:
            commissione, comm_fonti = parse_commissione(html_text, sess)
            result["membri_commissione"].extend(commissione)
            result["fonti"].extend(comm_fonti)
        except Exception as exc:
            result["errori"].append(f"parse_commissione: {exc}")

    # ── Dedup finale ─────────────────────────────────────────────────────────
    result["referenti_rdp"]      = _dedup(result["referenti_rdp"])
    result["membri_commissione"] = _dedup(result["membri_commissione"])
    result["fonti"]              = list(dict.fromkeys(result["fonti"]))

    return result


# ─── Fetch & save per dashboard Flask ────────────────────────────────────────

def fetch_e_salva_bando_meta(commission_id: str, oidc_access_token: str = "") -> dict:
    """
    Recupera RDP da JCOnon per il bando e salva in bando_config.
    commission_id nel DB = UUID del bando (call) su JCOnon.

    - /openapi/v1/call/{uuid}  → OIDC Bearer token (oidc_access_token)
    - /rest/proxy (gruppi RDP) → Basic auth da env (JCONON_USERNAME/PASSWORD)

    Returns:
        {"rdp_nomi": [...], "commissione_nomi": [...], "errori": [...]}
    """
    result: dict = {"rdp_nomi": [], "commissione_nomi": [], "errori": []}
    if not commission_id:
        return result

    try:
        sess_openapi  = _make_session_oidc(oidc_access_token)  # per OpenAPI
        sess_alfresco = _make_session()                         # per /rest/proxy

        call_data = fetch_call_detail_api(commission_id, sess_openapi)
        if not call_data:
            result["errori"].append(f"fetch_call_detail_api({commission_id}): nessun dato")
            return result

        rdp_raw = call_data.get("jconon_call:rdp", "")
        if rdp_raw:
            try:
                result["rdp_nomi"] = fetch_rdp_members(rdp_raw, sess_alfresco)
            except Exception as exc:
                logger.warning("fetch_e_salva_bando_meta rdp (%s): %s", commission_id, exc)
                result["errori"].append(f"rdp_members: {exc}")

        from utils.sessioni import save_bando_meta_from_jconon
        save_bando_meta_from_jconon(commission_id, result["rdp_nomi"], result["commissione_nomi"])
        logger.info(
            "fetch_e_salva_bando_meta OK commission_id=%s rdp=%d",
            commission_id, len(result["rdp_nomi"]),
        )

    except Exception as exc:
        logger.warning("fetch_e_salva_bando_meta (%s): %s", commission_id, exc)
        result["errori"].append(str(exc))

    return result


# ─── CLI / test rapido ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s  %(name)s  %(message)s",
    )

    codice = sys.argv[1] if len(sys.argv) > 1 else "367.493 RIC"
    print(f"\nEstrazione referenti per: {codice!r}\n{'─' * 50}")

    out = estrai_referenti_e_commissione(codice)
    print(json.dumps(out, indent=2, ensure_ascii=False))
