import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel, Field, field_validator

try:
    from backend.database.db import DatabaseService
    from backend.security.auth import (
        verify_password,
        hash_password,
        create_user_jwt,
        verify_user_jwt,
        USER_COOKIE_NAME,
        is_valid_username,
    )
    from backend.security.rate_limiter import get_client_ip, check_rate_limit, is_locked_out, record_failed_login, clear_failed_login
    from backend.api.admin import get_current_admin
except ImportError:
    from database.db import DatabaseService  # type: ignore
    from security.auth import verify_password, hash_password, create_user_jwt, verify_user_jwt, USER_COOKIE_NAME, is_valid_username  # type: ignore
    from security.rate_limiter import get_client_ip, check_rate_limit, is_locked_out, record_failed_login, clear_failed_login  # type: ignore
    from api.admin import get_current_admin  # type: ignore

router = APIRouter(prefix="/api", tags=["Users"])
admin_router = APIRouter(prefix="/api/admin", tags=["Admin Users"])


# ── schemas ──

USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,32}$")

class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)
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
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)

    @field_validator("display_name")
    @classmethod
    def strip_dn(cls, v):  # type: ignore
        if v is None:
            return v
        v = str(v).strip()
        return v or None

class UserLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        v = v.strip().lower()
        if not USERNAME_RE.match(v):
            raise ValueError("Invalid username")
        return v

class AppSettingsUpdateRequest(BaseModel):
    user_token_expiry_hours: int = Field(ge=1, le=720)
    trial_prompts: int = Field(ge=0, le=100)


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
        raise HTTPException(status_code=403, detail="Account disabled — hubungi admin")
    return user


# ── User endpoints (login / verify / logout) ──

@router.post("/user/login")
def user_login(payload: UserLoginRequest, request: Request, response: Response):
    ip = get_client_ip(request)
    locked, retry = is_locked_out(f"user:{ip}")
    if locked:
        raise HTTPException(status_code=429, detail=f"Account locked. Retry after {retry}s", headers={"Retry-After": str(retry)})
    allowed, retry = check_rate_limit(f"user:login:{ip}", 10, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many login attempts. Retry after {retry}s", headers={"Retry-After": str(retry)})
    payload.username = payload.username.strip().lower()
    user = DatabaseService.get_user_by_username(payload.username)
    if not user or not verify_password(payload.password, user.get("password_hash") or ""):
        record_failed_login(f"user:{ip}")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not bool(user.get("is_active", True)):
        raise HTTPException(status_code=403, detail="Account disabled — hubungi admin")
    clear_failed_login(f"user:{ip}")
    # expiry from app settings
    app_s = DatabaseService.get_app_settings()
    hours = max(1, min(720, int(app_s.get("user_token_expiry_hours", 24))))
    token = create_user_jwt(user["username"], expiry_hours=hours)
    response.set_cookie(
        key=USER_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,  # set True in production via settings check if needed
        samesite="lax",
        max_age=hours * 3600,
        path="/",
    )
    return {"status": "success", "username": user["username"], "display_name": user.get("display_name"), "max_prompts": user.get("max_prompts"), "prompts_used": user.get("prompts_used", 0)}

@router.get("/user/verify")
def user_verify(request: Request, user: dict = Depends(get_current_user)):
    remaining = max(0, int(user.get("max_prompts", 0)) - int(user.get("prompts_used", 0))) if int(user.get("max_prompts", 0)) > 0 else None
    return {"status": "authenticated", "username": user["username"], "display_name": user.get("display_name"), "max_prompts": user.get("max_prompts"), "prompts_used": user.get("prompts_used", 0), "remaining": remaining}

@router.post("/user/logout")
def user_logout(request: Request, response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie(USER_COOKIE_NAME, path="/")
    return {"status": "success"}

@router.get("/user/me")
def user_me(request: Request, user: dict = Depends(get_current_user)):
    return {
        "username": user["username"],
        "display_name": user.get("display_name"),
        "max_prompts": user.get("max_prompts"),
        "prompts_used": user.get("prompts_used", 0),
        "remaining": max(0, int(user.get("max_prompts", 0)) - int(user.get("prompts_used", 0))) if int(user.get("max_prompts", 0)) else None,
        "is_active": user.get("is_active", True),
    }


# ── Admin CRUD users + settings ──

@admin_router.get("/users")
def admin_list_users(admin: str = Depends(get_current_admin)):
    users = DatabaseService.list_users()
    # never leak password_hash
    return [{"id": u.get("id"), "username": u.get("username"), "display_name": u.get("display_name"), "max_prompts": u.get("max_prompts"), "prompts_used": u.get("prompts_used", 0), "is_active": u.get("is_active", True), "created_at": u.get("created_at"), "updated_at": u.get("updated_at")} for u in users]

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
    return {"trial_prompts": int(s.get("trial_prompts", 3)), "user_token_expiry_hours": int(s.get("user_token_expiry_hours", 24))}

@admin_router.put("/settings")
def admin_update_settings(payload: AppSettingsUpdateRequest, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:settings:{ip}", 20, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    updated = DatabaseService.update_app_settings({"user_token_expiry_hours": int(payload.user_token_expiry_hours), "trial_prompts": int(payload.trial_prompts)})
    return {"status": "success", "settings": updated}
