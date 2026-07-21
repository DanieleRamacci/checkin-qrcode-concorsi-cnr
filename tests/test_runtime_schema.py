from utils import schema


def test_runtime_schema_adds_remote_expert_status_columns(monkeypatch):
    executed = []

    class FakeCursor:
        def execute(self, query):
            executed.append(query)

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    class FakeConnection:
        def cursor(self):
            return FakeCursor()

        def commit(self):
            executed.append("COMMIT")

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    monkeypatch.setattr(schema, "get_db_connection", lambda: FakeConnection())

    schema.ensure_runtime_schema()

    statements = "\n".join(executed)
    assert "ALTER TABLE bando_config ADD COLUMN IF NOT EXISTS email_esperto_remoto TEXT" in statements
    assert "ALTER TABLE bando_config ADD COLUMN IF NOT EXISTS config_status TEXT" in statements
    assert "ALTER TABLE bando_config ADD COLUMN IF NOT EXISTS expert_assigned BOOLEAN NOT NULL DEFAULT FALSE" in statements
    assert "ALTER TABLE bando_config ADD COLUMN IF NOT EXISTS required_data_complete BOOLEAN NOT NULL DEFAULT FALSE" in statements
    assert "ALTER TABLE sessioni ADD COLUMN IF NOT EXISTS stato_corrente TEXT DEFAULT 'iniziale'" in statements
    assert "ALTER TABLE sessioni ADD COLUMN IF NOT EXISTS data_esame TEXT" in statements
    assert "ALTER TABLE candidati ADD COLUMN IF NOT EXISTS reset_password_richiesto BOOLEAN DEFAULT FALSE" in statements
    assert "ALTER TABLE candidati ADD COLUMN IF NOT EXISTS reset_password_effettuato BOOLEAN DEFAULT FALSE" in statements
    assert "COMMIT" in executed
