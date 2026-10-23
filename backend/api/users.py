import contextlib
import hmac
import re
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

try:
    from backend.api.admin import (
        admin_list_models,
        get_config,
        get_current_admin,
        get_knowledge_categories,
        get_knowledge_entries,
    )
    from backend.config.config import settings
    from backend.database.db import DatabaseService
    from backend.security import otp
    from backend.security.audit import log_action as audit_log
    from backend.security.auth import (
        USER_COOKIE_NAME,
        create_user_jwt,
        hash_password,
        is_valid_password,
        verify_password,
        verify_user_jwt,
    )
    from backend.security.rate_limiter import (
        clear_failed_login_durable,
        enforce_rate_limit,
        get_client_ip,
        is_locked_out_durable,
        record_failed_login_durable,
    )
except ImportError:
    from config.config import settings  # type: ignore
    from database.db import DatabaseService  # type: ignore
    from security import otp  # type: ignore
    from security.audit import log_action as audit_log  # type: ignore
    from security.auth import (  # type: ignore
        USER_COOKIE_NAME,
        create_user_jwt,
        hash_password,
        is_valid_password,
        verify_password,
        verify_user_jwt,
    )
    from security.rate_limiter import (
        clear_failed_login_durable,
        enforce_rate_limit,
        get_client_ip,
        is_locked_out_durable,
        record_failed_login_durable,
    )  # type: ignore

    from api.admin import (  # type: ignore
        admin_list_models,
        get_config,
        get_current_admin,
        get_knowledge_categories,
        get_knowledge_entries,
    )

router = APIRouter(prefix="/api", tags=["Users"])
admin_router = APIRouter(prefix="/api/admin", tags=["Admin Users"])


# ── schemas ──

USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,32}$")
# Email selalu dinormalisasi (lowercase) sebelum match, jadi regex ini cukup.
EMAIL_RE = re.compile(r"^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$")


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=64)
    max_prompts: int = Field(default=50, ge=0, le=100000)
    is_active: bool = True
    unlimited: bool = False

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        v = v.strip()
        if not USERNAME_RE.match(v):
            raise ValueError("Invalid username")
        return v

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if not is_valid_password(v):
            raise ValueError("Password harus minimal 8 karakter, mengandung huruf besar dan angka")
        return v

    @field_validator("display_name")
    @classmethod
    def strip_dn(cls, v):  # type: ignore
        if v is None:
            return v
        v = str(v).strip()
        return v or None


class UserUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=64)
    max_prompts: int | None = Field(default=None, ge=0, le=100000)
    is_active: bool | None = None
    unlimited: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def check_password(cls, v):  # type: ignore
        if v is None:
            return v
        if not is_valid_password(v):
            raise ValueError("Password harus minimal 8 karakter, mengandung huruf besar dan angka")
        return v

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
    current_password: str | None = Field(default=None, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if not is_valid_password(v):
            raise ValueError("Password harus minimal 8 karakter, mengandung huruf besar dan angka")
        return v


class AppSettingsUpdateRequest(BaseModel):
    user_token_expiry_hours: int = Field(ge=1, le=720)
    trial_prompts: int = Field(ge=0, le=100)
    rag_match_count_short: int | None = Field(default=None, ge=1, le=30)
    rag_match_count_long: int | None = Field(default=None, ge=1, le=30)
    rag_match_threshold: float | None = Field(default=None, ge=0.0, le=1.0)


# ── user auth dependency ──


def get_current_user(request: Request) -> dict[str, Any]:
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
    locked, retry = is_locked_out_durable(lock_key)
    if locked:
        raise HTTPException(
            status_code=429, detail=f"Account locked. Retry after {retry}s", headers={"Retry-After": str(retry)}
        )
    enforce_rate_limit(f"user:login:{ip}", 10, 60, durable=True, detail="Too many login attempts. Retry after {retry}s")
    if not user or not verify_password(payload.password, user.get("password_hash") or ""):
        record_failed_login_durable(lock_key)
        audit_log(
            payload.username,
            "user_login_failed",
            target="user",
            detail="unknown user" if not user else "wrong password",
            ip=ip,
        )
        if user and user.get("provider") == "google" and not user.get("password_hash"):
            raise HTTPException(
                status_code=401, detail="Akun ini daftar lewat Google. Atur kata sandi dulu lewat Lupa kata sandi."
            )
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not bool(user.get("is_active", True)):
        audit_log(payload.username, "user_login_failed", target="user", detail="account disabled", ip=ip)
        raise HTTPException(status_code=403, detail="Account disabled - hubungi admin")
    clear_failed_login_durable(lock_key)
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
    return {
        "status": "success",
        "username": user["username"],
        "display_name": user.get("display_name"),
        "email": user.get("email"),
        "email_verified": bool(user.get("email_verified", False)),
        "max_prompts": user.get("max_prompts"),
        "prompts_used": user.get("prompts_used", 0),
    }


class UserRegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=64)

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if not is_valid_password(v):
            raise ValueError("Password harus minimal 8 karakter, mengandung huruf besar dan angka")
        return v

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


def _issue_otp(email: str, purpose: str) -> None:
    code = otp.generate_code()
    DatabaseService.create_email_otp(email, purpose, otp.hash_code(email, purpose, code), otp.expires_at_iso())
    try:
        otp.send_otp_email(email, code, purpose)
    except otp.MailError as e:
        raise HTTPException(status_code=502, detail=str(e))


def _set_user_cookie(response: Response, user: dict[str, Any]) -> None:
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
    enforce_rate_limit(
        f"user:register:{ip}", 5, 600, durable=True, detail="Terlalu banyak pendaftaran. Coba lagi dalam {retry}s"
    )
    if DatabaseService.get_user_by_username(payload.username):
        raise HTTPException(status_code=409, detail="Nama pengguna sudah dipakai")
    if DatabaseService.get_user_by_email(payload.email):
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")
    trial = max(0, int(DatabaseService.get_app_settings().get("trial_prompts", 3)))
    user = DatabaseService.create_user(
        {
            "username": payload.username,
            "password_hash": hash_password(payload.password),
            "display_name": payload.display_name or payload.username,
            "email": payload.email,
            "email_verified": False,
            "provider": "manual",
            "max_prompts": trial,
            "prompts_used": 0,
            "is_active": True,
        }
    )
    # Kirim OTP best-effort: kalau layanan email belum dikonfigurasi, jangan
    # gagalkan registrasi (akun sudah terbuat). User tetap bisa "Kirim ulang".
    email_sent = True
    try:
        _issue_otp(payload.email, otp.PURPOSE_VERIFY)
    except HTTPException:
        email_sent = False
    _set_user_cookie(response, user)
    return {
        "status": "success",
        "username": user["username"],
        "display_name": user.get("display_name"),
        "email": payload.email,
        "email_verified": False,
        "email_sent": email_sent,
        "max_prompts": user.get("max_prompts"),
        "prompts_used": 0,
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

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if not is_valid_password(v):
            raise ValueError("Password harus minimal 8 karakter, mengandung huruf besar dan angka")
        return v

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
    enforce_rate_limit(
        f"user:otp_send:{ip}", 3, 600, durable=True, detail="Terlalu sering meminta kode. Coba lagi dalam {retry}s"
    )
    if user.get("email_verified"):
        return {"status": "already_verified"}
    if not user.get("email"):
        raise HTTPException(status_code=400, detail="Akun ini tidak memiliki email")
    _issue_otp(str(user["email"]).lower(), otp.PURPOSE_VERIFY)
    return {"status": "sent"}


@router.post("/user/verify-email")
def user_verify_email(payload: OtpVerifyRequest, request: Request, user: dict = Depends(get_current_user)):
    ip = get_client_ip(request)
    enforce_rate_limit(
        f"user:otp_verify:{ip}", 10, 600, durable=True, detail="Terlalu banyak percobaan. Coba lagi dalam {retry}s"
    )
    if not user.get("email") or str(user["email"]).lower() != payload.email:
        raise HTTPException(status_code=400, detail="Email tidak cocok dengan akun")
    _check_otp(payload.email, otp.PURPOSE_VERIFY, payload.code)
    DatabaseService.update_user(str(user["id"]), {"email_verified": True})
    return {"status": "verified"}


@router.post("/user/password/forgot")
def user_password_forgot(payload: EmailOnlyRequest, request: Request):
    ip = get_client_ip(request)
    enforce_rate_limit(
        f"user:reset_send:{ip}", 3, 600, durable=True, detail="Terlalu sering meminta kode. Coba lagi dalam {retry}s"
    )
    # Respons selalu sama agar tidak membocorkan email terdaftar atau tidak.
    if DatabaseService.get_user_by_email(payload.email):
        with contextlib.suppress(HTTPException):
            _issue_otp(payload.email, otp.PURPOSE_RESET)
    return {"status": "sent", "message": "Jika email terdaftar, kode reset sudah dikirim."}


@router.post("/user/password/reset")
def user_password_reset(payload: PasswordResetRequest, request: Request, response: Response):
    ip = get_client_ip(request)
    enforce_rate_limit(
        f"user:reset_verify:{ip}", 10, 600, durable=True, detail="Terlalu banyak percobaan. Coba lagi dalam {retry}s"
    )
    user = DatabaseService.get_user_by_email(payload.email)
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=400, detail="Kode tidak valid. Minta kode baru.")
    _check_otp(payload.email, otp.PURPOSE_RESET, payload.code)
    new_version = int(user.get("session_version") or 0) + 1
    updated = DatabaseService.update_user(
        str(user["id"]),
        {
            "password_hash": hash_password(payload.new_password),
            "session_version": new_version,
            "email_verified": True,
        },
    ) or {**user, "session_version": new_version}
    _set_user_cookie(response, updated)
    return {"status": "success"}


@router.get("/user/verify")
def user_verify(request: Request, user: dict = Depends(get_current_user)):
    # Kuota harian-only: tanpa paket harian = tanpa batas (None).
    remaining = None
    try:
        q = DatabaseService.get_quota_status(user)
        if q.get("mode") in ("daily", "expired"):
            remaining = q.get("remaining")
    except Exception:
        pass
    return {
        "status": "authenticated",
        "username": user["username"],
        "display_name": user.get("display_name"),
        "email": user.get("email"),
        "email_verified": bool(user.get("email_verified", False)),
        "max_prompts": user.get("max_prompts"),
        "prompts_used": user.get("prompts_used", 0),
        "remaining": remaining,
    }


@router.post("/user/logout")
def user_logout(request: Request, response: Response, user: dict = Depends(get_current_user)):
    DatabaseService.update_user(str(user["id"]), {"session_version": int(user.get("session_version") or 0) + 1})
    response.delete_cookie(USER_COOKIE_NAME, path="/")
    return {"status": "success"}


@router.get("/user/me")
def user_me(request: Request, user: dict = Depends(get_current_user)):
    profile = DatabaseService.get_user_profile(str(user.get("id")))
    # Kuota: nilai selalu dihitung backend (paket + pemakaian harian WIB).
    try:
        daily_quota = DatabaseService.get_quota_status(user)
    except Exception:
        daily_quota = None
    max_prompts = user.get("max_prompts")
    remaining = None  # unlimited default; daily plan overrides below
    prompts_used = 0  # legacy cumulative counter no longer authoritative
    # Mode harian mengisi angka aktif agar UI menampilkan nilai berjalan.
    # Mode "expired": masa aktif paket habis -> remaining 0.
    if daily_quota and daily_quota.get("mode") in ("daily", "expired", "unlimited"):
        remaining = daily_quota.get("remaining")
        prompts_used = daily_quota.get("used_today") or 0
    return {
        "username": user["username"],
        "display_name": user.get("display_name"),
        "email": user.get("email"),
        "email_verified": bool(user.get("email_verified", False)),
        "max_prompts": max_prompts,
        "prompts_used": prompts_used,
        "remaining": remaining,
        "daily_quota": daily_quota,
        "is_active": user.get("is_active", True),
        "has_password": bool(user.get("password_hash")),
        "goal": str(profile.get("goal") or "").strip(),
        "style_id": str(profile.get("style_id") or "").strip(),
        "gender": str(profile.get("gender") or "").strip(),
    }


# ── User profile (nama, tujuan, gaya respons) ──


class UserProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=64)
    goal: str | None = Field(default=None, max_length=300)
    style_id: str | None = Field(default=None, max_length=32)
    gender: str | None = Field(default=None, max_length=10)

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


def _valid_style_ids() -> list[str]:
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
                out.append(
                    {
                        "id": str(s.get("id")),
                        "name": str(s.get("name") or "").strip(),
                        "description": str(s.get("description") or "").strip(),
                        "prompt": str(s.get("prompt") or "").strip(),
                    }
                )
    return {"styles": out}


@router.put("/user/password")
def user_change_password(
    payload: UserPasswordChangeRequest, request: Request, response: Response, user: dict = Depends(get_current_user)
):
    ip = get_client_ip(request)
    enforce_rate_limit(
        f"user:password:{ip}", 5, 300, durable=True, detail="Terlalu banyak percobaan. Coba lagi dalam {retry}s"
    )

    current_hash = user.get("password_hash") or ""
    if current_hash and (not payload.current_password or not verify_password(payload.current_password, current_hash)):
        raise HTTPException(status_code=400, detail="Sandi lama salah")
    new_version = int(user.get("session_version") or 0) + 1
    DatabaseService.update_user(
        str(user["id"]), {"password_hash": hash_password(payload.new_password), "session_version": new_version}
    )
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
    enforce_rate_limit(f"user:profile:{ip}", 10, 60)

    updates: dict[str, Any] = {}
    if payload.display_name is not None:
        if not payload.display_name:
            raise HTTPException(status_code=400, detail="Nama tampilan tidak boleh kosong")
        updates["display_name"] = payload.display_name

    profile_patch: dict[str, Any] = {}
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
        "gender": str(profile.get("gender") or "").strip(),
    }


# ── Riwayat chat user login (retensi 7 hari, maks 3 chat) ──


class ChatSessionCreate(BaseModel):
    title: str | None = Field(default=None, max_length=120)


class ChatMessageItem(BaseModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str = Field(min_length=1, max_length=20000)


class ChatMessagesAppend(BaseModel):
    messages: list[ChatMessageItem] = Field(min_length=1, max_length=2)


@router.get("/user/chats")
def user_list_chats(user: dict = Depends(get_current_user)):
    rows = DatabaseService.list_chat_sessions(str(user["id"]))
    return {
        "items": [
            {"id": s["id"], "title": s.get("title") or "Chat baru", "updated_at": s.get("updated_at")} for s in rows
        ],
        "limit": DatabaseService.CHAT_MAX_PER_USER,
        "retention_days": DatabaseService.CHAT_RETENTION_DAYS,
    }


@router.post("/user/chats")
def user_create_chat(payload: ChatSessionCreate, user: dict = Depends(get_current_user)):
    uid = str(user["id"])
    if DatabaseService.count_chat_sessions(uid) >= DatabaseService.CHAT_MAX_PER_USER:
        raise HTTPException(
            status_code=409,
            detail=f"Memori Chat maksimal menyimpan {DatabaseService.CHAT_MAX_PER_USER} riwayat pesan. Chat lebih dari itu tidak akan tersimpan — hapus salah satu chat dulu untuk membebaskan slot.",
        )
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


@router.post("/user/chats/{session_id}/truncate-last-turn")
def user_truncate_last_turn(session_id: str, user: dict = Depends(get_current_user)):
    if DatabaseService.get_chat_session(str(user["id"]), session_id) is None:
        raise HTTPException(status_code=404, detail="Chat tidak ditemukan")
    DatabaseService.truncate_last_chat_turn(session_id)
    return {"status": "success"}


@router.delete("/user/chats/{session_id}")
def user_delete_chat(session_id: str, user: dict = Depends(get_current_user)):
    if not DatabaseService.delete_chat_session(str(user["id"]), session_id):
        raise HTTPException(status_code=404, detail="Chat tidak ditemukan")
    return {"status": "success"}


# ── Admin CRUD users + settings ──


@admin_router.get("/bootstrap")
def admin_bootstrap(request: Request, admin: str = Depends(get_current_admin)):
    # Live model catalog = HTTP call ke provider (timeout s/d 10s). Jangan
    # dibebankan ke bootstrap yang dipanggil di setiap halaman admin; tab
    # Models memuat katalog sendiri via /admin/models saat dibuka.
    include_catalog = True
    with contextlib.suppress(Exception):
        raw = (request.query_params.get("include_catalog") or "").strip().lower()
        if raw in ("0", "false", "no", "off"):
            include_catalog = False
    if include_catalog:
        models = admin_list_models(request, admin=admin)
    else:
        cfg = DatabaseService.get_config_table("ai_model_config")
        models = {
            "current": {
                "active_model": cfg.get("active_model") or "",
                "fallback_models": cfg.get("fallback_models") or [],
                "provider": cfg.get("provider") or "openrouter",
                "api_base_url": cfg.get("api_base_url") or "",
                "temperature": cfg.get("temperature", 0.4),
                "reasoning_enabled": cfg.get("reasoning_enabled", False),
                "max_tokens": cfg.get("max_tokens", 8192),
            },
            "live_catalog": {"object": "list", "data": [], "deferred": True},
        }
    return {
        "config": {
            "identity": get_config("ai_identity", admin),
            "personal": get_config("personal_information", admin),
            "personality": get_config("ai_personality", admin),
            "communication": get_config("communication_settings", admin),
            "system": get_config("system_instructions", admin),
            "response_styles": get_config("response_styles", admin),
            "pricing": DatabaseService.get_pricing(),
        },
        "categories": get_knowledge_categories(admin),
        "entries": get_knowledge_entries(None, admin),
        "models": models,
        "users": admin_list_users(admin),
        "settings": admin_get_settings(admin),
    }


class UserQuotaGrantRequest(BaseModel):
    """Grant kuota manual dari panel admin (angka ditentukan admin + paket)."""

    prompts: int = Field(ge=1, le=100000, description="Kuota harian yang diberikan")
    plan_id: str | None = Field(default=None, max_length=64, description="Paket acuan (opsional)")
    label: str | None = Field(default=None, max_length=64, description="Label tampilan (opsional)")
    days: int = Field(default=0, ge=0, le=3650, description="0 = tanpa batas waktu")


@admin_router.get("/users")
def admin_list_users(admin: str = Depends(get_current_admin)):
    users = DatabaseService.list_users()
    # Status kuota harian per user (bulk: 3 query total, hindari N+1 di panel admin).
    try:
        quota = DatabaseService.status_map(users)
    except Exception:
        quota = {}
    rows = []
    for u in users:
        # never leak password_hash / session_version
        uid = str(u.get("id"))
        rows.append(
            {
                "id": uid,
                "username": u.get("username"),
                "display_name": u.get("display_name"),
                "email": u.get("email"),
                "provider": u.get("provider") or "manual",
                "max_prompts": u.get("max_prompts"),
                "prompts_used": u.get("prompts_used", 0),
                "is_active": u.get("is_active", True),
                "unlimited": bool(u.get("unlimited", False)),
                # Satu sumber kuota: object `quota` (harian WIB).
                "quota": quota.get(uid),
                # Grant manual admin (jika ada) supaya form bisa menampilkannya.
                "manual_daily_limit": u.get("manual_daily_limit"),
                "manual_plan_label": u.get("manual_plan_label"),
                "manual_expires_at": u.get("manual_expires_at"),
                "created_at": u.get("created_at"),
                "updated_at": u.get("updated_at"),
            }
        )
    return rows


@admin_router.post("/users")
def admin_create_user(payload: UserCreateRequest, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    enforce_rate_limit(f"admin:users_create:{ip}", 20, 60)
    username = payload.username.strip().lower()
    if DatabaseService.get_user_by_username(username):
        raise HTTPException(status_code=409, detail="Username already exists")
    pw_hash = hash_password(payload.password)
    user = DatabaseService.create_user(
        {
            "username": username,
            "password_hash": pw_hash,
            "display_name": payload.display_name,
            "max_prompts": int(payload.max_prompts),
            "prompts_used": 0,
            "is_active": bool(payload.is_active),
            "unlimited": bool(payload.unlimited),
        }
    )
    return {
        "status": "success",
        "user": {
            "id": user.get("id"),
            "username": user.get("username"),
            "display_name": user.get("display_name"),
            "max_prompts": user.get("max_prompts"),
            "prompts_used": 0,
            "is_active": user.get("is_active"),
            "unlimited": bool(user.get("unlimited", False)),
        },
    }


@admin_router.put("/users/{user_id}")
def admin_update_user(
    user_id: str, payload: UserUpdateRequest, request: Request, admin: str = Depends(get_current_admin)
):
    ip = get_client_ip(request)
    enforce_rate_limit(f"admin:users_update:{ip}", 30, 60)
    existing = DatabaseService.get_user_by_id(user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    updates: dict[str, Any] = {}
    if payload.display_name is not None:
        updates["display_name"] = payload.display_name
    if payload.max_prompts is not None:
        updates["max_prompts"] = int(payload.max_prompts)
    if payload.is_active is not None:
        updates["is_active"] = bool(payload.is_active)
    if payload.unlimited is not None:
        updates["unlimited"] = bool(payload.unlimited)
    if payload.password:
        updates["password_hash"] = hash_password(payload.password)
        updates["prompts_used"] = existing.get("prompts_used", 0)  # keep counter unless reset explicitly
    updated = DatabaseService.update_user(user_id, updates)
    if updated is None:
        raise HTTPException(status_code=500, detail="Gagal memperbarui user di database")
    # Jangan lapor sukses kalau flag unlimited tidak benar-benar tersimpan
    # (skenario: kolom app_users.unlimited belum ada → update Supabase gagal
    # lalu di-log sebagai warning). Jalankan migrations/supabase_migration_unlimited.sql.
    if payload.unlimited is not None and bool(updated.get("unlimited", False)) != bool(payload.unlimited):
        raise HTTPException(
            status_code=500,
            detail=(
                "Flag unlimited tidak tersimpan. Cek kolom app_users.unlimited "
                "(jalankan migrations/supabase_migration_unlimited.sql) dan log server."
            ),
        )
    return {
        "status": "success",
        "user": {
            "id": updated.get("id"),
            "username": updated.get("username"),
            "display_name": updated.get("display_name"),
            "max_prompts": updated.get("max_prompts"),
            "prompts_used": updated.get("prompts_used", 0),
            "is_active": updated.get("is_active"),
            "unlimited": bool(updated.get("unlimited", False)),
        },
    }


@admin_router.post("/users/{user_id}/quota")
def admin_grant_user_quota(
    user_id: str,
    payload: UserQuotaGrantRequest,
    request: Request,
    admin: str = Depends(get_current_admin),
):
    """Beri/ubah kuota manual user: angka ditentukan admin + paket acuan opsional.

    Grant manual menang atas paket paid dan kuota default global, tapi tetap
    kalah dari flag Unlimited. `days` menentukan masa aktif (0 = tanpa batas).
    """
    ip = get_client_ip(request)
    enforce_rate_limit(f"admin:users_quota:{ip}", 30, 60)
    existing = DatabaseService.get_user_by_id(user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    plan_label = (payload.label or "").strip() or None
    if payload.plan_id:
        plan = DatabaseService.find_plan(str(payload.plan_id))
        if not plan:
            raise HTTPException(status_code=400, detail=f"Paket tidak ditemukan: {payload.plan_id}")
        plan_label = plan_label or f"{plan.get('label') or plan.get('id')} (manual)"

    expires_at: str | None = None
    if int(payload.days) > 0:
        expires_at = (datetime.now() + timedelta(days=int(payload.days))).isoformat()

    updates: dict[str, Any] = {
        "manual_daily_limit": int(payload.prompts),
        "manual_plan_label": plan_label or "Kuota manual",
        "manual_expires_at": expires_at,
    }
    updated = DatabaseService.update_user(user_id, updates)
    if updated is None:
        raise HTTPException(status_code=500, detail="Gagal menyimpan kuota manual user")
    if int(updated.get("manual_daily_limit") or 0) != int(payload.prompts):
        raise HTTPException(
            status_code=500,
            detail=(
                "Kuota manual tidak tersimpan. Cek kolom app_users.manual_daily_limit "
                "(jalankan migrations/supabase_migration_manual_quota.sql) dan log server."
            ),
        )
    return {
        "status": "success",
        "user": {
            "id": updated.get("id"),
            "username": updated.get("username"),
            "manual_daily_limit": updated.get("manual_daily_limit"),
            "manual_plan_label": updated.get("manual_plan_label"),
            "manual_expires_at": updated.get("manual_expires_at"),
        },
        "quota": DatabaseService.get_quota_status(updated),
    }


@admin_router.delete("/users/{user_id}/quota")
def admin_clear_user_quota(user_id: str, request: Request, admin: str = Depends(get_current_admin)):
    """Hapus grant kuota manual; user kembali ke paket paid / kuota default."""
    ip = get_client_ip(request)
    enforce_rate_limit(f"admin:users_quota_del:{ip}", 30, 60)
    existing = DatabaseService.get_user_by_id(user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    updated = DatabaseService.update_user(
        user_id,
        {"manual_daily_limit": None, "manual_plan_label": None, "manual_expires_at": None},
    )
    if updated is None:
        raise HTTPException(status_code=500, detail="Gagal menghapus kuota manual user")
    return {
        "status": "success",
        "user": {"id": updated.get("id"), "username": updated.get("username")},
        "quota": DatabaseService.get_quota_status(updated),
    }


@admin_router.delete("/users/{user_id}")
def admin_delete_user(user_id: str, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    enforce_rate_limit(f"admin:users_del:{ip}", 20, 60)
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
    if updated is None:
        raise HTTPException(status_code=500, detail="Gagal mereset pemakaian user")
    return {
        "status": "success",
        "user": {"id": updated.get("id"), "username": updated.get("username"), "prompts_used": 0},
    }


@admin_router.get("/settings")
def admin_get_settings(admin: str = Depends(get_current_admin)):
    s = DatabaseService.get_app_settings()
    return s


@admin_router.post("/users/sync-local")
def admin_sync_local_users(request: Request, admin: str = Depends(get_current_admin)):
    """Dorong user yang hanya ada di JSON lokal ke Supabase (mis. akun Google yang
    gagal tersimpan sebelumnya). Idempoten: user yang sudah ada dilewati."""
    created = DatabaseService.sync_local_users_to_supabase()
    audit_log(admin, "users_sync_local", detail=f"created={created}", ip=get_client_ip(request))
    return {"status": "success", "created": created}


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
    enforce_rate_limit(f"admin:settings:{ip}", 20, 60)
    patch = {
        "user_token_expiry_hours": int(payload.user_token_expiry_hours),
        "trial_prompts": int(payload.trial_prompts),
    }
    for k in ("rag_match_count_short", "rag_match_count_long"):
        if k in payload.model_fields_set and getattr(payload, k) is not None:
            patch[k] = getattr(payload, k)
    if "rag_match_threshold" in payload.model_fields_set:
        patch["rag_match_threshold"] = payload.rag_match_threshold
    updated = DatabaseService.update_app_settings(patch)
    return {"status": "success", "settings": updated}
