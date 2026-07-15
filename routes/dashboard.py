from flask import Blueprint, make_response, render_template, request, session, redirect, url_for, current_app
from psycopg2.extras import RealDictCursor
from routes.auth import login_required
from db import get_db_connection 
from utils.commissioni import get_commissioni_sincronizzate_with_status
from utils.jconon_service import sync_bando_metadata
from utils.roles import get_user_roles, ROLE_ADMIN, ROLE_ESPERTO, has_any_role
from utils.sessioni import get_sessioni_internamente
from utils.oidc import ensure_fresh_access_token
from datetime import datetime, timezone
import time



SYNC_COOLDOWN_SECONDS = 24 * 60 * 60 # throttle: non risincronizzare se fatta < 90s fa


dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/')
@login_required
def index():
    user_email = session.get('user_email')
    roles = get_user_roles(user_email)
    return render_template(
        'home.html',
        user_email=user_email,
        is_admin=ROLE_ADMIN in roles,
        is_esperto=ROLE_ESPERTO in roles,
        active_page="home"
    )


@dashboard_bp.route('/dashboard/segretario')
@login_required
def dashboard_segretario():
    return redirect("/bandi")






@dashboard_bp.route('/sessioni') 
@login_required
def sessioni():
    commission_id = request.args.get('commission_id')
    mode = request.args.get('mode', 'segretario')
    if not commission_id:
        return redirect("/bandi")

    target = f"/bandi/{commission_id}/sessioni"
    if mode:
        target = f"{target}?mode={mode}"
    return redirect(target)

def _parse_iso_or_none(s: str):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None

@dashboard_bp.route('/sessioni/<commission_id>/frammento')
@login_required
def sessioni_frammento(commission_id):
    from datetime import datetime, timezone  # assicurati di avere questi import
    mode = request.args.get('mode', 'segretario')

    access_token = ensure_fresh_access_token(skew_sec=60)
    user_email   = session.get('user_email')
    if mode == "esperto" and not has_any_role(user_email, [ROLE_ESPERTO, ROLE_ADMIN]):
        return "Utente non autorizzato", 403
    if mode == "sede" and not has_any_role(user_email, [ROLE_ESPERTO, ROLE_ADMIN]):
        return "Utente non autorizzato", 403

    if not user_email or not access_token:
        if request.headers.get('HX-Request') == 'true':
            resp = make_response("", 401)
            resp.headers['HX-Redirect'] = url_for('auth.login')
            return resp
        return redirect(url_for('auth.login'))

    # 1) Lettura IMMEDIATA dal DB (titolo + sessioni + ultimo sync SOLO da tabella sessioni)
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # titolo
            cur.execute("""
                SELECT titolo
                FROM commissions
                WHERE commission_id = %s AND user_email = %s
                LIMIT 1
            """, (commission_id, user_email))
            row = cur.fetchone()
            concorso_titolo = row["titolo"] if row else None

            # sessioni per la tabella
            cur.execute("""
                SELECT s.session_id, s.nome, s.luogo, s.giorno, s.ora, s.attiva, s.data_esame, s.data_sync
                FROM sessioni s
                JOIN commissions c ON c.commission_id = s.commission_id
                WHERE s.commission_id = %s AND c.user_email = %s
                ORDER BY
                  CASE
                    WHEN (NULLIF(s.data_esame, '') IS NOT NULL
                          AND (NULLIF(s.data_esame,'')::date) = CURRENT_DATE) THEN 0
                    WHEN NULLIF(s.data_esame,'') IS NULL THEN 2
                    ELSE 1
                  END,
                  (NULLIF(s.data_esame,''))::date NULLS LAST,
                  s.ora NULLS LAST,
                  s.nome
            """, (commission_id, user_email))
            sessioni = cur.fetchall()

            # ultimo sync SOLO da sessioni (MAX data_sync)
            cur.execute("""
                SELECT MAX(s.data_sync) AS max_session_sync
                FROM sessioni s
                JOIN commissions c ON c.commission_id = s.commission_id
                WHERE s.commission_id = %s AND c.user_email = %s
            """, (commission_id, user_email))
            row2 = cur.fetchone()
            sess_last_sync_raw = row2["max_session_sync"] if row2 else None

    # Normalizza last_sync_dt (TEXT ISO → datetime tz-aware)
    def _norm(dt_raw):
        if isinstance(dt_raw, datetime):
            return dt_raw if dt_raw.tzinfo else dt_raw.replace(tzinfo=timezone.utc)
        if isinstance(dt_raw, str):
            dt = _parse_iso_or_none(dt_raw)
            if dt and dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        return None

    last_sync_dt = _norm(sess_last_sync_raw)

    # 2) Decidi se lanciare la sync
    now_utc = datetime.now(timezone.utc)
    if last_sync_dt is None:
        # Nessuna riga con data_sync → DB effettivamente vuoto (o mai sync riuscita)
        should_sync = (len(sessioni) == 0)
    else:
        # DB con dati → rispetta il cooldown
        should_sync = (now_utc - last_sync_dt).total_seconds() >= SYNC_COOLDOWN_SECONDS

    current_app.logger.debug(
        "[frammento] should_sync=%s len(sessioni)=%d last_sync_dt=%s cooldown=%s",
        should_sync, len(sessioni), last_sync_dt, SYNC_COOLDOWN_SECONDS
    )

    # 3) Sync BLOCCANTE con gestione 401 (retry 1 volta)
    sync_msg = None
    if should_sync:
        current_app.logger.info("[sessioni] SYNC BLOCCANTE avviata commission_id=%s", commission_id)
        t0 = time.monotonic()
        try:
            esito = get_sessioni_internamente(
                commission_id,
                access_token,
                user_email,
                timeout_s=(5, 90),
                retries=0
            )
            dt_ms = (time.monotonic() - t0) * 1000
            current_app.logger.info("[sessioni] SYNC BLOCCANTE finita in %.0fms (esito=%r)", dt_ms, esito)

            if esito == "UNAUTHORIZED":
                current_app.logger.info("[sessioni] 401: provo refresh+retry")
                access_token = ensure_fresh_access_token(skew_sec=60)
                if access_token:
                    esito = get_sessioni_internamente(
                        commission_id,
                        access_token,
                        user_email,
                        timeout_s=(5, 90),
                        retries=0
                    )

            if esito == "UNAUTHORIZED":
                if request.headers.get('HX-Request') == 'true':
                    resp = make_response("", 401)
                    resp.headers['HX-Redirect'] = url_for('auth.login')
                    return resp
                return redirect(url_for('auth.login'))

            elif isinstance(esito, int) and esito >= 0:
                # SUCCESSO (anche 0 insert). Fetch RDP/commissione da JCOnon
                # solo via OpenAPI con token OIDC utente.
                try:
                    if access_token:
                        sync_bando_metadata(commission_id, access_token)
                except Exception as _e:
                    current_app.logger.warning("[bando_meta] fetch fallito: %s", _e)
            else:
                sync_msg = "Sincronizzazione non riuscita"

        except Exception as e:
            sync_msg = f"Errore durante la sincronizzazione: {e}"
            current_app.logger.warning("[sessioni] SYNC BLOCCANTE eccezione %s: %s", commission_id, e)

        # ricarica le sessioni dopo la sync
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT s.session_id, s.nome, s.luogo, s.giorno, s.ora, s.attiva, s.data_esame, s.data_sync
                    FROM sessioni s
                    JOIN commissions c ON c.commission_id = s.commission_id
                    WHERE s.commission_id = %s AND c.user_email = %s
                    ORDER BY
                      CASE
                        WHEN (NULLIF(s.data_esame, '') IS NOT NULL
                              AND (NULLIF(s.data_esame,'')::date) = CURRENT_DATE) THEN 0
                        WHEN NULLIF(s.data_esame,'') IS NULL THEN 2
                        ELSE 1
                      END,
                      (NULLIF(s.data_esame,''))::date NULLS LAST,
                      s.ora NULLS LAST,
                      s.nome
                """, (commission_id, user_email))
                sessioni = cur.fetchall()

    # 4) Render del frammento
    from utils.sessioni import get_bando_config
    bando_config = get_bando_config(commission_id)

    messaggio = sync_msg if sync_msg else None
    return render_template(
        "frammenti/sessioni_tabella.html",
        sessioni=sessioni,
        concorso_titolo=concorso_titolo,
        commission_id=commission_id,
        bando_config=bando_config,
        messaggio=messaggio,
        gestione_base="/esperto/sessione" if mode == "esperto" else ("/sede/sessione" if mode == "sede" else "/gestione-concorso")
    )

####api di test per react 
@dashboard_bp.route('/api/commissioni')
@login_required
def api_commissioni():
    user_email = session.get('user_email')
    access_token = session.get('access_token')

    if not access_token or not user_email:
        return {"error": "Unauthorized"}, 401

    sync_details = get_commissioni_sincronizzate_with_status(access_token, user_email)
    if sync_details.get("unauthorized"):
        return {"error": "Errore nel recupero delle commissioni"}, 500

    return {
        "commissioni": sync_details.get("commissioni", []),
        "sync_error": sync_details.get("sync_error"),
        "sync_source": sync_details.get("sync_source")
    }
