import jwt
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext

try:
    from backend.config.config import settings
except ImportError:
    from config.config import settings  # fallback for direct imports

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

COOKIE_NAME = "itz_admin_token"
JWT_EXPIRY_HOURS = 12

def hash_password(password: str) -> str:
    return _pwd_context.hash(password)

def verify_password(plain: str, hash_val: str) -> bool:
    try:
        if not hash_val:
            return False
        return _pwd_context.verify(plain, hash_val)
    except Exception:
        return False

def create_jwt(username: str) -> str:
    payload = {
        "sub": username,
        "role": "admin",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")

def verify_jwt(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        return payload
    except Exception:
        return None
