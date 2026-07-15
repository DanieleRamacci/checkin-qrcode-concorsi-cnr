from contextlib import contextmanager

from utils import sessioni


class FakeCursor:
    def __init__(self, executed):
        self.executed = executed

    def execute(self, query, params):
        self.executed.append((query, params))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


class FakeConnection:
    def __init__(self, executed):
        self.executed = executed

    def cursor(self):
        return FakeCursor(self.executed)

    def commit(self):
        return None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


def connection_factory(executed):
    @contextmanager
    def factory():
        yield FakeConnection(executed)

    return factory


def test_update_bando_da_openapi_clears_missing_secretary(monkeypatch):
    executed = []
    monkeypatch.setattr(sessioni, "get_db_connection", connection_factory(executed))
    monkeypatch.setattr(sessioni, "refresh_bando_config_status", lambda commission_id: {})

    sessioni.update_bando_da_openapi(
        "commission-1",
        rdps=[],
        commissioners=[
            {
                "firstName": "Mario",
                "lastName": "Rossi",
                "email": "mario.rossi@cnr.it",
                "ruolo": "PRESIDENTE",
            }
        ],
    )

    query, params = executed[0]
    assert "email_segretario    = EXCLUDED.email_segretario" in query
    assert params[-1] is None


def test_update_bando_da_openapi_sets_first_secretary(monkeypatch):
    executed = []
    monkeypatch.setattr(sessioni, "get_db_connection", connection_factory(executed))
    monkeypatch.setattr(sessioni, "refresh_bando_config_status", lambda commission_id: {})

    sessioni.update_bando_da_openapi(
        "commission-1",
        rdps=[],
        commissioners=[
            {
                "firstName": "Segretaria",
                "lastName": "CNR",
                "email": "segretario@cnr.it",
                "ruolo": "SEGRETARIO",
            }
        ],
    )

    assert executed[0][1][-1] == "segretario@cnr.it"

