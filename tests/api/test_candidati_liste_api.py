from flask import Flask

from routes.api_v1 import api_v1_bp
from routes.api_v1.csrf import get_csrf_token


def create_test_app():
    app = Flask(__name__)
    app.secret_key = "test-secret"
    app.register_blueprint(api_v1_bp)
    app.config.update(TESTING=True)
    return app


def authenticated_client(app):
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "owner@cnr.it"
        token = get_csrf_token(flask_session)
    return client, token


def allow_session(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "can_access_session",
        lambda email, session_id, **kwargs: True,
    )


def test_list_candidates_uses_json_dto(monkeypatch):
    from routes.api_v1 import candidati

    allow_session(monkeypatch)
    monkeypatch.setattr(
        candidati,
        "list_candidates",
        lambda session_id, **filters: [
            {
                "uid": "candidate-1",
                "first_name": "Ada",
                "last_name": "Lovelace",
                "document_number": "DOC1",
                "document_expired": False,
                "checkin_effettuato": True,
                "reset_password_richiesto": False,
                "reset_password_effettuato": False,
            }
        ],
    )

    client, _ = authenticated_client(create_test_app())
    response = client.get("/api/v1/sessioni/session-1/candidati?q=Ada")

    assert response.status_code == 200
    assert response.get_json()["items"][0]["uid"] == "candidate-1"


def test_toggle_candidate_checkin_returns_updated_candidate(monkeypatch):
    from routes.api_v1 import candidati

    allow_session(monkeypatch)
    monkeypatch.setattr(
        candidati,
        "toggle_candidate_checkin",
        lambda session_id, uid, actor_email: {
            "uid": uid,
            "checkin_effettuato": True,
        },
    )

    client, token = authenticated_client(create_test_app())
    response = client.post(
        "/api/v1/sessioni/session-1/candidati/candidate-1/toggle-checkin",
        headers={"X-CSRF-Token": token},
    )

    assert response.status_code == 200
    assert response.get_json()["checkin_effettuato"] is True


def test_cancel_reset_request_is_forwarded_to_candidate_service(monkeypatch):
    from routes.api_v1 import candidati

    allow_session(monkeypatch)
    monkeypatch.setattr(
        candidati,
        "get_user_roles",
        lambda email: {"esperto_informatico"},
    )
    captured = {}

    def update(session_id, uid, *, operation, actor_email):
        captured.update(
            session_id=session_id,
            uid=uid,
            operation=operation,
            actor_email=actor_email,
        )
        return {"uid": uid, "reset_password_richiesto": False}

    monkeypatch.setattr(candidati, "update_reset_password", update)
    client, token = authenticated_client(create_test_app())
    response = client.post(
        "/api/v1/sessioni/session-1/candidati/candidate-1/reset-password",
        json={"operation": "cancel_request"},
        headers={"X-CSRF-Token": token},
    )

    assert response.status_code == 200
    assert captured["operation"] == "cancel_request"
    assert response.get_json()["reset_password_richiesto"] is False


def test_latest_list_returns_404_when_absent(monkeypatch):
    from routes.api_v1 import liste

    allow_session(monkeypatch)
    monkeypatch.setattr(liste, "get_latest_list", lambda session_id: None)

    client, _ = authenticated_client(create_test_app())
    response = client.get("/api/v1/sessioni/session-1/lists/latest")

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "list_not_found"
