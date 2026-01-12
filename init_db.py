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
        device_token TEXT,
        last_seen TIMESTAMP,
        disconnected_at TIMESTAMP,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("""
    CREATE UNIQUE INDEX IF NOT EXISTS dispositivi_device_token_uq
    ON dispositivi (device_token);
    """)
    # Tabella liste generate
    cursor.execute("""
    CREATE TABLE liste_generate (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        file_xlsx TEXT NOT NULL,
        file_csv_moodle TEXT NOT NULL,
        num_presenti INTEGER NOT NULL,
        generato_da TEXT NOT NULL,
        timestamp_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   """)

    conn.commit()
    cursor.close()
    conn.close()

    print(" Database PostgreSQL aggiornato con successo.")

except Exception as e:
    print(f" Errore durante la creazione delle tabelle: {e}")
