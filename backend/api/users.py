import hmac
import re
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel, Field, field_validator

try:
    from backend.config.config import settings
    from backend.database.db import DatabaseService
    from backend.security import otp
    from backend.security.auth import (
        verify_password,
        hash_password,
        create_user_jwt,
        verify_user_jwt,
        USER_COOKIE_NAME,
    )
    from backend.security.rate_limiter import get_client_ip, check_rate_limit, is_locked_out, record_failed_login, clear_failed_login
    from backend.security.audit import log_action as audit_log
    from backend.api.admin import get_current_admin, get_config, get_knowledge_categories, get_knowledge_entries, admin_list_models
except ImportError:
    from config.config import settings  # type: ignore
    from database.db import DatabaseService  # type: ignore
    from security import otp  # type: ignore
    from security.auth import verify_password, hash_password, create_user_jwt, verify_user_jwt, USER_COOKIE_NAME  # type: ignore
    from security.rate_limiter import get_client_ip, check_rate_limit, is_locked_out, record_failed_login, clear_failed_login  # type: ignore
    from security.audit import log_action as audit_log  # type: ignore
    from api.admin import get_current_admin, get_config, get_knowledge_categories, get_knowledge_entries, admin_list_models  # type: ignore

router = APIRouter(prefix="/api", tags=["Users"])
admin_router = APIRouter(prefix="/api/admin", tags=["Admin Users"])


# ── schemas ──

USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,32}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=64)
    max_prompts: int = Field(default=50, ge=0, le=100000)
    is_active: bool = True

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        v = v.strip()
        if not USERNAME_RE.match(v):
            raise ValueError("Invalid username")
        return v

    @field_validator("display_name")
    @classmethod
    def strip_dn(cls, v):  # type: ignore
        if v is None:
            return v
        v = str(v).strip()
        return v or None

class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=64)
    max_prompts: Optional[int] = Field(default=None, ge=0, le=100000)
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)

    @field_validator("display_name")
    @classmethod
    def strip_dn(cls, v):  # type: ignore
        if v is None:
            return v
        v = str(v).strip()
        return v or None

class UserLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" in v:
            if not EMAIL_RE.match(v):
                raise ValueError("Invalid email")
            return v
        if not USERNAME_RE.match(v):
            raise ValueError("Invalid username")
        return v

class UserPasswordChangeRequest(BaseModel):
    current_password: Optional[str] = Field(default=None, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

class AppSettingsUpdateRequest(BaseModel):
    user_token_expiry_hours: int = Field(ge=1, le=720)
    trial_prompts: int = Field(ge=0, le=100)
    rag_match_count_short: Optional[int] = Field(default=None, ge=1, le=30)
    rag_match_count_long: Optional[int] = Field(default=None, ge=1, le=30)
    rag_match_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)


# ── user auth dependency ──

def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get(USER_COOKIE_NAME)
    if not token:
        auth = request.headers.get("Authorization") or ""
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized: No user token")
    payload = verify_user_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid user token")
    username = str(payload.get("sub") or "").strip().lower()
    user = DatabaseService.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized: User not found")
    if not bool(user.get("is_active", True)):
        raise HTTPException(status_code=403, detail="Account disabled - hubungi admin")
    if int(payload.get("sv") or 0) != int(user.get("session_version") or 0):
        raise HTTPException(status_code=401, detail="Unauthorized: Session expired")
    return user


# ── User endpoints (login / verify / logout) ──

@router.post("/user/login")
def user_login(payload: UserLoginRequest, request: Request, response: Response):
    ip = get_client_ip(request)
    payload.username = payload.username.strip().lower()
    if "@" in payload.username:
        user = DatabaseService.get_user_by_email(payload.username)
    else:
        user = DatabaseService.get_user_by_username(payload.username)
    # kunci lockout = akun + IP, supaya satu IP tidak mengunci akun lain
    lock_key = f"user:{(user or {}).get('username') or payload.username}:{ip}"
    locked, retry = is_locked_out(lock_key)
    if locked:
        raise HTTPException(status_code=429, detail=f"Account locked. Retry after {retry}s", headers={"Retry-After": str(retry)})
    allowed, retry = check_rate_limit(f"user:login:{ip}", 10, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many login attempts. Retry after {retry}s", headers={"Retry-After": str(retry)})
    if not user or not verify_password(payload.password, user.get("password_hash") or ""):
        record_failed_login(lock_key)
        audit_log(payload.username, "user_login_failed", target="user", detail="unknown user" if not user else "wrong password", ip=ip)
        if user and user.get("provider") == "google" and not user.get("password_hash"):
            raise HTTPException(status_code=401, detail="Akun ini daftar lewat Google. Atur kata sandi dulu lewat Lupa kata sandi.")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not bool(user.get("is_active", True)):
        audit_log(payload.username, "user_login_failed", target="user", detail="account disabled", ip=ip)
        raise HTTPException(status_code=403, detail="Account disabled - hubungi admin")
    clear_failed_login(lock_key)
    audit_log(user["username"], "user_login_success", target="user", ip=ip)
    # expiry from app settings
    app_s = DatabaseService.get_app_settings()
    hours = max(1, min(720, int(app_s.get("user_token_expiry_hours", 24))))
    token = create_user_jwt(user["username"], expiry_hours=hours, session_version=int(user.get("session_version") or 0))
    response.set_cookie(
        key=USER_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="lax",
        max_age=hours * 3600,
        path="/",
    )
    return {"status": "success", "username": user["username"], "display_name": user.get("display_name"), "max_prompts": user.get("max_prompts"), "prompts_used": user.get("prompts_used", 0)}

class UserRegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=64)

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        v = v.strip().lower()
        if not USERNAME_RE.match(v):
            raise ValueError("Invalid username")
        return v

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Invalid email")
        return v

    @field_validator("display_name")
    @classmethod
    def strip_dn(cls, v):  # type: ignore
        if v is None:
            return v
        v = str(v).strip()
        return v or None


EMAIL_RE = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$")


def _issue_otp(email: str, purpose: str) -> None:
    code = otp.generate_code()
    DatabaseService.create_email_otp(email, purpose, otp.hash_code(email, purpose, code), otp.expires_at_iso())
    try:
        otp.send_otp_email(email, code, purpose)
    except otp.MailError as e:
        raise HTTPException(status_code=502, detail=str(e))


def _set_user_cookie(response: Response, user: Dict[str, Any]) -> None:
    hours = max(1, min(720, int(DatabaseService.get_app_settings().get("user_token_expiry_hours", 24))))
    token = create_user_jwt(user["username"], expiry_hours=hours, session_version=int(user.get("session_version") or 0))
    response.set_cookie(
        key=USER_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="lax",
        max_age=hours * 3600,
        path="/",
    )


@router.post("/user/register", status_code=201)
def user_register(payload: UserRegisterRequest, request: Request, response: Response):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"user:register:{ip}", 5, 600)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Terlalu banyak pendaftaran. Coba lagi dalam {retry}s", headers={"Retry-After": str(retry)})
    if DatabaseService.get_user_by_username(payload.username):
        raise HTTPException(status_code=409, detail="Nama pengguna sudah dipakai")
    if DatabaseService.get_user_by_email(payload.email):
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")
    trial = max(0, int(DatabaseService.get_app_settings().get("trial_prompts", 3)))
    user = DatabaseService.create_user({
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "display_name": payload.display_name or payload.username,
        "email": payload.email,
        "email_verified": False,
        "provider": "manual",
        "max_prompts": trial,
        "prompts_used": 0,
        "is_active": True,
    })
    _issue_otp(payload.email, otp.PURPOSE_VERIFY)
    _set_user_cookie(response, user)
    return {
        "status": "success",
        "username": user["username"],
        "display_name": user.get("display_name"),
        "max_prompts": user.get("max_prompts"),
        "prompts_used": 0,
        "email_verified": False,
    }


class OtpVerifyRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

    @field_validator("email")
    @classmethod
    def norm_email(cls, v: str) -> str:
        return v.strip().lower()


class EmailOnlyRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)

    @field_validator("email")
    @classmethod
    def norm_email(cls, v: str) -> str:
        return v.strip().lower()


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def norm_email(cls, v: str) -> str:
        return v.strip().lower()


def _check_otp(email: str, purpose: str, code: str) -> None:
    row = DatabaseService.get_latest_email_otp(email, purpose)
    if not row:
        raise HTTPException(status_code=400, detail="Kode tidak valid. Minta kode baru.")
    if otp.is_expired(row.get("expires_at", "")):
        raise HTTPException(status_code=400, detail="Kode sudah kedaluwarsa. Minta kode baru.")
    attempts = int(row.get("attempts") or 0)
    if attempts >= otp.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Terlalu banyak percobaan salah. Minta kode baru.")
    expected = str(row.get("code_hash") or "")
    if not hmac.compare_digest(expected, otp.hash_code(email, purpose, code)):
        DatabaseService.update_email_otp_attempts(str(row["id"]), attempts + 1)
        raise HTTPException(status_code=400, detail="Kode salah.")
    DatabaseService.delete_email_otps(email, purpose)


@router.post("/user/verify-email/send")
def user_send_verify(request: Request, user: dict = Depends(get_current_user)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"user:otp_send:{ip}", 3, 600)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Terlalu sering meminta kode. Coba lagi dalam {retry}s", headers={"Retry-After": str(retry)})
    if user.get("email_verified"):
        return {"status": "already_verified"}
    if not user.get("email"):
        raise HTTPException(status_code=400, detail="Akun ini tidak memiliki email")
    _issue_otp(str(user["email"]).lower(), otp.PURPOSE_VERIFY)
    return {"status": "sent"}


@router.post("/user/verify-email")
def user_verify_email(payload: OtpVerifyRequest, request: Request, user: dict = Depends(get_current_user)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"user:otp_verify:{ip}", 10, 600)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Terlalu banyak percobaan. Coba lagi dalam {retry}s", headers={"Retry-After": str(retry)})
    if not user.get("email") or str(user["email"]).lower() != payload.email:
        raise HTTPException(status_code=400, detail="Email tidak cocok dengan akun")
    _check_otp(payload.email, otp.PURPOSE_VERIFY, payload.code)
    DatabaseService.update_user(str(user["id"]), {"email_verified": True})
    return {"status": "verified"}


@router.post("/user/password/forgot")
def user_password_forgot(payload: EmailOnlyRequest, request: Request):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"user:reset_send:{ip}", 3, 600)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Terlalu sering meminta kode. Coba lagi dalam {retry}s", headers={"Retry-After": str(retry)})
    # Respons selalu sama agar tidak membocorkan email terdaftar atau tidak.
    if DatabaseService.get_user_by_email(payload.email):
        try:
            _issue_otp(payload.email, otp.PURPOSE_RESET)
        except HTTPException:
            pass
    return {"status": "sent", "message": "Jika email terdaftar, kode reset sudah dikirim."}


@router.post("/user/password/reset")
def user_password_reset(payload: PasswordResetRequest, request: Request, response: Response):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"user:reset_verify:{ip}", 10, 600)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Terlalu banyak percobaan. Coba lagi dalam {retry}s", headers={"Retry-After": str(retry)})
    user = DatabaseService.get_user_by_email(payload.email)
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=400, detail="Kode tidak valid. Minta kode baru.")
    _check_otp(payload.email, otp.PURPOSE_RESET, payload.code)
    new_version = int(user.get("session_version") or 0) + 1
    updated = DatabaseService.update_user(str(user["id"]), {
        "password_hash": hash_password(payload.new_password),
        "session_version": new_version,
        "email_verified": True,
    }) or {**user, "session_version": new_version}
    _set_user_cookie(response, updated)
    return {"status": "success"}

@router.get("/user/verify")
def user_verify(request: Request, user: dict = Depends(get_current_user)):
    remaining = max(0, int(user.get("max_prompts", 0)) - int(user.get("prompts_used", 0))) if int(user.get("max_prompts", 0)) > 0 else None
    return {"status": "authenticated", "username": user["username"], "display_name": user.get("display_name"), "max_prompts": user.get("max_prompts"), "prompts_used": user.get("prompts_used", 0), "remaining": remaining}

@router.post("/user/logout")
def user_logout(request: Request, response: Response, user: dict = Depends(get_current_user)):
    DatabaseService.update_user(str(user["id"]), {"session_version": int(user.get("session_version") or 0) + 1})
    response.delete_cookie(USER_COOKIE_NAME, path="/")
    return {"status": "success"}

@router.get("/user/me")
def user_me(request: Request, user: dict = Depends(get_current_user)):
    profile = DatabaseService.get_user_profile(str(user.get("id")))
    return {
        "username": user["username"],
        "display_name": user.get("display_name"),
        "max_prompts": user.get("max_prompts"),
        "prompts_used": user.get("prompts_used", 0),
        "remaining": max(0, int(user.get("max_prompts", 0)) - int(user.get("prompts_used", 0))) if int(user.get("max_prompts", 0)) else None,
        "is_active": user.get("is_active", True),
        "has_password": bool(user.get("password_hash")),
        "goal": str(profile.get("goal") or "").strip(),
        "style_id": str(profile.get("style_id") or "").strip(),
    }


# ── User profile (nama, tujuan, gaya respons) ──

class UserProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=64)
    goal: Optional[str] = Field(default=None, max_length=300)
    style_id: Optional[str] = Field(default=None, max_length=32)
    gender: Optional[str] = Field(default=None, max_length=10)

    @field_validator("display_name")
    @classmethod
    def strip_dn(cls, v):  # type: ignore
        if v is None:
            return v
        return str(v).strip()

    @field_validator("goal")
    @classmethod
    def strip_goal(cls, v):  # type: ignore
        if v is None:
            return v
        return " ".join(str(v).split())

    @field_validator("style_id")
    @classmethod
    def check_style(cls, v):  # type: ignore
        if v is None:
            return v
        v = str(v).strip()
        if not v:
            return ""
        if not re.match(r"^[a-zA-Z0-9_-]{1,32}$", v):
            raise ValueError("Invalid style id")
        return v

    @field_validator("gender")
    @classmethod
    def check_gender(cls, v):  # type: ignore
        if v is None:
            return v
        v = str(v).strip().lower()
        if v not in ["male", "female", "other", ""]:
            raise ValueError("Invalid gender")
        return v


def _valid_style_ids() -> List[str]:
    cfg = DatabaseService.get_config_table("response_styles")
    styles = cfg.get("styles") if isinstance(cfg, dict) else None
    if not isinstance(styles, list):
        return []
    return [str(s.get("id")) for s in styles if isinstance(s, dict) and s.get("id")]


@router.get("/user/styles")
def user_list_styles(user: dict = Depends(get_current_user)):
    """Daftar template gaya respons yang dipilih admin. User hanya memilih."""
    cfg = DatabaseService.get_config_table("response_styles")
    styles = cfg.get("styles") if isinstance(cfg, dict) else None
    out = []
    if isinstance(styles, list):
        for s in styles:
            if isinstance(s, dict) and s.get("id"):
                out.append({
                    "id": str(s.get("id")),
                    "name": str(s.get("name") or "").strip(),
                    "description": str(s.get("description") or "").strip(),
                    "prompt": str(s.get("prompt") or "").strip(),
                })
    return {"styles": out}


@router.put("/user/password")
def user_change_password(payload: UserPasswordChangeRequest, request: Request, response: Response, user: dict = Depends(get_current_user)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"user:password:{ip}", 5, 300)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Terlalu banyak percobaan. Coba lagi dalam {retry}s", headers={"Retry-After": str(retry)})

    current_hash = user.get("password_hash") or ""
    if current_hash:
        if not payload.current_password or not verify_password(payload.current_password, current_hash):
            raise HTTPException(status_code=400, detail="Sandi lama salah")
    new_version = int(user.get("session_version") or 0) + 1
    DatabaseService.update_user(str(user["id"]), {"password_hash": hash_password(payload.new_password), "session_version": new_version})
    hours = max(1, min(720, int(DatabaseService.get_app_settings().get("user_token_expiry_hours", 24))))
    token = create_user_jwt(user["username"], expiry_hours=hours, session_version=new_version)
    response.set_cookie(
        key=USER_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="lax",
        max_age=hours * 3600,
        path="/",
    )
    return {"status": "success", "has_password": True}


@router.put("/user/profile")
def user_update_profile(payload: UserProfileUpdateRequest, request: Request, user: dict = Depends(get_current_user)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"user:profile:{ip}", 10, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})

    updates: Dict[str, Any] = {}
    if payload.display_name is not None:
        if not payload.display_name:
            raise HTTPException(status_code=400, detail="Nama tampilan tidak boleh kosong")
        updates["display_name"] = payload.display_name

    profile_patch: Dict[str, Any] = {}
    if payload.goal is not None:
        profile_patch["goal"] = payload.goal
    if payload.style_id is not None:
        if payload.style_id and payload.style_id not in _valid_style_ids():
            raise HTTPException(status_code=400, detail="Gaya respons tidak valid")
        profile_patch["style_id"] = payload.style_id
    if payload.gender is not None:
        profile_patch["gender"] = payload.gender

    if updates:
        updated = DatabaseService.update_user(str(user["id"]), updates)
        if updated:
            user = {**user, **updated}
    if profile_patch:
        DatabaseService.update_user_profile(str(user["id"]), profile_patch)

    profile = DatabaseService.get_user_profile(str(user["id"]))
    return {
        "status": "success",
        "username": user["username"],
        "display_name": user.get("display_name"),
        "goal": str(profile.get("goal") or "").strip(),
        "style_id": str(profile.get("style_id") or "").strip(),
    }


# ── Riwayat chat user login (retensi 7 hari, maks 3 chat) ──

class ChatSessionCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)


class ChatMessageItem(BaseModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str = Field(min_length=1, max_length=20000)


class ChatMessagesAppend(BaseModel):
    messages: List[ChatMessageItem] = Field(min_length=1, max_length=2)


@router.get("/user/chats")
def user_list_chats(user: dict = Depends(get_current_user)):
    rows = DatabaseService.list_chat_sessions(str(user["id"]))
    return {
        "items": [{"id": s["id"], "title": s.get("title") or "Chat baru", "updated_at": s.get("updated_at")} for s in rows],
        "limit": DatabaseService.CHAT_MAX_PER_USER,
        "retention_days": DatabaseService.CHAT_RETENTION_DAYS,
    }


@router.post("/user/chats")
def user_create_chat(payload: ChatSessionCreate, user: dict = Depends(get_current_user)):
    uid = str(user["id"])
    if DatabaseService.count_chat_sessions(uid) >= DatabaseService.CHAT_MAX_PER_USER:
        raise HTTPException(status_code=409, detail=f"Maksimal {DatabaseService.CHAT_MAX_PER_USER} chat tersimpan. Hapus salah satu dulu.")
    s = DatabaseService.create_chat_session(uid, (payload.title or "").strip() or "Chat baru")
    return {"id": s["id"], "title": s.get("title"), "updated_at": s.get("updated_at")}


@router.get("/user/chats/{session_id}")
def user_get_chat(session_id: str, user: dict = Depends(get_current_user)):
    uid = str(user["id"])
    s = DatabaseService.get_chat_session(uid, session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Chat tidak ditemukan")
    msgs = DatabaseService.list_chat_messages(session_id)
    return {
        "id": s["id"],
        "title": s.get("title") or "Chat baru",
        "messages": [{"role": m["role"], "content": m["content"]} for m in msgs],
    }


@router.post("/user/chats/{session_id}/messages")
def user_append_chat_messages(session_id: str, payload: ChatMessagesAppend, user: dict = Depends(get_current_user)):
    uid = str(user["id"])
    s = DatabaseService.get_chat_session(uid, session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Chat tidak ditemukan")
    items = [{"role": m.role, "content": m.content} for m in payload.messages]
    DatabaseService.append_chat_messages(session_id, items)
    if (s.get("title") or "Chat baru") == "Chat baru":
        first_user = next((m["content"] for m in items if m["role"] == "user"), "")
        if first_user:
            DatabaseService.rename_chat_session(session_id, first_user[:60])
    return {"status": "success"}


@router.delete("/user/chats/{session_id}")
def user_delete_chat(session_id: str, user: dict = Depends(get_current_user)):
    if not DatabaseService.delete_chat_session(str(user["id"]), session_id):
        raise HTTPException(status_code=404, detail="Chat tidak ditemukan")
    return {"status": "success"}


# ── Admin CRUD users + settings ──

@admin_router.get("/bootstrap")
def admin_bootstrap(request: Request, admin: str = Depends(get_current_admin)):
    return {
        "config": {
            "identity": get_config("ai_identity", admin),
            "personal": get_config("personal_information", admin),
            "personality": get_config("ai_personality", admin),
            "communication": get_config("communication_settings", admin),
            "system": get_config("system_instructions", admin),
            "response_styles": get_config("response_styles", admin),
        },
        "categories": get_knowledge_categories(admin),
        "entries": get_knowledge_entries(None, admin),
        "models": admin_list_models(request, admin=admin),
        "users": admin_list_users(admin),
        "settings": admin_get_settings(admin),
    }

@admin_router.get("/users")
def admin_list_users(admin: str = Depends(get_current_admin)):
    users = DatabaseService.list_users()
    # never leak password_hash
    return [{"id": u.get("id"), "username": u.get("username"), "display_name": u.get("display_name"), "email": u.get("email"), "provider": u.get("provider") or "manual", "max_prompts": u.get("max_prompts"), "prompts_used": u.get("prompts_used", 0), "is_active": u.get("is_active", True), "created_at": u.get("created_at"), "updated_at": u.get("updated_at")} for u in users]

@admin_router.post("/users")
def admin_create_user(payload: UserCreateRequest, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:users_create:{ip}", 20, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    username = payload.username.strip().lower()
    if DatabaseService.get_user_by_username(username):
        raise HTTPException(status_code=409, detail="Username already exists")
    pw_hash = hash_password(payload.password)
    user = DatabaseService.create_user({
        "username": username,
        "password_hash": pw_hash,
        "display_name": payload.display_name,
        "max_prompts": int(payload.max_prompts),
        "prompts_used": 0,
        "is_active": bool(payload.is_active),
    })
    return {"status": "success", "user": {"id": user.get("id"), "username": user.get("username"), "display_name": user.get("display_name"), "max_prompts": user.get("max_prompts"), "prompts_used": 0, "is_active": user.get("is_active")}}

@admin_router.put("/users/{user_id}")
def admin_update_user(user_id: str, payload: UserUpdateRequest, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:users_update:{ip}", 30, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    existing = DatabaseService.get_user_by_id(user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    updates: Dict[str, Any] = {}
    if payload.display_name is not None:
        updates["display_name"] = payload.display_name
    if payload.max_prompts is not None:
        updates["max_prompts"] = int(payload.max_prompts)
    if payload.is_active is not None:
        updates["is_active"] = bool(payload.is_active)
    if payload.password:
        updates["password_hash"] = hash_password(payload.password)
        updates["prompts_used"] = existing.get("prompts_used", 0)  # keep counter unless reset explicitly
    updated = DatabaseService.update_user(user_id, updates)
    return {"status": "success", "user": {"id": updated.get("id"), "username": updated.get("username"), "display_name": updated.get("display_name"), "max_prompts": updated.get("max_prompts"), "prompts_used": updated.get("prompts_used", 0), "is_active": updated.get("is_active")}}

@admin_router.delete("/users/{user_id}")
def admin_delete_user(user_id: str, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:users_del:{ip}", 20, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    ok = DatabaseService.delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success"}

@admin_router.post("/users/{user_id}/reset-usage")
def admin_reset_usage(user_id: str, request: Request, admin: str = Depends(get_current_admin)):
    u = DatabaseService.get_user_by_id(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    updated = DatabaseService.update_user(user_id, {"prompts_used": 0})
    return {"status": "success", "user": {"id": updated.get("id"), "username": updated.get("username"), "prompts_used": 0}}

@admin_router.get("/settings")
def admin_get_settings(admin: str = Depends(get_current_admin)):
    s = DatabaseService.get_app_settings()
    return s

@router.get("/trial")
def trial_info_public(request: Request):
    ip = get_client_ip(request)
    s = DatabaseService.get_app_settings()
    limit = max(0, int(s.get("trial_prompts", 3)))
    if limit == 0:
        return {"trial_prompts": 0, "used": 0, "remaining": 0, "allowed": False}
    used = DatabaseService.get_trial_used(ip)
    remaining = max(0, limit - used)
    return {"trial_prompts": limit, "used": used, "remaining": remaining, "allowed": used < limit}

@admin_router.get("/trial")
def trial_info_admin(request: Request, admin: str = Depends(get_current_admin)):
    s = DatabaseService.get_app_settings()
    return {
        "trial_prompts": int(s.get("trial_prompts", 3)),
        "user_token_expiry_hours": int(s.get("user_token_expiry_hours", 24)),
        "rag_match_count_short": s.get("rag_match_count_short"),
        "rag_match_count_long": s.get("rag_match_count_long"),
        "rag_match_threshold": s.get("rag_match_threshold"),
    }

@admin_router.put("/settings")
def admin_update_settings(payload: AppSettingsUpdateRequest, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:settings:{ip}", 20, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    patch = {"user_token_expiry_hours": int(payload.user_token_expiry_hours), "trial_prompts": int(payload.trial_prompts)}
    for k in ("rag_match_count_short", "rag_match_count_long"):
        if k in payload.model_fields_set and getattr(payload, k) is not None:
            patch[k] = getattr(payload, k)
    if "rag_match_threshold" in payload.model_fields_set:
        patch["rag_match_threshold"] = payload.rag_match_threshold
    updated = DatabaseService.update_app_settings(patch)
    return {"status": "success", "settings": updated}
