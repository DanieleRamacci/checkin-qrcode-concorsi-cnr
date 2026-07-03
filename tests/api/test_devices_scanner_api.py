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
    return client


def authenticated_client_with_csrf(app):
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "owner@cnr.it"
        csrf_token = get_csrf_token(flask_session)
    return client, csrf_token


def allow_session(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "can_access_session",
        lambda email, session_id, **kwargs: True,
    )


def test_device_list_never_exposes_token(monkeypatch):
    from routes.api_v1 import devices

    allow_session(monkeypatch)
    monkeypatch.setattr(
        devices,
        "list_devices",
        lambda session_id: [
            {
                "id": 1,
                "session_id": session_id,
                "operator_email": "operator@cnr.it",
                "status": "online",
            }
        ],
    )

    response = authenticated_client(create_test_app()).get(
        "/api/v1/sessioni/session-1/devices"
    )

    assert response.status_code == 200
    assert "device_token" not in response.get_json()["items"][0]


def test_invalid_device_ping_is_rejected(monkeypatch):
    from routes.api_v1 import devices
    from utils.devices_service import DeviceUnauthorized

    monkeypatch.setattr(
        devices,
        "heartbeat_device",
        lambda session_id, token: (_ for _ in ()).throw(DeviceUnauthorized()),
    )

    response = create_test_app().test_client().post(
        "/api/v1/devices/ping",
        json={"session_id": "session-1", "device_token": "invalid"},
    )

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "device_unauthorized"


def test_device_disconnect_closes_the_registered_device(monkeypatch):
    from routes.api_v1 import devices

    captured = {}
    monkeypatch.setattr(
        devices,
        "disconnect_device",
        lambda session_id, token: captured.update(
            session_id=session_id,
            token=token,
        ),
    )

    response = create_test_app().test_client().post(
        "/api/v1/devices/disconnect",
        json={"session_id": "session-1", "device_token": "valid-token"},
    )

    assert response.status_code == 200
    assert captured == {"session_id": "session-1", "token": "valid-token"}


def test_devices_verify_advances_state_when_device_connected(monkeypatch):
    from routes.api_v1 import devices

    allow_session(monkeypatch)
    monkeypatch.setattr(
        devices,
        "verify_devices_connected",
        lambda session_id, actor_email: {
            "success": True,
            "device_count": 1,
            "current_state": "dispositivi_connessi",
        },
    )

    client, csrf_token = authenticated_client_with_csrf(create_test_app())
    response = client.post(
        "/api/v1/sessioni/session-1/devices/verify",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["current_state"] == "dispositivi_connessi"


def test_devices_verify_rejects_missing_csrf(monkeypatch):
    allow_session(monkeypatch)

    response = authenticated_client(create_test_app()).post(
        "/api/v1/sessioni/session-1/devices/verify"
    )

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "csrf_invalid"


def test_scanner_verify_returns_candidate(monkeypatch):
    from routes.api_v1 import scanner

    monkeypatch.setattr(
        scanner,
        "verify_candidate",
        lambda session_id, uid, token: {
            "uid": uid,
            "first_name": "Ada",
            "last_name": "Lovelace",
            "checkin_effettuato": False,
        },
    )

    response = create_test_app().test_client().post(
        "/api/v1/scanner/verify-candidate",
        json={
            "session_id": "session-1",
            "uid": "candidate-1",
            "device_token": "valid",
        },
    )

    assert response.status_code == 200
    assert response.get_json()["uid"] == "candidate-1"
