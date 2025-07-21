import psycopg2
from psycopg2 import sql

# ⚠️ Configurazione DB
DB_NAME = "checkin"
DB_USER = "postgres"
DB_PASSWORD = "password"
DB_HOST = "localhost"
DB_PORT = "5432"

try:
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    cursor = conn.cursor()

    # Drop tabelle (⚠️ solo in fase di sviluppo!)
    cursor.execute("DROP TABLE IF EXISTS candidati CASCADE")
    cursor.execute("DROP TABLE IF EXISTS sessioni CASCADE")
    cursor.execute("DROP TABLE IF EXISTS commissions CASCADE")
    cursor.execute("DROP TABLE IF EXISTS dispositivi CASCADE")

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
        FOREIGN KEY (commission_id, user_email) REFERENCES commissions(commission_id, user_email)
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
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Database PostgreSQL aggiornato con successo.")

except Exception as e:
    print(f"❌ Errore durante la creazione delle tabelle: {e}")
