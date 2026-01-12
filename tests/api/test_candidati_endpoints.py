import os
import sqlite3
import pytest
from server_sqlite import app, DB_PATH


@pytest.fixture(autouse=True)
def setup_db(tmp_path, monkeypatch):
    # Use temp DB for tests
    test_db = str(tmp_path / "test_checkin.db")
    monkeypatch.setenv('CHECKIN_STATE_ENFORCEMENT', '1')
    # Copy schema from init_db? simple create tables needed for tests
    conn = sqlite3.connect(test_db)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessioni (
            session_id TEXT PRIMARY KEY,
            commission_id TEXT,
            user_email TEXT,
            session_string TEXT,
            nome TEXT,
            giorno TEXT,
            ora TEXT,
            luogo TEXT,
            data_esame TEXT,
            attiva INTEGER DEFAULT 0,
            candidati_importati INTEGER DEFAULT 0,
            stato_corrente TEXT DEFAULT 'iniziale'
        );
    """)
    cur.execute("""
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
            PRIMARY KEY (uid, session_id)
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dispositivi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    conn.commit()
    conn.close()

    # point the app to this DB
    monkeypatch.setenv('DATABASE_FILE', test_db)
    # server_sqlite uses DB_PATH variable; monkeypatch it
    from importlib import reload
    import server_sqlite
    server_sqlite.DB_PATH = test_db

    yield


def test_verifica_blocked_if_not_started():
    import importlib, server_sqlite
    server_sqlite = importlib.reload(server_sqlite)
    client = server_sqlite.app.test_client()
    # prepare data: session in 'iniziale', candidate exists, device registered
    with sqlite3.connect(server_sqlite.DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("INSERT OR REPLACE INTO sessioni (session_id, stato_corrente) VALUES (?, ?)", ('S1', 'iniziale'))
        cur.execute("INSERT OR REPLACE INTO candidati (uid, session_id, first_name, last_name, document_number) VALUES (?, ?, ?, ?, ?)", ('U1', 'S1', 'Mario', 'Rossi', 'X123'))
        cur.execute("INSERT INTO dispositivi (session_id, device_token) VALUES (?, ?)", ('S1', 'token123'))
        conn.commit()

    res = client.post('/verifica-candidato', json={'uid': 'U1', 'session_id': 'S1', 'device_token': 'token123'})
    assert res.status_code == 409
    data = res.get_json()
    assert data['success'] is False
    assert 'Check-in non avviato' in data['message']


def test_verifica_success_if_checkin_avviato():
    import importlib, server_sqlite
    server_sqlite = importlib.reload(server_sqlite)
    client = server_sqlite.app.test_client()
    with sqlite3.connect(server_sqlite.DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("INSERT OR REPLACE INTO sessioni (session_id, stato_corrente) VALUES (?, ?)", ('S2', 'checkin_avviato'))
        cur.execute("INSERT OR REPLACE INTO candidati (uid, session_id, first_name, last_name, document_number) VALUES (?, ?, ?, ?, ?)", ('U2', 'S2', 'Anna', 'Verdi', 'Y456'))
        cur.execute("INSERT INTO dispositivi (session_id, device_token) VALUES (?, ?)", ('S2', 'token456'))
        conn.commit()

    res = client.post('/verifica-candidato', json={'uid': 'U2', 'session_id': 'S2', 'device_token': 'token456'})
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert data['candidato']['nome'] == 'Anna'


def test_checkin_blocked_if_concluded():
    import importlib, server_sqlite
    server_sqlite = importlib.reload(server_sqlite)
    client = server_sqlite.app.test_client()
    with sqlite3.connect(server_sqlite.DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("INSERT OR REPLACE INTO sessioni (session_id, stato_corrente) VALUES (?, ?)", ('S3', 'checkin_concluso'))
        cur.execute("INSERT OR REPLACE INTO candidati (uid, session_id, first_name, last_name, document_number) VALUES (?, ?, ?, ?, ?)", ('U3', 'S3', 'Luca', 'Bianchi', 'Z789'))
        cur.execute("INSERT INTO dispositivi (session_id, device_token) VALUES (?, ?)", ('S3', 'token789'))
        conn.commit()

    res = client.post('/checkin-candidato', json={'uid': 'U3', 'session_id': 'S3', 'device_token': 'token789'})
    assert res.status_code == 409
    data = res.get_json()
    assert data['success'] is False
    assert 'Check-in non avviato' in data['message'] or 'Check-in concluso' in data['message']


def test_checkin_success_if_avviato():
    import importlib, server_sqlite
    server_sqlite = importlib.reload(server_sqlite)
    client = server_sqlite.app.test_client()
    with sqlite3.connect(server_sqlite.DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("INSERT OR REPLACE INTO sessioni (session_id, stato_corrente) VALUES (?, ?)", ('S4', 'checkin_avviato'))
        cur.execute("INSERT OR REPLACE INTO candidati (uid, session_id, first_name, last_name, document_number) VALUES (?, ?, ?, ?, ?)", ('U4', 'S4', 'Paola', 'Neri', 'W321'))
        cur.execute("INSERT INTO dispositivi (session_id, device_token) VALUES (?, ?)", ('S4', 'token321'))
        conn.commit()

    res = client.post('/checkin-candidato', json={'uid': 'U4', 'session_id': 'S4', 'device_token': 'token321'})
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    # verify DB updated
    with sqlite3.connect(server_sqlite.DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT checkin_effettuato FROM candidati WHERE uid = ? AND session_id = ?", ('U4', 'S4'))
        row = cur.fetchone()
        assert row and row[0] == 1