from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired


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
