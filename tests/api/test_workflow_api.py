import json
from pathlib import Path

from flask import Flask
import pytest

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
        csrf_token = get_csrf_token(flask_session)
    return client, csrf_token


def allow_resource_access(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "can_access_commission",
        lambda email, resource_id, **kwargs: True,
    )
    monkeypatch.setattr(
        authorization,
        "can_access_session",
        lambda email, resource_id, **kwargs: True,
    )


def test_get_bando_config(monkeypatch):
    from routes.api_v1 import configurazioni

    allow_resource_access(monkeypatch)
    monkeypatch.setattr(
        configurazioni,
        "get_bando_config",
        lambda commission_id: {
            "email_referente": "referente@cnr.it",
            "rdp_members": [
                {"nome": "Referente CNR", "email": "referente@cnr.it"}
            ],
            "commissione_members": [
                {"nome": "Segretaria Uno", "email": "segretaria1@cnr.it", "ruolo": "SEGRETARIO"},
                {"nome": "Presidente", "email": "presidente@cnr.it", "ruolo": "PRESIDENTE"},
                {"nome": "Segretaria Due", "email": "segretaria2@cnr.it", "ruolo": "SEGRETARIO"},
            ],
        },
    )
    monkeypatch.setattr(
        configurazioni,
        "list_expert_emails",
        lambda: ["esperto@cnr.it"],
    )

    client, _ = authenticated_client(create_test_app())
    response = client.get("/api/v1/bandi/commission-1/config")

    assert response.status_code == 200
    assert response.get_json()["commission_id"] == "commission-1"
    assert response.get_json()["email_referente"] == "referente@cnr.it"
    assert response.get_json()["rdp_options"] == [
        {"nome": "Referente CNR", "email": "referente@cnr.it"}
    ]
    assert response.get_json()["secretary_options"] == [
        {"nome": "Segretaria Uno", "email": "segretaria1@cnr.it"},
        {"nome": "Segretaria Due", "email": "segretaria2@cnr.it"},
    ]
    assert response.get_json()["expert_options"] == ["esperto@cnr.it"]


def test_request_bando_configuration_sends_email(monkeypatch):
    from routes.api_v1 import configurazioni

    allow_resource_access(monkeypatch)
    monkeypatch.setattr(
        configurazioni,
        "get_bando_config",
        lambda commission_id: {
            "rdp_members": [
                {"nome": "Referente CNR", "email": "referente@cnr.it"}
            ]
        },
    )
    monkeypatch.setattr(
        configurazioni,
        "request_bando_configuration",
        lambda commission_id, referente_email, actor_email, config_url: {
            "success": True,
            "message": "Email inviata al referente.",
            "referente_email": referente_email,
        },
    )
    app = create_test_app()
    client, csrf_token = authenticated_client(app)

    response = client.post(
        "/api/v1/bandi/commission-1/request-config",
        json={"email_referente": "referente@cnr.it"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    assert response.get_json()["referente_email"] == "referente@cnr.it"


def test_request_bando_configuration_rejects_non_rdp_email(monkeypatch):
    from routes.api_v1 import configurazioni

    allow_resource_access(monkeypatch)
    monkeypatch.setattr(
        configurazioni,
        "get_bando_config",
        lambda commission_id: {
            "rdp_members": [
                {"nome": "Referente CNR", "email": "referente@cnr.it"}
            ]
        },
    )
    app = create_test_app()
    client, csrf_token = authenticated_client(app)

    response = client.post(
        "/api/v1/bandi/commission-1/request-config",
        json={"email_referente": "altro@cnr.it"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 422
    assert response.get_json()["error"]["details"]["email_referente"]


def test_request_bando_configuration_rejects_when_no_rdp_options(monkeypatch):
    from routes.api_v1 import configurazioni

    allow_resource_access(monkeypatch)
    monkeypatch.setattr(
        configurazioni,
        "get_bando_config",
        lambda commission_id: {"rdp_members": []},
    )
    app = create_test_app()
    client, csrf_token = authenticated_client(app)

    response = client.post(
        "/api/v1/bandi/commission-1/request-config",
        json={"email_referente": "referente@cnr.it"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 422
    assert "Selezioni Online" in response.get_json()["error"]["details"]["email_referente"]


def test_request_bando_configuration_rejects_invalid_email(monkeypatch):
    allow_resource_access(monkeypatch)
    client, csrf_token = authenticated_client(create_test_app())

    response = client.post(
        "/api/v1/bandi/commission-1/request-config",
        json={"email_referente": "not-an-email"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 422
    assert response.get_json()["error"]["details"]["email_referente"]


def test_put_bando_config_rejects_referente_without_institutional_rdp(monkeypatch):
    from routes.api_v1 import configurazioni

    allow_resource_access(monkeypatch)
    monkeypatch.setattr(
        configurazioni,
        "get_bando_config",
        lambda commission_id: {
            "rdp_members": [],
            "commissione_members": [],
        },
    )

    app = create_test_app()
    client, csrf_token = authenticated_client(app)
    response = client.put(
        "/api/v1/bandi/commission-1/config",
        json={"email_referente": "referente@cnr.it"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 422
    assert "Selezioni Online" in response.get_json()["error"]["details"]["email_referente"]


def test_put_bando_config_accepts_referente_email_case_insensitive(monkeypatch):
    from routes.api_v1 import configurazioni

    allow_resource_access(monkeypatch)
    saved = {}
    monkeypatch.setattr(
        configurazioni,
        "get_bando_config",
        lambda commission_id: {
            "rdp_members": [
                {"nome": "Referente CNR", "email": "referente@cnr.it"}
            ],
            "commissione_members": [],
        },
    )

    def fake_save_bando_config(commission_id, *args, **kwargs):
        saved["commission_id"] = commission_id
        saved["args"] = args

    monkeypatch.setattr(configurazioni, "save_bando_config", fake_save_bando_config)

    app = create_test_app()
    client, csrf_token = authenticated_client(app)
    response = client.put(
        "/api/v1/bandi/commission-1/config",
        json={"email_referente": "Referente@CNR.IT"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    assert saved["commission_id"] == "commission-1"
    assert saved["args"][0] == "Referente@CNR.IT"


def test_put_bando_config_rejects_secretary_without_source_option(monkeypatch):
    from routes.api_v1 import configurazioni

    allow_resource_access(monkeypatch)
    monkeypatch.setattr(
        configurazioni,
        "get_bando_config",
        lambda commission_id: {
            "rdp_members": [],
            "commissione_members": [],
        },
    )

    app = create_test_app()
    client, csrf_token = authenticated_client(app)
    response = client.put(
        "/api/v1/bandi/commission-1/config",
        json={"email_segretario": "segretario@cnr.it"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 422
    assert "Selezioni Online" in response.get_json()["error"]["details"]["email_segretario"]


def test_put_bando_config_accepts_secretary_email_case_insensitive(monkeypatch):
    from routes.api_v1 import configurazioni

    allow_resource_access(monkeypatch)
    saved = {}
    monkeypatch.setattr(
        configurazioni,
        "get_bando_config",
        lambda commission_id: {
            "rdp_members": [],
            "commissione_members": [
                {"nome": "Segretaria CNR", "email": "segretario@cnr.it", "ruolo": "SEGRETARIO"},
                {"nome": "Presidente CNR", "email": "presidente@cnr.it", "ruolo": "PRESIDENTE"},
            ],
        },
    )

    def fake_save_bando_config(commission_id, *args, **kwargs):
        saved["commission_id"] = commission_id
        saved["args"] = args

    monkeypatch.setattr(configurazioni, "save_bando_config", fake_save_bando_config)

    app = create_test_app()
    client, csrf_token = authenticated_client(app)
    response = client.put(
        "/api/v1/bandi/commission-1/config",
        json={"email_segretario": "Segretario@CNR.IT"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    assert saved["commission_id"] == "commission-1"
    assert saved["args"][2] == "Segretario@CNR.IT"


def test_put_bando_config_ignores_readonly_response_fields(monkeypatch):
    from routes.api_v1 import configurazioni

    allow_resource_access(monkeypatch)
    saved = {}
    monkeypatch.setattr(
        configurazioni,
        "get_bando_config",
        lambda commission_id: {
            "email_referente": "referente@cnr.it",
            "rdp_members": [
                {"nome": "Referente CNR", "email": "referente@cnr.it"}
            ],
            "commissione_members": [
                {"nome": "Segretario CNR", "email": "segretario@cnr.it", "ruolo": "SEGRETARIO"}
            ],
        },
    )

    def fake_save_bando_config(commission_id, *args, **kwargs):
        saved["commission_id"] = commission_id
        saved["args"] = args
        saved["kwargs"] = kwargs

    monkeypatch.setattr(configurazioni, "save_bando_config", fake_save_bando_config)

    app = create_test_app()
    client, csrf_token = authenticated_client(app)
    response = client.put(
        "/api/v1/bandi/commission-1/config",
        json={
            "commission_id": "commission-1",
            "email_referente": "referente@cnr.it",
            "email_esperto_remoto": "esperto@cnr.it",
            "email_segretario": "segretario@cnr.it",
            "data_accesso_piattaforma": "2026-07-20",
            "commissione_members": [],
            "rdp_options": [{"nome": "Referente CNR", "email": "referente@cnr.it"}],
            "secretary_options": [{"nome": "Segretaria Uno", "email": "segretaria1@cnr.it"}],
            "rdp_members": [{"nome": "Referente CNR", "email": "referente@cnr.it"}],
            "config_status": "esperto_assegnato",
            "configured_at": "2026-07-10T10:00:00",
            "required_data_complete": False,
        },
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    assert saved["commission_id"] == "commission-1"
    assert saved["kwargs"]["data_accesso_piattaforma"] == "2026-07-20"


def test_put_session_config_rejects_invalid_email(monkeypatch):
    allow_resource_access(monkeypatch)
    client, csrf_token = authenticated_client(create_test_app())

    response = client.put(
        "/api/v1/sessioni/session-1/config",
        json={"email_informatico_sede": "not-an-email"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "validation_error"
    assert "email_informatico_sede" in response.get_json()["error"]["details"]


def test_get_workflow_state(monkeypatch):
    from routes.api_v1 import workflow

    allow_resource_access(monkeypatch)
    monkeypatch.setattr(
        workflow,
        "describe_workflow",
        lambda session_id: {
            "current_state": "dispositivi_connessi",
            "actions": [
                {
                    "action": "avvia_checkin",
                    "label": "Avvia check-in",
                    "enabled": True,
                    "disabled_reason": None,
                    "target_state": "checkin_avviato",
                    "requires_confirmation": True,
                }
            ],
        },
    )

    client, _ = authenticated_client(create_test_app())
    response = client.get("/api/v1/sessioni/session-1/state")

    assert response.status_code == 200
    assert response.get_json()["actions"][0]["action"] == "avvia_checkin"


def test_invalid_workflow_action_returns_conflict(monkeypatch):
    from routes.api_v1 import workflow
    from utils.workflow_service import InvalidTransition

    allow_resource_access(monkeypatch)
    monkeypatch.setattr(
        workflow,
        "execute_workflow_action",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            InvalidTransition("Azione non disponibile")
        ),
    )

    client, csrf_token = authenticated_client(create_test_app())
    response = client.post(
        "/api/v1/sessioni/session-1/actions/concludi_checkin",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "invalid_transition"


WORKFLOW_SCENARIOS = json.loads(
    (Path(__file__).parent / "fixtures" / "workflow_scenarios.json").read_text()
)


@pytest.mark.parametrize(
    "scenario",
    WORKFLOW_SCENARIOS,
    ids=[scenario["state"] for scenario in WORKFLOW_SCENARIOS],
)
def test_workflow_state_contract_for_every_ui_scenario(monkeypatch, scenario):
    from routes.api_v1 import workflow

    allow_resource_access(monkeypatch)
    action = scenario["action"]
    monkeypatch.setattr(
        workflow,
        "describe_workflow",
        lambda session_id: {
            "current_state": scenario["state"],
            "actions": [] if action is None else [{
                "action": action,
                "label": action.replace("_", " ").capitalize(),
                "enabled": True,
                "disabled_reason": None,
                "target_state": "next",
                "requires_confirmation": True,
            }],
        },
    )

    client, _ = authenticated_client(
        create_test_app(),
        "expert@cnr.it" if scenario["role"] == "esperto" else "owner@cnr.it",
    )
    response = client.get("/api/v1/sessioni/session-1/state")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["current_state"] == scenario["state"]
    assert [item["action"] for item in payload["actions"]] == (
        [] if action is None else [action]
    )


def test_expert_action_requests_expert_or_admin_session_access(monkeypatch):
    from routes.api_v1 import workflow
    from utils.roles import ROLE_ADMIN, ROLE_ESPERTO

    captured = {}
    monkeypatch.setattr(
        workflow.authorization,
        "can_access_session",
        lambda email, session_id, allowed_roles=(), **kwargs: (
            captured.update(allowed_roles=set(allowed_roles)) or True
        ),
    )
    monkeypatch.setattr(
        workflow,
        "execute_workflow_action",
        lambda *args, **kwargs: {
            "current_state": "lista_presenti_aggiornata_su_moodle",
            "actions": [],
        },
    )
    client, token = authenticated_client(create_test_app(), "expert@cnr.it")

    response = client.post(
        "/api/v1/sessioni/session-1/actions/aggiorna_presenti_moodle",
        headers={"X-CSRF-Token": token},
    )

    assert response.status_code == 200
    assert captured["allowed_roles"] == {ROLE_ESPERTO, ROLE_ADMIN}
