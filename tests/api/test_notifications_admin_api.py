from flask import Flask

from routes.api_v1 import api_v1_bp


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


def test_notification_feed(monkeypatch):
    from routes.api_v1 import notifiche
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "can_access_session",
        lambda email, session_id, **kwargs: True,
    )
    monkeypatch.setattr(
        notifiche,
        "get_notifications",
        lambda session_id, limit: [
            {
                "id": 1,
                "session_id": session_id,
                "type": "message",
                "payload": "Test",
            }
        ],
    )

    response = authenticated_client(create_test_app()).get(
        "/api/v1/sessioni/session-1/notifications"
    )

    assert response.status_code == 200
    assert response.get_json()["items"][0]["payload"] == "Test"


def test_admin_roles_rejects_non_admin(monkeypatch):
    from routes.api_v1 import admin

    monkeypatch.setattr(admin, "get_user_roles", lambda email: set())

    response = authenticated_client(create_test_app()).get("/api/v1/admin/roles")

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "forbidden"


def test_admin_roles_list(monkeypatch):
    from routes.api_v1 import admin

    monkeypatch.setattr(
        admin,
        "get_user_roles",
        lambda email: {"admin_globale"},
    )
    monkeypatch.setattr(
        admin,
        "list_roles",
        lambda: [{"user_email": "expert@cnr.it", "role": "esperto_informatico"}],
    )

    response = authenticated_client(create_test_app(), "admin@cnr.it").get(
        "/api/v1/admin/roles"
    )

    assert response.status_code == 200
    assert response.get_json()["items"][0]["role"] == "esperto_informatico"


def test_admin_logs_returns_all_legacy_sections(monkeypatch):
    from routes.api_v1 import admin

    monkeypatch.setattr(admin, "get_user_roles", lambda email: {"admin_globale"})
    monkeypatch.setattr(
        admin,
        "list_logs",
        lambda limit: {
            "system_errors": [{"id": 1}],
            "email_logs": [{"id": 2}],
            "session_state_logs": [{"id": 3}],
            "exam_state_logs": [{"id": 4}],
        },
    )

    response = authenticated_client(create_test_app(), "admin@cnr.it").get(
        "/api/v1/admin/logs?limit=50"
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["limit"] == 50
    assert payload["email_logs"][0]["id"] == 2
    assert payload["session_state_logs"][0]["id"] == 3
    assert payload["exam_state_logs"][0]["id"] == 4


def test_admin_settings_requires_admin(monkeypatch):
    from routes.api_v1 import admin

    monkeypatch.setattr(admin, "get_user_roles", lambda email: set())

    response = authenticated_client(create_test_app()).get("/api/v1/admin/settings")

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "forbidden"


def test_admin_settings_can_be_updated(monkeypatch):
    from routes.api_v1 import admin
    from routes.api_v1.csrf import get_csrf_token

    saved = {}
    monkeypatch.setattr(admin, "get_user_roles", lambda email: {"admin_globale"})
    monkeypatch.setattr(
        admin,
        "save_app_settings",
        lambda values, actor: saved.setdefault("args", (values, actor)) and {
            "institution_name": values["institution_name"],
            "app_title": values["app_title"],
            "tagline": values["tagline"],
            "footer_owner": values["footer_owner"],
        },
    )
    app = create_test_app()
    client = authenticated_client(app, "admin@cnr.it")
    with client.session_transaction() as flask_session:
        csrf_token = get_csrf_token(flask_session)

    response = client.put(
        "/api/v1/admin/settings",
        json={
            "institution_name": "Ente",
            "app_title": "Applicazione",
            "tagline": "Tagline",
            "footer_owner": "Footer",
        },
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    assert response.get_json()["app_title"] == "Applicazione"
    assert saved["args"][1] == "admin@cnr.it"
