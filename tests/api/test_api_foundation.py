from flask import Flask

from routes.api_v1 import api_v1_bp
from routes.api_v1.csrf import get_csrf_token


def create_test_app():
    app = Flask(__name__)
    app.secret_key = "test-secret"
    app.register_blueprint(api_v1_bp)
    app.config.update(TESTING=True)
    return app


def test_api_response_contains_request_id():
    app = create_test_app()

    response = app.test_client().get(
        "/api/v1/health",
        headers={"X-Request-ID": "request-123"},
    )

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "request-123"
    assert response.get_json()["request_id"] == "request-123"


def test_unknown_api_route_returns_uniform_json_error():
    app = create_test_app()

    response = app.test_client().get("/api/v1/not-found")

    assert response.status_code == 404
    payload = response.get_json()["error"]
    assert payload["code"] == "not_found"
    assert payload["request_id"] == response.headers["X-Request-ID"]
    assert payload["details"] == {}


def test_api_mutation_without_csrf_is_rejected():
    app = create_test_app()
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "user@cnr.it"

    response = client.post("/api/v1/not-found")

    assert response.status_code == 403
    assert response.get_json()["error"]["code"] == "csrf_invalid"


def test_api_mutation_accepts_session_csrf_token():
    app = create_test_app()
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "user@cnr.it"
        token = get_csrf_token(flask_session)

    response = client.post(
        "/api/v1/not-found",
        headers={"X-CSRF-Token": token},
    )

    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "not_found"
