import os
import psycopg2

DB_CONFIG = {
    'host': os.environ.get('POSTGRES_HOST', 'db'),
    'port': os.environ.get('POSTGRES_PORT', '5432'),
    'dbname': os.environ.get('POSTGRES_DB', 'checkin'),
    'user': os.environ.get('POSTGRES_USER', 'postgres'),
    'password': os.environ.get('POSTGRES_PASSWORD', '')
}

# Support using a local SQLite file for tests by setting DATABASE_FILE env var.
# The wrapper implements a minimal subset of psycopg2.Connection/cursor API used by the app
import sqlite3
from contextlib import contextmanager

class SQLiteCursorWrapper:
    def __init__(self, cur):
        self._cur = cur
        self.rowcount = -1

    def execute(self, *args, **kwargs):
        res = self._cur.execute(*args)
        try:
            self.rowcount = self._cur.rowcount
        except Exception:
            self.rowcount = -1
        return res

    def executemany(self, *args, **kwargs):
        res = self._cur.executemany(*args, **kwargs)
        try:
            self.rowcount = self._cur.rowcount
        except Exception:
            self.rowcount = -1
        return res

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def __iter__(self):
        return iter(self._cur)

    def close(self):
        try:
            self._cur.close()
        except Exception:
            pass

class SQLiteConnectionWrapper:
    def __init__(self, path):
        self._conn = sqlite3.connect(path, check_same_thread=False)
        # Make row results behave like tuples; some code expects tuple indices
        self._conn.row_factory = None

    def cursor(self, cursor_factory=None, *args, **kwargs):
        cur = self._conn.cursor()
        return SQLiteCursorCM(cur)

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        # Do not close connection here (caller controls lifecycle), but commit/rollback handled in app
        return False

class SQLiteCursorCM:
    def __init__(self, cur):
        self._cur = cur
        self._wrapper = SQLiteCursorWrapper(cur)

    def __enter__(self):
        return self._wrapper

    def __exit__(self, exc_type, exc, tb):
        try:
            self._cur.close()
        except Exception:
            pass
        return False


def get_db_connection():
    sqlite_file = os.environ.get('DATABASE_FILE')
    if sqlite_file:
        return SQLiteConnectionWrapper(sqlite_file)
    return psycopg2.connect(**DB_CONFIG)
