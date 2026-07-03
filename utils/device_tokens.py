from datetime import datetime, timezone
from hmac import compare_digest

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer


DEVICE_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60


def _serializer(secret_key: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret_key, salt="device-registration")


def make_reg_token(session_id: str, secret_key: str) -> str:
    serializer = _serializer(secret_key)
    return serializer.dumps({"session_id": session_id})


def verify_reg_token(token: str, session_id: str, secret_key: str, max_age_seconds: int) -> bool:
    serializer = _serializer(secret_key)
    try:
        data = serializer.loads(token, max_age=max_age_seconds)
    except (BadSignature, SignatureExpired):
        return False
    return data.get("session_id") == session_id


def is_device_token_valid(
    provided_token: str | None,
    *,
    stored_token: str | None,
    issued_at: datetime | None,
    disconnected_at: datetime | None,
    now: datetime | None = None,
    max_age_seconds: int = DEVICE_TOKEN_MAX_AGE_SECONDS,
) -> bool:
    """Validate a scanner token without reactivating revoked devices."""
    if not provided_token or not stored_token or not issued_at or disconnected_at:
        return False
    if not compare_digest(provided_token, stored_token):
        return False

    current_time = now or datetime.now(timezone.utc)
    if issued_at.tzinfo is None:
        issued_at = issued_at.replace(tzinfo=timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    age_seconds = (current_time - issued_at).total_seconds()
    return 0 <= age_seconds <= max_age_seconds
