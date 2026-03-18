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

JCONON_BASE = os.getenv("JCONON_BASE_URL", "https://selezionionline.cnr.it/jconon")
JCONON_USER = os.getenv("JCONON_USERNAME", "")
JCONON_PASS = os.getenv("JCONON_PASSWORD", "")
AUTH_B64    = os.getenv("AUTH_B64", "")
OIDC_TOKEN  = os.getenv("OIDC_ACCESS_TOKEN", "")

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

def _make_session() -> requests.Session:
    """Crea una sessione requests con retry e auth configurate da env."""
    s = requests.Session()
    retry = Retry(
        total=MAX_RETRIES,
        backoff_factor=0.5,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    s.mount("https://", adapter)
    s.mount("http://", adapter)

    if OIDC_TOKEN:
        s.headers["Authorization"] = f"Bearer {OIDC_TOKEN}"
    elif AUTH_B64:
        s.headers["Authorization"] = f"Basic {AUTH_B64}"
    elif JCONON_USER:
        encoded = base64.b64encode(f"{JCONON_USER}:{JCONON_PASS}".encode()).decode()
        s.headers["Authorization"] = f"Basic {encoded}"

    return s


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

def _fetch_group_fullname(rdp_raw: str, sess: requests.Session) -> str:
    """Risolve shortName → fullName del gruppo Alfresco."""
    url = f"{JCONON_BASE}/rest/proxy"
    params = {"url": "service/cnr/groups/group", "ajax": "true", "shortName": rdp_raw}
    try:
        resp = sess.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json().get("fullName", "")
    except Exception as exc:
        logger.debug("_fetch_group_fullname(%s): %s", rdp_raw, exc)
        return ""


def fetch_rdp_members(rdp_raw: str, sess: requests.Session) -> list:
    """
    Dato lo shortName del gruppo RDP, ritorna la lista di displayName dei membri.
    """
    if not rdp_raw:
        return []

    full_name = _fetch_group_fullname(rdp_raw, sess) or f"GROUP_{rdp_raw}"

    url = f"{JCONON_BASE}/rest/proxy"
    params = {"url": "service/cnr/groups/children", "ajax": "true", "fullName": full_name}
    try:
        resp = sess.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        members = []
        for item in data.get("data", []):
            name = (
                item.get("displayName")
                or item.get("name")
                or item.get("userName")
                or ""
            )
            if name:
                members.append(name.strip())
        logger.info("fetch_rdp_members(%s): trovati %d membri", rdp_raw, len(members))
        return members
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
