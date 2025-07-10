import sqlite3

DB_PATH = 'checkin.db'

with sqlite3.connect(DB_PATH) as conn:
    cursor = conn.cursor()

    # Drop opzionali
    cursor.execute("DROP TABLE IF EXISTS sessioni")
    cursor.execute("DROP TABLE IF EXISTS commissions")

    # ✅ Tabella commissions (bandi)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS commissions (
        commission_id TEXT,
        titolo TEXT NOT NULL,
        user_email TEXT NOT NULL,
        data_sync TEXT,
        PRIMARY KEY (commission_id, user_email)
    );
    """)

    # ✅ Tabella sessioni aggiornata
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
        attiva INTEGER DEFAULT 0,
        candidati_importati INTEGER DEFAULT 0,
        sync_user_email TEXT,
        data_sync TEXT,
        FOREIGN KEY (commission_id, user_email) REFERENCES commissions(commission_id, user_email)
    );
    """)

    # ✅ Tabella candidati
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
        checkin_effettuato INTEGER DEFAULT 0,
        documento_scaduto INTEGER DEFAULT 0,
        PRIMARY KEY (uid, session_id),
        FOREIGN KEY (session_id) REFERENCES sessioni(session_id)
    );
    """)

    print("✅ Database aggiornato con successo.")
