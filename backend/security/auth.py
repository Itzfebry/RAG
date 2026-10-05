import jwt
from datetime import datetime, timedelta, timezone
import bcrypt

try:
    from backend.config.config import settings
except ImportError:
    from config.config import settings  # fallback for direct imports

COOKIE_NAME = "itz_admin_token"
JWT_EXPIRY_HOURS = 12

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hash_val: str) -> bool:
    try:
        if not hash_val:
            return False
        return bcrypt.checkpw(plain.encode('utf-8'), hash_val.encode('utf-8'))
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
