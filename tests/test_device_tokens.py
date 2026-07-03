from datetime import datetime, timedelta, timezone

from utils.device_tokens import is_device_token_valid, make_reg_token, verify_reg_token


def test_registration_token_expires():
    token = make_reg_token("session-1", "secret")

    assert not verify_reg_token(
        token,
        "session-1",
        "secret",
        max_age_seconds=-1,
    )


def test_device_token_rejects_revoked_device():
    now = datetime.now(timezone.utc)

    assert not is_device_token_valid(
        "provided-token",
        stored_token="provided-token",
        issued_at=now,
        disconnected_at=now,
        now=now,
    )


def test_device_token_rejects_expired_device():
    now = datetime.now(timezone.utc)

    assert not is_device_token_valid(
        "provided-token",
        stored_token="provided-token",
        issued_at=now - timedelta(hours=9),
        disconnected_at=None,
        now=now,
        max_age_seconds=8 * 60 * 60,
    )


def test_device_token_uses_exact_comparison():
    now = datetime.now(timezone.utc)

    assert not is_device_token_valid(
        "provided-token",
        stored_token="provided-tokeN",
        issued_at=now,
        disconnected_at=None,
        now=now,
    )
