from flask import Blueprint, render_template, request, session, redirect, url_for, current_app
from psycopg2.extras import RealDictCursor
from routes.auth import login_required
from db import get_db_connection 
from utils.commissioni import get_commissioni_sincronizzate
from utils.sessioni import get_sessioni_internamente
from datetime import datetime, timezone
import time
from utils.commissioni import now_iso_utc



SYNC_COOLDOWN_SECONDS = 120 # throttle: non risincronizzare se fatta < 90s fa


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
    access_token = session.get('access_token')
    user_email   = session.get('user_email')

    # 1) Lettura IMMEDIATA dal DB (pagina reattiva)
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT titolo, data_sync
                FROM commissions
                WHERE commission_id = %s AND user_email = %s
                LIMIT 1
            """, (commission_id, user_email))
            row = cur.fetchone()
            concorso_titolo = row["titolo"] if row else None
            last_sync_text  = row["data_sync"] if row else None
            last_sync_dt    = _parse_iso_or_none(last_sync_text)

            cur.execute("""
                SELECT s.session_id, s.nome, s.luogo, s.giorno, s.ora, s.attiva, s.data_esame
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

    # 2) Decidi se lanciare la sync
    should_sync = False
    now_utc = datetime.now(timezone.utc)

    if len(sessioni) == 0:
        should_sync = True
    else:
        if last_sync_dt is None:
            should_sync = True
        else:
            if last_sync_dt.tzinfo is None:
                last_sync_dt = last_sync_dt.replace(tzinfo=timezone.utc)
            if (now_utc - last_sync_dt).total_seconds() >= SYNC_COOLDOWN_SECONDS:
                should_sync = True

    # 3) >>> TEST: sync BLOCCANTE (niente thread) con timeout più alto <<<
    sync_msg = None
    if should_sync:
        current_app.logger.info("[sessioni] SYNC BLOCCANTE avviata commission_id=%s", commission_id)
        t0 = time.monotonic()
        try:
            esito = get_sessioni_internamente(
                commission_id,
                access_token,
                user_email,
                timeout_s=(5, 90),   # <--- aumenta solo per il test
                retries=0
            )
            dt_ms = (time.monotonic() - t0) * 1000
            current_app.logger.info("[sessioni] SYNC BLOCCANTE finita in %.0fms (esito=%s)", dt_ms, esito)

            if esito == "UNAUTHORIZED":
                sync_msg = "Sessione scaduta: effettua di nuovo l’accesso."
                current_app.logger.warning("[sessioni] 401 durante sync bloccante")
            elif isinstance(esito, int) and esito >= 0:
                # aggiorna last sync
                with get_db_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute("""
                            UPDATE commissions
                            SET data_sync = %s
                            WHERE commission_id = %s AND user_email = %s
                        """, ( now_iso_utc() , commission_id, user_email))
                        conn.commit()
            else:
                # es. "read_timeout" o altri messaggi dalla tua funzione
                sync_msg = f"Sincronizzazione non riuscita: {esito}"

        except Exception as e:
            sync_msg = f"Errore durante la sincronizzazione: {e}"
            current_app.logger.warning(f"[sessioni] SYNC BLOCCANTE eccezione {commission_id}: {e}")

        # ricarica le sessioni dopo la sync (sia ok che ko)
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT s.session_id, s.nome, s.luogo, s.giorno, s.ora, s.attiva, s.data_esame
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
    messaggio = None
    if sync_msg:
        messaggio = sync_msg
    elif len(sessioni) == 0:
        messaggio = "Nessuna sessione disponibile in archivio locale."

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
