from flask import Blueprint, make_response, render_template, request, session, redirect, url_for, current_app
from psycopg2.extras import RealDictCursor
from routes.auth import login_required
from db import get_db_connection 
from utils.commissioni import get_commissioni_sincronizzate
from utils.sessioni import get_sessioni_internamente
from utils.oidc import ensure_fresh_access_token
from datetime import datetime, timezone
import time
from utils.commissioni import now_iso_utc



SYNC_COOLDOWN_SECONDS = 24 * 60 * 60 # throttle: non risincronizzare se fatta < 90s fa


dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/')
@login_required
def index():
    user_email = session.get('user_email')
    access_token = session.get('access_token')

    if not access_token or not user_email:
        return redirect(url_for('auth.login'))

    commissioni = get_commissioni_sincronizzate(access_token, user_email)

    if commissioni is None:
        session.clear()
        return redirect(url_for('auth.login'))

    return render_template('dashboard.html', commissioni=commissioni, user_email=user_email, active_page="dashboard")






@dashboard_bp.route('/sessioni') 
@login_required
def sessioni():
    commission_id = request.args.get('commission_id')
    if not commission_id:
        return "Commission ID mancante", 400

    user_email = session.get('user_email')

    # recupero titolo concorso
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT titolo FROM commissions
                WHERE commission_id = %s AND user_email = %s
                LIMIT 1
            """, (commission_id, user_email))
            row = cur.fetchone()
            concorso_titolo = row["titolo"] if row else "(Senza titolo)"

    # la tabella NON viene caricata qui: la fa l’endpoint frammento
    return render_template('sessioni.html',
                           commission_id=commission_id,
                           concorso_titolo=concorso_titolo)

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

    access_token = ensure_fresh_access_token(skew_sec=60)
    user_email   = session.get('user_email')

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
                # SUCCESSO (anche 0 insert). Non aggiorniamo commissions.data_sync
                pass
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
    messaggio = sync_msg if sync_msg else None
    return render_template(
        "frammenti/sessioni_tabella.html",
        sessioni=sessioni,
        concorso_titolo=concorso_titolo,
        messaggio=messaggio
    )

####api di test per react 
@dashboard_bp.route('/api/commissioni')
@login_required
def api_commissioni():
    user_email = session.get('user_email')
    access_token = session.get('access_token')

    if not access_token or not user_email:
        return {"error": "Unauthorized"}, 401

    commissioni = get_commissioni_sincronizzate(access_token, user_email)

    if commissioni is None:
        return {"error": "Errore nel recupero delle commissioni"}, 500

    return {"commissioni": commissioni}



