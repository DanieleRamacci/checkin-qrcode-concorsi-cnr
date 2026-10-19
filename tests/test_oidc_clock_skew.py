import logging
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from utils import oidc

ISSUER = "https://idp.test/realms/cnr"
AUDIENCE = "selezioni"
PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _FakeJWKClient:
    def __init__(self, url):
        pass

    def get_signing_key_from_jwt(self, token):
        return type("SigningKey", (), {"key": PRIVATE_KEY.public_key()})()


@pytest.fixture(autouse=True)
def oidc_env(monkeypatch):
    monkeypatch.setenv("OIDC_ISSUER", ISSUER)
    monkeypatch.setenv("OIDC_AUDIENCE", AUDIENCE)
    monkeypatch.setenv("OIDC_JWKS_URL", "https://idp.test/certs")
    monkeypatch.setenv("OIDC_ALLOWED_ALGORITHM", "RS256")
    monkeypatch.delenv("OIDC_CLOCK_SKEW_SECONDS", raising=False)
    monkeypatch.setattr(oidc.jwt, "PyJWKClient", _FakeJWKClient)
    oidc._jwk_client.cache_clear()
    yield
    oidc._jwk_client.cache_clear()


def _token(iat_offset, lifetime=300):
    now = int(time.time())
    return jwt.encode(
        {
            "iss": ISSUER,
            "aud": AUDIENCE,
            "iat": now + iat_offset,
            "exp": now + iat_offset + lifetime,
            "email": "utente@cnr.it",
        },
        PRIVATE_KEY,
        algorithm="RS256",
    )


def test_token_from_idp_clock_ahead_is_accepted_by_default():
    # Caso osservato su test: orologio Keycloak avanti di 39s.
    decoded = oidc.validate_oidc_token(_token(39))

    assert decoded["email"] == "utente@cnr.it"


def test_clock_skew_beyond_configured_leeway_is_rejected_and_logged(
    monkeypatch, caplog
):
    monkeypatch.setenv("OIDC_CLOCK_SKEW_SECONDS", "30")

    with caplog.at_level(logging.WARNING, logger="utils.oidc"):
        with pytest.raises(jwt.ImmatureSignatureError):
            oidc.validate_oidc_token(_token(39))

    assert "tolleranza=30s" in caplog.text
    assert "(iat)" in caplog.text


@pytest.mark.parametrize("raw", ["", "abc", "1.5"])
def test_invalid_clock_skew_falls_back_to_default(monkeypatch, raw):
    monkeypatch.setenv("OIDC_CLOCK_SKEW_SECONDS", raw)

    assert oidc.validate_oidc_token(_token(39))["email"] == "utente@cnr.it"


@pytest.mark.parametrize("raw, expected", [("-60", 0), ("3600", 300), ("45", 45)])
def test_clock_skew_is_clamped(monkeypatch, raw, expected):
    monkeypatch.setenv("OIDC_CLOCK_SKEW_SECONDS", raw)

    assert oidc._clock_skew_seconds() == expected


def test_large_skew_does_not_extend_token_expiry():
    # Scaduto da 60s: oltre i 30s di exp anche se la tolleranza iat e' 120s.
    with pytest.raises(jwt.ExpiredSignatureError):
        oidc.validate_oidc_token(_token(-360, lifetime=300))
