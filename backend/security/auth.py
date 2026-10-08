import jwt
import secrets
import re
from datetime import datetime, timedelta, timezone
import bcrypt

try:
    from backend.config.config import settings
except ImportError:
    from config.config import settings  # fallback for direct imports

COOKIE_NAME = "itz_admin_token"
USER_COOKIE_NAME = "itz_user_token"
JWT_EXPIRY_HOURS = 2
JWT_ALGO = "HS256"
USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,32}$")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hash_val: str) -> bool:
    try:
        if not hash_val:
            return False
        return bcrypt.checkpw(plain.encode('utf-8'), hash_val.encode('utf-8'))
    except Exception:
        return False

def is_valid_username(username: str) -> bool:
    return bool(USERNAME_RE.match(username or ""))

def create_jwt(username: str, role: str = "admin", expiry_hours: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    hours = expiry_hours if expiry_hours is not None else (JWT_EXPIRY_HOURS if role == "admin" else 24)
    payload = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=hours),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=JWT_ALGO)

def create_admin_jwt(username: str) -> str:
    return create_jwt(username, role="admin", expiry_hours=JWT_EXPIRY_HOURS)

def create_user_jwt(username: str, expiry_hours: int | None = None) -> str:
    # expiry dynamically fetched from settings if not passed
    if expiry_hours is None:
        try:
            # lazy import to avoid circular
            try:
                from backend.database.db import DatabaseService
            except ImportError:
                from database.db import DatabaseService  # type: ignore
            s = DatabaseService.get_app_settings()
            expiry_hours = int(s.get("user_token_expiry_hours", 24))
        except Exception:
            expiry_hours = 24
        expiry_hours = max(1, min(720, int(expiry_hours)))
    return create_jwt(username, role="user", expiry_hours=expiry_hours)

def verify_jwt(token: str, allowed_roles: tuple[str, ...] | None = None) -> dict | None:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[JWT_ALGO],
            options={"require": ["exp", "iat", "sub"]},
        )
        role = payload.get("role")
        if allowed_roles is not None:
            if role not in allowed_roles:
                return None
        else:
            if role not in ("admin", "user"):
                return None
        if not is_valid_username(str(payload.get("sub") or "")):
            return None
        return payload
    except Exception:
        return None

def verify_admin_jwt(token: str) -> dict | None:
    return verify_jwt(token, allowed_roles=("admin",))

def verify_user_jwt(token: str) -> dict | None:
    return verify_jwt(token, allowed_roles=("user",))
