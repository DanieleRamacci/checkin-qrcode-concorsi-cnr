import os
import psycopg2
from psycopg2 import sql

# Ambiente: 'dev' o 'prod'
APP_ENV = os.getenv("APP_ENV", "dev")  # default: sviluppo

# Configurazione DB da variabili d'ambiente
DB_NAME = os.getenv("POSTGRES_DB", "checkin")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")

print(f" Ambiente: {APP_ENV}")
print(f" Connessione al DB {DB_NAME} su {DB_HOST}:{DB_PORT} con utente '{DB_USER}'")

try:
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    cursor = conn.cursor()

    if APP_ENV == "dev":
        print("  Ambiente di sviluppo: elimino le tabelle esistenti...")
        cursor.execute("DROP TABLE IF EXISTS sessione_config CASCADE")
        cursor.execute("DROP TABLE IF EXISTS bando_config CASCADE")
        cursor.execute("DROP TABLE IF EXISTS bando_referenti CASCADE")
        cursor.execute("DROP TABLE IF EXISTS candidati CASCADE")
        cursor.execute("DROP TABLE IF EXISTS sessioni CASCADE")
        cursor.execute("DROP TABLE IF EXISTS commissions CASCADE")
        cursor.execute("DROP TABLE IF EXISTS dispositivi CASCADE")
        cursor.execute("DROP TABLE IF EXISTS session_state_log CASCADE")
        cursor.execute("DROP TABLE IF EXISTS liste_generate CASCADE")

        


    print("  Creazione delle tabelle (se non esistono)...")

    # Tabella commissions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS commissions (
        commission_id TEXT,
        titolo TEXT NOT NULL,
        user_email TEXT NOT NULL,
        data_sync TEXT,
        PRIMARY KEY (commission_id, user_email)
    );
    """)

    # Ruoli utente (permessi locali)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_roles (
        user_email TEXT NOT NULL,
        role TEXT NOT NULL,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_email, role)
    );
    """)
    # Admin bootstrap (opzionale): BOOTSTRAP_ADMIN_EMAILS="a@x.it,b@y.it"
    bootstrap_emails = os.getenv("BOOTSTRAP_ADMIN_EMAILS", "daniele.ramacci@cnr.it")
    for raw_email in bootstrap_emails.split(","):
        email = raw_email.strip().lower()
        if not email:
            continue
        cursor.execute("""
            INSERT INTO user_roles (user_email, role, created_by)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_email, role) DO NOTHING
        """, (email, "admin_globale", "bootstrap"))

    # Tabella sessioni
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessioni (
        session_id TEXT PRIMARY KEY,
        commission_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        session_string TEXT NOT NULL,
        nome TEXT NOT NULL,
        giorno TEXT NOT NULL,
        ora TEXT NOT NULL,
        luogo TEXT NOT NULL,
        data_esame TEXT,
        attiva BOOLEAN DEFAULT FALSE,
        candidati_importati BOOLEAN DEFAULT FALSE,
        sync_user_email TEXT,
        data_sync TEXT,
        stato_corrente TEXT DEFAULT 'iniziale',
        FOREIGN KEY (commission_id, user_email) REFERENCES commissions(commission_id, user_email)
    );
    """)

    # Configurazione per BANDO (commission_id): dati comuni a tutte le sessioni del bando
    # commissione_members: JSON array [{nome, email}] inseriti manualmente
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bando_config (
        commission_id TEXT PRIMARY KEY,
        email_referente TEXT,
        email_esperto_remoto TEXT,
        email_segretario TEXT,
        telefono_segretario TEXT,
        durata_prova_minuti INTEGER,
        commissione_members TEXT DEFAULT '[]',
        rdp_nomi TEXT DEFAULT '[]',
        commissione_nomi TEXT DEFAULT '[]',
        fetched_at TIMESTAMP,
        configured_at TIMESTAMP,
        configured_by TEXT
    );
    """)

    # Relazione esplicita bando <-> referente/RDP, sincronizzata da Selezioni
    # Online/JConon usando il token OIDC dell'utente loggato. Sostituisce il
    # riuso di `commissions` come proxy di autorizzazione: qui l'email è
    # sempre normalizzata e le righe non più restituite dalla fonte
    # istituzionale vengono cancellate (revoca) invece di restare valide.
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bando_referenti (
        commission_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        nome TEXT,
        synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (commission_id, user_email)
    );
    """)

    # Configurazione per SESSIONE: solo i dati che variano per sessione
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessione_config (
        session_id TEXT PRIMARY KEY,
        nome_informatico_sede TEXT,
        email_informatico_sede TEXT,
        telefono_informatico_sede TEXT,
        data_accesso_piattaforma TEXT,
        FOREIGN KEY (session_id) REFERENCES sessioni(session_id)
    );
    """)

    # Notifiche/messaggi per sessione
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS session_notifications (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        author_email TEXT,
        type TEXT NOT NULL,
        payload TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessioni(session_id)
    );
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS session_notifications_session_idx
        ON session_notifications (session_id, created_at DESC);
    """)
    
    cursor.execute(""" 
    CREATE TABLE IF NOT EXISTS session_state_log (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        stato TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        utente TEXT,
        FOREIGN KEY (session_id) REFERENCES sessioni(session_id)
    );
    """)

    # Tabella candidati
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS candidati (
        uid TEXT,
        session_id TEXT,
        first_name TEXT,
        last_name TEXT,
        birthdate TEXT,
        fiscal_code TEXT,
        document_type TEXT,
        document_number TEXT,
        document_date TEXT,
        document_issued_by TEXT,
        checkin_effettuato BOOLEAN DEFAULT FALSE,
        documento_scaduto BOOLEAN DEFAULT FALSE,
        reset_password_richiesto BOOLEAN DEFAULT FALSE,
        reset_password_richiesto_at TIMESTAMP,
        reset_password_richiesto_by TEXT,
        reset_password_effettuato BOOLEAN DEFAULT FALSE,
        reset_password_effettuato_at TIMESTAMP,
        reset_password_effettuato_by TEXT,
        PRIMARY KEY (uid, session_id),
        FOREIGN KEY (session_id) REFERENCES sessioni(session_id)
    );
    """)

    # Tabella dispositivi
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dispositivi (
        id SERIAL PRIMARY KEY,
        ip_address TEXT,
        user_agent TEXT,
        session_id TEXT,
        nome_dispositivo TEXT,
        operator_email TEXT,
        device_token TEXT,
        last_seen TIMESTAMP,
        disconnected_at TIMESTAMP,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("""
    ALTER TABLE dispositivi
    ADD COLUMN IF NOT EXISTS operator_email TEXT;
    """)
    cursor.execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS dispositivi_device_token_uq
    ON dispositivi (device_token);
    """)
    # Tabella liste generate
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS liste_generate (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        file_xlsx TEXT NOT NULL,
        file_csv_moodle TEXT NOT NULL,
        num_presenti INTEGER NOT NULL,
        generato_da TEXT NOT NULL,
        timestamp_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   """)

    # ===============================
    # Modulo Prove (separato dal check-in)
    # ===============================
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prove (
        prove_id UUID PRIMARY KEY,
        numero_bando TEXT,
        titolo TEXT,
        data_prova DATE,
        ora_prova TIME,
        luogo TEXT,
        tipologia_prova_esame TEXT,
        note_tipologia_prova TEXT,
        esperto_email TEXT NOT NULL,
        referente_nome TEXT,
        referente_email TEXT,
        referente_dati_confermati BOOLEAN NOT NULL DEFAULT FALSE,
        referente_dati_confermati_at TIMESTAMP NULL,
        referente_dati_confermati_by TEXT,
        segretario_nome TEXT,
        segretario_email TEXT,
        segretario_telefono TEXT,
        informatico_sede_nome TEXT,
        informatico_sede_email TEXT,
        informatico_sede_telefono TEXT,
        num_partecipanti INTEGER,
        candidati_tempo_aggiuntivo INTEGER,
        candidati_tempo_aggiuntivo_nomi TEXT,
        num_presenti INTEGER,
        provvedimento_nomina_numero TEXT,
        data_convocazioni_inviate DATE,
        data_lista_candidati_acquisita DATE,
        data_template_moodle_inviati DATE,
        data_excel_presenti_inviato DATE,
        data_lista_presenti_ricevuta DATE,
        data_presenti_attivati_moodle DATE,
        data_valutazione_prova DATE,
        data_convocazione_test_piattaforma DATE,
        busta_estratta_codice TEXT,
        orario_inizio_prova TIMESTAMP NULL,
        durata_minuti INTEGER NULL,
        orario_fine_previsto TIMESTAMP NULL,
        stato_corrente TEXT NOT NULL DEFAULT 'bozza',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by TEXT,
        updated_at TIMESTAMP,
        updated_by TEXT
    );
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_prove_data
    ON prove (data_prova, ora_prova);
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_prove_esperto
    ON prove (esperto_email);
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_prove_stato
    ON prove (stato_corrente);
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prove_documents (
        id SERIAL PRIMARY KEY,
        prove_id UUID REFERENCES prove(prove_id) ON DELETE CASCADE,
        doc_type TEXT NOT NULL,
        filename TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        note TEXT,
        uploaded_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prove_state_log (
        id SERIAL PRIMARY KEY,
        prove_id UUID REFERENCES prove(prove_id) ON DELETE CASCADE,
        from_state TEXT,
        to_state TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        utente TEXT,
        payload_json TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prove_external_tokens (
        token TEXT PRIMARY KEY,
        prove_id UUID REFERENCES prove(prove_id) ON DELETE CASCADE,
        scope TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL,
        created_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prove_support_staff (
        id SERIAL PRIMARY KEY,
        prove_id UUID REFERENCES prove(prove_id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        email TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_prove_support_staff_prove_id
    ON prove_support_staff (prove_id, created_at DESC);
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prove_emails_log (
        id SERIAL PRIMARY KEY,
        prove_id UUID REFERENCES prove(prove_id) ON DELETE CASCADE,
        workflow_state TEXT,
        subject TEXT,
        to_emails TEXT,
        cc_emails TEXT,
        attachments TEXT,
        smtp_status TEXT,
        sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_by TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prove_global_templates (
        id SERIAL PRIMARY KEY,
        doc_type TEXT NOT NULL,
        template_categoria TEXT NOT NULL DEFAULT 'generico',
        filename TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        note TEXT,
        uploaded_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_prove_global_templates_doc_type
    ON prove_global_templates (doc_type, created_at DESC);
    """)

    # Log errori tecnici raw (cross-modulo)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_error_log (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        actor_email TEXT,
        error_type TEXT,
        raw_error TEXT NOT NULL,
        context_json TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    """)
    cursor.execute("""
    CREATE INDEX IF NOT EXISTS idx_system_error_log_created
    ON system_error_log (created_at DESC);
    """)

    # Migrazioni additive sicure su installazioni esistenti

    # sessione_config: migrazioni per installazioni precedenti
    for col, tipo in [
        ("nome_informatico_sede", "TEXT"),
        ("email_informatico_sede", "TEXT"),
        ("telefono_informatico_sede", "TEXT"),
    ]:
        cursor.execute(f"ALTER TABLE sessione_config ADD COLUMN IF NOT EXISTS {col} {tipo};")

    # bando_config: migrazioni additive
    for col, tipo in [
        ("email_referente", "TEXT"),
        ("email_esperto_remoto", "TEXT"),
        ("email_segretario", "TEXT"),
        ("telefono_segretario", "TEXT"),
        ("durata_prova_minuti", "INTEGER"),
        ("commissione_members", "TEXT"),
    ]:
        cursor.execute(f"ALTER TABLE bando_config ADD COLUMN IF NOT EXISTS {col} {tipo};")
    cursor.execute("UPDATE bando_config SET commissione_members = '[]' WHERE commissione_members IS NULL;")

    # sessione_config: migrazioni additive
    cursor.execute("ALTER TABLE sessione_config ADD COLUMN IF NOT EXISTS data_accesso_piattaforma TEXT;")

    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS busta_estratta_codice TEXT;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS num_presenti INTEGER;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS data_valutazione_prova DATE;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS tipologia_prova_esame TEXT;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS note_tipologia_prova TEXT;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS segretario_telefono TEXT;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS informatico_sede_telefono TEXT;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS candidati_tempo_aggiuntivo INTEGER;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS candidati_tempo_aggiuntivo_nomi TEXT;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS referente_dati_confermati BOOLEAN NOT NULL DEFAULT FALSE;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS referente_dati_confermati_at TIMESTAMP NULL;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS referente_dati_confermati_by TEXT;
    """)
    cursor.execute("""
    ALTER TABLE prove
    ADD COLUMN IF NOT EXISTS data_convocazione_test_piattaforma DATE;
    """)
    cursor.execute("""
    ALTER TABLE prove_global_templates
    ADD COLUMN IF NOT EXISTS template_categoria TEXT NOT NULL DEFAULT 'generico';
    """)
    cursor.execute("""
    ALTER TABLE prove_emails_log
    ADD COLUMN IF NOT EXISTS workflow_state TEXT;
    """)

    conn.commit()
    cursor.close()
    conn.close()

    print(" Database PostgreSQL aggiornato con successo.")

except Exception as e:
    print(f" Errore durante la creazione delle tabelle: {e}")
