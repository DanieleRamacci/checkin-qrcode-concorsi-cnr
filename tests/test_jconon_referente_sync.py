from contextlib import contextmanager
from unittest.mock import ANY


class RecordingCursor:
    def __init__(self, calls):
        self.calls = calls

    def execute(self, query, params=None):
        self.calls.append((" ".join(query.split()), params))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


class RecordingConnection:
    def __init__(self, calls):
        self.calls = calls
        self.committed = False

    def cursor(self):
        return RecordingCursor(self.calls)

    def commit(self):
        self.committed = True

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


def test_persist_referente_bandi_upserts_and_revokes_stale(monkeypatch):
    from utils import jconon_service

    calls = []
    conn = RecordingConnection(calls)

    @contextmanager
    def factory():
        yield conn

    monkeypatch.setattr(jconon_service, "get_db_connection", factory)
    monkeypatch.setattr(
        jconon_service, "update_bando_da_openapi", lambda *args, **kwargs: None
    )

    jconon_service._persist_referente_bandi(
        "Rita.Verdi@CNR.it",
        [
            {
                "commission_id": "bando-1",
                "title": "Concorso 1",
                "rdps": [],
                "commissioners": [],
            }
        ],
    )

    insert_calls = [c for c in calls if c[0].startswith("INSERT INTO bando_referenti")]
    delete_calls = [c for c in calls if c[0].startswith("DELETE FROM bando_referenti")]

    assert len(insert_calls) == 1
    assert insert_calls[0][1] == ("bando-1", "rita.verdi@cnr.it", "Concorso 1", ANY)

    assert len(delete_calls) == 1
    assert delete_calls[0][1] == ("rita.verdi@cnr.it", ["bando-1"])
    assert conn.committed


def test_persist_referente_bandi_revokes_all_when_no_bandi_returned(monkeypatch):
    from utils import jconon_service

    calls = []
    conn = RecordingConnection(calls)

    @contextmanager
    def factory():
        yield conn

    monkeypatch.setattr(jconon_service, "get_db_connection", factory)

    jconon_service._persist_referente_bandi("referente@cnr.it", [])

    assert calls == [
        ("DELETE FROM bando_referenti WHERE user_email = %s", ("referente@cnr.it",))
    ]
    assert conn.committed
