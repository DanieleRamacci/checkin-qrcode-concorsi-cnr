import sqlite3

DB_PATH = 'checkin.db'

with sqlite3.connect(DB_PATH) as conn:
    cursor = conn.cursor()

    # Tabella sessioni
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessioni (
        session_id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        creata_il TEXT NOT NULL
    );
    """)

    # Tabella candidati
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS candidati (
        id TEXT,
        session_id TEXT,
        nome TEXT,
        cognome TEXT,
        numero_documento TEXT,
        checkin_effettuato INTEGER DEFAULT 0,
        PRIMARY KEY (id, session_id),
        FOREIGN KEY (session_id) REFERENCES sessioni(session_id)
    );
    """)

    print("✅ Database inizializzato con successo.")
