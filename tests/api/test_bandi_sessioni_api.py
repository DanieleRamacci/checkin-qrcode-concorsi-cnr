from flask import Flask
from contextlib import contextmanager

from routes.api_v1 import api_v1_bp
from routes.api_v1.csrf import get_csrf_token


def create_test_app():
    app = Flask(__name__)
    app.secret_key = "test-secret"
    app.register_blueprint(api_v1_bp)
    app.config.update(TESTING=True)
    return app


def authenticated_client(app, email="owner@cnr.it"):
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = email
    return client


def test_bandi_requires_authentication():
    response = create_test_app().test_client().get("/api/v1/bandi")

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "authentication_required"


def test_bandi_returns_owned_summaries(monkeypatch):
    from routes.api_v1 import bandi

    captured = {}
    monkeypatch.setattr(bandi, "get_user_roles", lambda email: set())
    monkeypatch.setattr(
        bandi,
        "list_bandi",
        lambda email, include_all=False: captured.setdefault("items", [
            {
                "commission_id": "commission-1",
                "title": "Concorso CNR",
                "configured": True,
                "referente_email": "referente@cnr.it",
                "esperto_remoto_email": "esperto@cnr.it",
                "session_count": 2,
                "last_sync": "2026-07-02T10:00:00+00:00",
                "capabilities": ["configure", "view"],
            }
        ]) if not captured.setdefault("include_all", include_all) else [],
    )

    response = authenticated_client(create_test_app()).get("/api/v1/bandi")

    assert response.status_code == 200
    assert response.get_json()["items"][0]["commission_id"] == "commission-1"
    assert response.get_json()["items"][0]["session_count"] == 2
    assert captured["include_all"] is False


def test_bandi_admin_default_keeps_secretary_scope(monkeypatch):
    from routes.api_v1 import bandi

    captured = {}
    monkeypatch.setattr(bandi, "get_user_roles", lambda email: {bandi.ROLE_ADMIN})
    monkeypatch.setattr(
        bandi,
        "list_bandi",
        lambda email, include_all=False: captured.setdefault("items", [])
        if not captured.setdefault("include_all", include_all)
        else [],
    )

    response = authenticated_client(create_test_app(), "admin@cnr.it").get("/api/v1/bandi")

    assert response.status_code == 200
    assert captured["include_all"] is False


def test_bandi_admin_mode_includes_all_local_bandi(monkeypatch):
    from routes.api_v1 import bandi

    captured = {}
    monkeypatch.setattr(bandi, "get_user_roles", lambda email: {bandi.ROLE_ADMIN})
    monkeypatch.setattr(
        bandi,
        "list_bandi",
        lambda email, include_all=False: captured.setdefault("items", [])
        if captured.setdefault("include_all", include_all)
        else [],
    )

    response = authenticated_client(create_test_app(), "admin@cnr.it").get(
        "/api/v1/bandi?mode=admin"
    )

    assert response.status_code == 200
    assert captured["include_all"] is True


def test_bandi_non_admin_cannot_enable_admin_mode(monkeypatch):
    from routes.api_v1 import bandi

    captured = {}
    monkeypatch.setattr(bandi, "get_user_roles", lambda email: set())
    monkeypatch.setattr(
        bandi,
        "list_bandi",
        lambda email, include_all=False: captured.setdefault("items", [])
        if not captured.setdefault("include_all", include_all)
        else [],
    )

    response = authenticated_client(create_test_app()).get("/api/v1/bandi?mode=admin")

    assert response.status_code == 200
    assert captured["include_all"] is False


def test_list_bandi_counts_sessions_by_commission_not_original_user(monkeypatch):
    from routes.api_v1 import bandi

    executed = []

    class FakeCursor:
        def execute(self, query, params):
            executed.append((query, params))

        def fetchall(self):
            return [
                {
                    "commission_id": "commission-1",
                    "title": "Concorso CNR",
                    "is_owner": True,
                    "user_source_role": "SEGRETARIO",
                    "user_access_active": True,
                    "configured": True,
                    "referente_email": None,
                    "esperto_remoto_email": None,
                    "config_status": "da_configurare",
                    "expert_assigned": False,
                    "required_data_complete": False,
                    "session_count": 2,
                    "last_sync": None,
                }
            ]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    class FakeConnection:
        def cursor(self, *args, **kwargs):
            return FakeCursor()

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    @contextmanager
    def fake_connection():
        yield FakeConnection()

    monkeypatch.setattr(bandi, "get_db_connection", fake_connection)

    items = bandi.list_bandi("nuovo.segretario@cnr.it")

    assert items[0]["session_count"] == 2
    assert "s.user_email = c.user_email" not in executed[0][0]


def test_bandi_sync_preserves_cache_error_context(monkeypatch):
    from routes.api_v1 import bandi

    monkeypatch.setattr(
        bandi,
        "ensure_fresh_access_token",
        lambda **kwargs: "fresh-token",
    )
    monkeypatch.setattr(
        bandi,
        "get_commissioni_sincronizzate_with_status",
        lambda token, email: {
            "commissioni": [],
            "unauthorized": False,
            "sync_error": "Servizio remoto non disponibile",
            "sync_source": "db_cache",
        },
    )
    monkeypatch.setattr(bandi, "get_user_roles", lambda email: set())
    monkeypatch.setattr(
        bandi,
        "list_bandi",
        lambda email, include_all=False: [
            {
                "commission_id": "cached",
                "title": "Bando in cache",
                "configured": False,
                "session_count": 0,
                "capabilities": ["view"],
            }
        ],
    )
    app = create_test_app()
    client = authenticated_client(app)
    with client.session_transaction() as flask_session:
        csrf_token = get_csrf_token(flask_session)

    response = client.post(
        "/api/v1/bandi/sync",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    assert response.get_json()["items"][0]["commission_id"] == "cached"
    assert response.get_json()["sync_source"] == "db_cache"
    assert response.get_json()["sync_error"]


def test_referente_bandi_sync_returns_remote_rdp_bandi(monkeypatch):
    from routes.api_v1 import bandi

    monkeypatch.setattr(
        bandi,
        "ensure_fresh_access_token",
        lambda **kwargs: "fresh-token",
    )
    monkeypatch.setattr(
        bandi,
        "fetch_referente_bandi",
        lambda token, email: {
            "success": True,
            "items": [
                {
                    "commission_id": "rdp-1",
                    "title": "Bando RDP",
                    "configured": False,
                    "session_count": 0,
                    "capabilities": ["configure", "view"],
                    "rdp_names": ["Rita Verdi"],
                }
            ],
        },
    )
    app = create_test_app()
    client = authenticated_client(app, "rita.verdi@cnr.it")
    with client.session_transaction() as flask_session:
        csrf_token = get_csrf_token(flask_session)

    response = client.post(
        "/api/v1/referenti/bandi/sync",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["items"][0]["commission_id"] == "rdp-1"
    assert payload["items"][0]["rdp_names"] == ["Rita Verdi"]


def test_referente_bandi_sync_requires_fresh_oidc_token(monkeypatch):
    from routes.api_v1 import bandi

    monkeypatch.setattr(bandi, "ensure_fresh_access_token", lambda **kwargs: None)
    app = create_test_app()
    client = authenticated_client(app, "rita.verdi@cnr.it")
    with client.session_transaction() as flask_session:
        csrf_token = get_csrf_token(flask_session)

    response = client.post(
        "/api/v1/referenti/bandi/sync",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "reauthentication_required"


def test_bando_detail_rejects_unrelated_user(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "can_access_commission",
        lambda email, commission_id, **kwargs: False,
    )

    response = authenticated_client(create_test_app(), "other@cnr.it").get(
        "/api/v1/bandi/commission-1"
    )

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "forbidden"


def test_bando_detail_includes_persisted_operational_metadata(monkeypatch):
    from routes.api_v1 import bandi
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "can_access_commission",
        lambda email, commission_id, **kwargs: True,
    )
    monkeypatch.setattr(
        bandi,
        "get_bando",
        lambda commission_id, user_email=None: {
            "commission_id": commission_id,
            "title": "Concorso CNR",
            "configured": True,
        },
    )
    monkeypatch.setattr(
        bandi,
        "get_bando_config",
        lambda commission_id: {
            "rdp_nomi": ["Rita Verdi"],
            "commissione_members": [
                {"nome": "Mario Rossi", "email": "mario.rossi@cnr.it"}
            ],
            "fetched_at": "2026-07-03T10:00:00",
        },
    )

    response = authenticated_client(create_test_app()).get(
        "/api/v1/bandi/commission-1"
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["rdps"] == [{"name": "Rita Verdi"}]
    assert payload["commissioners"][0]["email"] == "mario.rossi@cnr.it"


def test_sync_bando_metadata_returns_full_remote_detail(monkeypatch):
    from routes.api_v1 import bandi
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "can_access_commission",
        lambda email, commission_id, **kwargs: True,
    )
    monkeypatch.setattr(
        bandi,
        "ensure_fresh_access_token",
        lambda **kwargs: "fresh-token",
    )
    monkeypatch.setattr(
        bandi,
        "sync_bando_metadata",
        lambda commission_id, token: {
            "success": True,
            "rdp_count": 1,
            "commissioner_count": 1,
            "rdps": [{"firstName": "Rita", "lastName": "Verdi"}],
            "commissioners": [
                {"firstName": "Mario", "lastName": "Rossi", "ruolo": "PRESIDENTE"}
            ],
        },
    )
    app = create_test_app()
    client = authenticated_client(app)
    with client.session_transaction() as flask_session:
        csrf_token = get_csrf_token(flask_session)

    response = client.post(
        "/api/v1/bandi/commission-1/sync-meta",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    assert response.get_json()["commissioners"][0]["ruolo"] == "PRESIDENTE"


def test_sessions_for_bando_return_summary(monkeypatch):
    from routes.api_v1 import sessioni
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "can_access_commission",
        lambda email, commission_id, **kwargs: True,
    )
    monkeypatch.setattr(
        sessioni,
        "list_sessioni",
        lambda commission_id: [
            {
                "session_id": "session-1",
                "commission_id": commission_id,
                "name": "Prova scritta",
                "date": "02/07/2026",
                "time": "10:00",
                "location": "Roma",
                "current_state": "iniziale",
                "candidate_count": 20,
                "checked_in_count": 3,
                "device_count": 1,
                "capabilities": ["configure", "manage"],
            }
        ],
    )

    response = authenticated_client(create_test_app()).get(
        "/api/v1/bandi/commission-1/sessioni"
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["commission_id"] == "commission-1"
    assert payload["items"][0]["checked_in_count"] == 3


def test_session_detail_returns_404_when_missing(monkeypatch):
    from routes.api_v1 import sessioni
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "can_access_session",
        lambda email, session_id, **kwargs: True,
    )
    monkeypatch.setattr(sessioni, "get_sessione", lambda session_id, user_email=None: None)

    response = authenticated_client(create_test_app()).get(
        "/api/v1/sessioni/missing"
    )

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "session_not_found"
