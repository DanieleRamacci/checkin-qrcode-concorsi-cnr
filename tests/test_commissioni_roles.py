from utils import commissioni


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def test_fetch_user_commission_role_returns_source_role(monkeypatch):
    captured = {}

    def fake_get(url, headers, params, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["params"] = params
        captured["timeout"] = timeout
        return FakeResponse(
            {
                "items": [
                    {
                        "id": "commission-1",
                        "commissioners": [
                            {
                                "nome": "Utente CNR",
                                "email": "utente@cnr.it",
                                "ruolo": "PRESIDENTE",
                            }
                        ],
                    }
                ]
            }
        )

    monkeypatch.setattr(commissioni.requests, "get", fake_get)

    role = commissioni._fetch_user_commission_role(
        "token", "commission-1", "111.112", "Utente@CNR.IT"
    )

    assert role == "PRESIDENTE"
    assert captured["params"]["detailCommission"] == "true"
    assert captured["params"]["callCode"] == "111.112"


def test_fetch_user_commission_role_returns_not_in_commission(monkeypatch):
    def fake_get(url, headers, params, timeout):
        return FakeResponse(
            {
                "items": [
                    {
                        "id": "commission-1",
                        "commissioners": [
                            {
                                "nome": "Altra Persona",
                                "email": "altra@cnr.it",
                                "ruolo": "SEGRETARIO",
                            }
                        ],
                    }
                ]
            }
        )

    monkeypatch.setattr(commissioni.requests, "get", fake_get)

    role = commissioni._fetch_user_commission_role(
        "token", "commission-1", "111.112", "utente@cnr.it"
    )

    assert role == "NOT_IN_COMMISSION"

