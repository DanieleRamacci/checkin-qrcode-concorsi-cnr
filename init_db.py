import sqlite3

DB_PATH = 'checkin.db'

with sqlite3.connect(DB_PATH) as conn:
    cursor = conn.cursor()

    # Rimuove la tabella esistente (opzionale se siamo in fase iniziale)
    cursor.execute("DROP TABLE IF EXISTS sessioni")

    # Tabella sessioni aggiornata
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessioni (
        session_id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        giorno TEXT NOT NULL,
        ora TEXT NOT NULL,
        luogo TEXT NOT NULL,
        attiva INTEGER DEFAULT 0
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
        checkin_effettuato INTEGER DEFAULT 0,
        documento_scaduto INTEGER DEFAULT 0,
        PRIMARY KEY (uid, session_id),
        FOREIGN KEY (session_id) REFERENCES sessioni(session_id)
    );
    """)

    print("✅ Database inizializzato con successo.")
