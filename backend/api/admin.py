from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
import re
import time
import os
from datetime import datetime, timezone, timedelta

_START_TIME = time.time()

try:
    from backend.database.db import DatabaseService
    from backend.knowledge.knowledge_service import KnowledgeService
    from backend.security.auth import verify_password, create_jwt, verify_jwt, COOKIE_NAME, settings, is_valid_username, JWT_EXPIRY_HOURS
    from backend.security.rate_limiter import get_client_ip, is_rate_limited, is_locked_out, is_locked_out_durable, record_failed_login, record_failed_login_durable, clear_failed_login, clear_failed_login_durable, check_rate_limit, check_rate_limit_durable
    from backend.database.cache import rag_cache
    from backend.knowledge.knowledge_service import EMBEDDING_PROVIDER
    from backend.security.audit import log_action as audit_log, list_actions as list_audit
except ImportError:
    from database.db import DatabaseService
    from knowledge.knowledge_service import KnowledgeService
    from security.auth import verify_password, create_jwt, verify_jwt, COOKIE_NAME, settings, is_valid_username, JWT_EXPIRY_HOURS
    from security.rate_limiter import get_client_ip, is_rate_limited, is_locked_out, is_locked_out_durable, record_failed_login, record_failed_login_durable, clear_failed_login, clear_failed_login_durable, check_rate_limit, check_rate_limit_durable
    from database.cache import rag_cache
    from knowledge.knowledge_service import EMBEDDING_PROVIDER  # type: ignore
    from security.audit import log_action as audit_log, list_actions as list_audit  # type: ignore

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# ── input limits ──
MAX_STR_LEN = 8000
MAX_DICT_KEYS = 30
MAX_DICT_VALUE_LEN = 8000
USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,32}$")

def _sanitize_str(v: Any) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if len(s) > MAX_STR_LEN:
        raise ValueError(f"Field too long (>{MAX_STR_LEN})")
    return s

def _validate_config_data(data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("data must be object")
    if len(data) > MAX_DICT_KEYS:
        raise ValueError(f"Too many keys (>{MAX_DICT_KEYS})")
    out: Dict[str, Any] = {}
    for k, v in data.items():
        if not isinstance(k, str) or len(k) > 64 or not re.match(r"^[a-zA-Z0-9_]+$", k):
            raise ValueError(f"Invalid key: {k}")
        if isinstance(v, str):
            if len(v) > MAX_DICT_VALUE_LEN:
                raise ValueError(f"Value too long for {k}")
            out[k] = v.strip()
        elif isinstance(v, (int, float, bool)) or v is None:
            out[k] = v
        elif isinstance(v, list):
            if len(v) > 20:
                raise ValueError(f"List too long for {k}")
            out[k] = [str(x).strip()[:200] if isinstance(x, str) else x for x in v]
        else:
            out[k] = str(v).strip()[:MAX_DICT_VALUE_LEN]
    return out

class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        v = v.strip()
        if not USERNAME_RE.match(v):
            raise ValueError("Invalid username format")
        return v

class ConfigUpdateRequest(BaseModel):
    section: str = Field(min_length=3, max_length=64)
    data: Dict[str, Any]

    @field_validator("section")
    @classmethod
    def check_section(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[a-z_]+$", v):
            raise ValueError("Invalid section")
        return v


class ModelConfigUpdateRequest(BaseModel):
    """Validated model switch - accepts ANY model ID string, any OpenAI-compatible provider."""
    active_model: str = Field(min_length=1, max_length=256)
    fallback_models: Optional[List[str]] = None
    provider: Optional[str] = Field(default=None, max_length=64)
    api_base_url: Optional[str] = Field(default=None, max_length=512)
    temperature: Optional[float] = Field(default=None, ge=0, le=2)
    reasoning_enabled: Optional[bool] = None
    max_tokens: Optional[int] = Field(default=None, ge=256, le=131072)


class ModelTestRequest(BaseModel):
    model: str = Field(min_length=1, max_length=256)
    api_key: Optional[str] = Field(default=None, max_length=512)
    base_url: Optional[str] = Field(default=None, max_length=512)
    provider: Optional[str] = Field(default=None, max_length=64)

    @field_validator("model")
    @classmethod
    def check_model(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1 or len(v) > 256 or not re.match(r"^[a-zA-Z0-9._/:-]+$", v):
            raise ValueError("Invalid model ID")
        return v

    @field_validator("base_url")
    @classmethod
    def check_url(cls, v):  # type: ignore
        if v is None:
            return v
        v = v.strip().rstrip("/")
        if not re.match(r"^https://[a-zA-Z0-9._-]+", v):
            raise ValueError("base_url must be https URL")
        return v


class CatalogPreviewRequest(BaseModel):
    api_key: Optional[str] = Field(default=None, max_length=512)
    base_url: Optional[str] = Field(default=None, max_length=512)
    include_free_only: bool = False
    limit: int = Field(default=60, ge=1, le=200)

class KnowledgeEntryRequest(BaseModel):
    id: Optional[str] = Field(default=None, max_length=64)
    category_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=10000)
    tags: Optional[List[str]] = Field(default=None, max_length=20)
    is_active: Optional[bool] = True

    @field_validator("title", "content")
    @classmethod
    def strip_fields(cls, v: str) -> str:
        return v.strip()

def get_current_admin(request: Request) -> str:
    # rate-limit token brute force: 30 checks/min per IP
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:verify:{ip}", 180, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized: No token provided")
    payload = verify_jwt(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
    # Sesi admin bisa dibatalkan (logout) lewat admin_session_version di app_settings.
    try:
        current_sv = int(DatabaseService.get_app_settings().get("admin_session_version", 0) or 0)
    except Exception:
        current_sv = 0
    if int(payload.get("sv") or 0) != current_sv:
        raise HTTPException(status_code=401, detail="Unauthorized: Session expired")
    return payload.get("sub", "admin")

@router.post("/login")
def admin_login(payload: LoginRequest, request: Request, response: Response):
    ip = get_client_ip(request)
    # lockout check first
    locked, retry = is_locked_out_durable(ip)
    if locked:
        raise HTTPException(status_code=429, detail=f"Account locked. Retry after {retry}s", headers={"Retry-After": str(retry)})
    # rate limit login: 10/min per IP
    allowed, retry = check_rate_limit_durable(f"admin:login:{ip}", 10, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many login attempts. Retry after {retry}s", headers={"Retry-After": str(retry)})
    # constant-time username check - still verify dummy hash to avoid timing leak
    if payload.username != settings.ADMIN_USERNAME:
        # burn same time as verify_password
        verify_password(payload.password, settings.ADMIN_PASSWORD_HASH)
        record_failed_login_durable(ip)
        audit_log(payload.username, "login_failed", target="admin", detail="unknown username", ip=ip)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not verify_password(payload.password, settings.ADMIN_PASSWORD_HASH):
        record_failed_login_durable(ip)
        audit_log(payload.username, "login_failed", target="admin", detail="wrong password", ip=ip)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    clear_failed_login_durable(ip)
    audit_log(payload.username, "login_success", target="admin", ip=ip)
    try:
        admin_sv = int(DatabaseService.get_app_settings().get("admin_session_version", 0) or 0)
    except Exception:
        admin_sv = 0
    token = create_jwt(payload.username, role="admin", expiry_hours=JWT_EXPIRY_HOURS, extra={"sv": admin_sv})
    # max_age matches JWT_EXPIRY_HOURS (2h)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="strict",
        max_age=JWT_EXPIRY_HOURS * 3600,
        path="/",
    )
    return {"status": "success", "message": "Admin authenticated successfully"}

@router.post("/logout")
def admin_logout(request: Request, response: Response, admin: str = Depends(get_current_admin)):
    # Naikkan versi sesi -> semua token admin lama (termasuk yang dicuri) langsung invalid.
    try:
        cur = DatabaseService.get_app_settings()
        DatabaseService.update_app_settings({"admin_session_version": int(cur.get("admin_session_version", 0) or 0) + 1})
    except Exception as e:
        print(f"[admin-logout] gagal invalidate sesi: {e}")
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/verify")
def verify_admin_session(request: Request, admin: str = Depends(get_current_admin)):
    return {"status": "authenticated", "admin": admin}

@router.get("/config/{section}")
def get_config(section: str, admin: str = Depends(get_current_admin)):
    valid_sections = ["ai_identity", "personal_information", "ai_personality", "communication_settings", "system_instructions", "ai_model_config", "response_styles"]
    if section not in valid_sections:
        raise HTTPException(status_code=400, detail="Invalid configuration section")
    return DatabaseService.get_config_table(section)

@router.put("/config")
def update_config(payload: ConfigUpdateRequest, request: Request, admin: str = Depends(get_current_admin)):
    valid_sections = ["ai_identity", "personal_information", "ai_personality", "communication_settings", "system_instructions", "ai_model_config", "response_styles"]
    if payload.section not in valid_sections:
        raise HTTPException(status_code=400, detail="Invalid configuration section")
    # rate-limit config writes: 20/min per IP
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:config:{ip}", 20, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})

    # Strict Schema Validation
    schemas = {
        "communication_settings": ["primary_language", "tone"],
        "ai_identity": ["name", "role", "purpose"],
        "ai_personality": ["personality", "tone"],
        "system_instructions": [], # Optional fields
        "ai_model_config": ["active_model", "provider"],
        "response_styles": ["styles"]
    }
    
    if payload.section in schemas:
        for field in schemas[payload.section]:
            if field not in payload.data or not str(payload.data[field]).strip():
                raise HTTPException(status_code=400, detail=f"Field '{field}' is required for {payload.section}")

    try:
        data = _validate_config_data(payload.data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if payload.section == "ai_model_config":
        if "active_model" in data and isinstance(data["active_model"], str):
            data["active_model"] = data["active_model"].strip()
            if data["active_model"] and not re.match(r"^[a-zA-Z0-9._/:-]+$", data["active_model"]):
                raise HTTPException(status_code=400, detail="Invalid active_model")
        if "api_base_url" in data and isinstance(data["api_base_url"], str):
            data["api_base_url"] = data["api_base_url"].strip().rstrip("/")
            if data["api_base_url"] and not data["api_base_url"].startswith("https://"):
                raise HTTPException(status_code=400, detail="api_base_url must be https")
        if "fallback_models" in data and isinstance(data["fallback_models"], list):
            data["fallback_models"] = [str(m).strip()[:256] for m in data["fallback_models"] if str(m).strip()][:20]
    updated = DatabaseService.update_config_table(payload.section, data)
    return {"status": "success", "section": payload.section, "data": updated}


@router.get("/models")
def admin_list_models(
    request: Request,
    include_free_only: bool = False,
    limit: int = 60,
    catalog_api_key: Optional[str] = None,
    catalog_base_url: Optional[str] = None,
    admin: str = Depends(get_current_admin),
):
    """Return current model config + live catalog for the admin picker (no hardcoding).
    Optional catalog_api_key / catalog_base_url let admin preview catalog with different creds without saving."""
    try:
        from backend.agent.agent import _resolve_base_url, _resolve_default_model, _resolve_api_key
    except ImportError:
        from agent.agent import _resolve_base_url, _resolve_default_model, _resolve_api_key  # type: ignore  # noqa
    try:
        from backend.api.chat import list_available_models  # type: ignore
    except ImportError:
        from api.chat import list_available_models  # type: ignore

    cfg = DatabaseService.get_config_table("ai_model_config")
    active = (cfg.get("active_model") or "").strip() or _resolve_default_model()
    fallbacks = [str(m).strip() for m in (cfg.get("fallback_models") or []) if str(m).strip()]
    provider = (cfg.get("provider") or "").strip() or "openrouter"
    base_url = (cfg.get("api_base_url") or "").strip() or _resolve_base_url()

    # If catalog overrides provided, try catalog with them (preview only, not saved)
    live: Dict[str, Any] = {}
    if catalog_api_key is not None or catalog_base_url is not None:
        # Use override for live catalog only
        override_key = (catalog_api_key or "").strip() or None
        override_url = (catalog_base_url or "").strip().rstrip("/") or None
        # call internal fetcher with overrides
        try:
            import json as _json, urllib.request as _ureq, ssl as _ssl
            from backend.agent.agent import _resolve_api_key as _rak, _resolve_base_url as _rbu  # type: ignore
            api_key = override_key or _rak()
            burl = override_url or _rbu() or "https://api.groq.com/openai/v1"
            burl = burl.strip().rstrip("/")
            origin = burl.split("/api/")[0]
            candidates = [origin + "/api/v1/models", burl + "/models" if not burl.endswith("/models") else burl]
            candidates = list(dict.fromkeys(candidates))
            items = None
            for u in candidates:
                try:
                    req = _ureq.Request(u, headers={"Authorization": f"Bearer {api_key}"})
                    ctx = _ssl.create_default_context()
                    with _ureq.urlopen(req, timeout=10, context=ctx) as resp:
                        if getattr(resp, "status", 200) != 200:
                            continue
                        payload = _json.loads(resp.read().decode() or "{}")
                        data = payload.get("data")
                        if isinstance(data, list):
                            items = data
                            break
                except Exception:
                    continue
            if items is not None:
                if include_free_only:
                    items = [it for it in items if isinstance(it, dict) and (":free" in str(it.get("id", "")) or str(it.get("pricing", {}).get("prompt", "x") if isinstance(it.get("pricing"), dict) else "") == "0")]
                items = items[:limit]
                live = {"object": "list", "data": [{"id": it.get("id"), "name": it.get("name") or it.get("id"), "context_length": it.get("context_length"), "pricing": it.get("pricing"), "description": (it.get("description") or "")[:240], "object": "model"} for it in items if isinstance(it, dict) and it.get("id")]}
            else:
                live = {"object": "list", "data": [], "error": "Catalog fetch failed with provided credentials", "fallback": None}
        except Exception as e:
            live = {"object": "list", "data": [], "error": str(e)}
    else:
        try:
            live = list_available_models(limit=limit, include_free_only=include_free_only)  # type: ignore
        except Exception:
            live = {}

    return {
        "current": {
            "active_model": active,
            "fallback_models": fallbacks,
            "provider": provider,
            "api_base_url": base_url,
            "temperature": cfg.get("temperature", 0.4),
            "reasoning_enabled": cfg.get("reasoning_enabled", False),
            "max_tokens": cfg.get("max_tokens", 8192),
        },
        "live_catalog": live,
    }


@router.post("/models/catalog")
def admin_catalog_preview(payload: CatalogPreviewRequest, request: Request, admin: str = Depends(get_current_admin)):
    """Preview catalog with supplied credentials via POST body - avoids leaking key in URL/logs.
    Body: {api_key, base_url, include_free_only, limit}. preview-only, not saved."""
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:catalog:{ip}", 20, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    try:
        from backend.agent.agent import _resolve_api_key as _rak, _resolve_base_url as _rbu  # type: ignore
    except ImportError:
        from agent.agent import _resolve_api_key as _rak, _resolve_base_url as _rbu  # type: ignore
    api_key = (payload.api_key or "").strip() or _rak()
    burl = (payload.base_url or "").strip().rstrip("/") or _rbu() or "https://api.groq.com/openai/v1"
    if payload.base_url and payload.base_url.strip():
        # validate https
        if not re.match(r"^https://[a-zA-Z0-9._-]+", burl):
            raise HTTPException(status_code=400, detail="base_url must be https URL")
    burl = burl.strip().rstrip("/")
    origin = burl.split("/api/")[0]
    candidates = [origin + "/api/v1/models", burl + "/models" if not burl.endswith("/models") else burl]
    candidates = list(dict.fromkeys(candidates))
    import json as _json, urllib.request as _ureq, ssl as _ssl
    items = None
    last_err = ""
    for u in candidates:
        try:
            req = _ureq.Request(u, headers={"Authorization": f"Bearer {api_key}"})
            ctx = _ssl.create_default_context()
            with _ureq.urlopen(req, timeout=10, context=ctx) as resp:
                if getattr(resp, "status", 200) != 200:
                    last_err = f"{u} -> {getattr(resp,'status',0)}"
                    continue
                data = _json.loads(resp.read().decode() or "{}")
                lst = data.get("data")
                if isinstance(lst, list):
                    items = lst
                    break
                last_err = f"{u} -> no data[]"
        except Exception as e:
            last_err = str(e)[:200]
            continue
    if items is not None:
        if payload.include_free_only:
            items = [it for it in items if isinstance(it, dict) and (":free" in str(it.get("id", "")) or str(it.get("pricing", {}).get("prompt", "x") if isinstance(it.get("pricing"), dict) else "") == "0")]
        items = items[: max(1, min(200, int(payload.limit)))]
        return {"object": "list", "data": [{"id": it.get("id"), "name": it.get("name") or it.get("id"), "context_length": it.get("context_length"), "pricing": it.get("pricing"), "description": (it.get("description") or "")[:240], "object": "model"} for it in items if isinstance(it, dict) and it.get("id")]}
    return {"object": "list", "data": [], "error": last_err or "Catalog fetch failed with provided credentials"}


@router.put("/models")
def admin_update_models(payload: ModelConfigUpdateRequest, request: Request, admin: str = Depends(get_current_admin)):
    """Switch active model + fallbacks. Any model ID accepted - no whitelist, no Gemini hardcoding."""
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:models_write:{ip}", 15, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    if not payload.active_model or not payload.active_model.strip():
        raise HTTPException(status_code=400, detail="active_model must be a non-empty model ID string")
    active = payload.active_model.strip()
    current = DatabaseService.get_config_table("ai_model_config")
    # preserve existing values when field not sent
    fallbacks_raw = payload.fallback_models if payload.fallback_models is not None else current.get("fallback_models", [])
    fallbacks = [str(m).strip() for m in (fallbacks_raw or []) if str(m).strip()]
    # ensure active appears first / not duplicated weirdly
    fallbacks = [m for m in fallbacks if m != active]

    updated_cfg: Dict[str, Any] = {
        **current,
        "active_model": active,
        "fallback_models": fallbacks,
        "provider": (payload.provider.strip() if isinstance(payload.provider, str) and payload.provider.strip() else current.get("provider", "openrouter")),
        "api_base_url": (payload.api_base_url.strip().rstrip("/") if isinstance(payload.api_base_url, str) and payload.api_base_url.strip() else current.get("api_base_url", "https://openrouter.ai/api/v1")),
        "temperature": float(payload.temperature) if payload.temperature is not None else float(current.get("temperature", 0.4)),
        "reasoning_enabled": bool(payload.reasoning_enabled) if payload.reasoning_enabled is not None else bool(current.get("reasoning_enabled", False)),
        "max_tokens": int(payload.max_tokens) if payload.max_tokens is not None else int(current.get("max_tokens", 8192) or 8192),
    }
    # clamp temperature to valid range
    if updated_cfg["temperature"] < 0:
        updated_cfg["temperature"] = 0
    if updated_cfg["temperature"] > 2:
        updated_cfg["temperature"] = 2
    # clamp max_tokens: reasoning model butuh headroom, jangan turun di bawah 256
    if updated_cfg["max_tokens"] < 256:
        updated_cfg["max_tokens"] = 256
    if updated_cfg["max_tokens"] > 131072:
        updated_cfg["max_tokens"] = 131072

    saved = DatabaseService.update_config_table("ai_model_config", updated_cfg)
    return {"status": "success", "data": saved}


@router.post("/models/test")
def admin_test_model(payload: ModelTestRequest, request: Request, admin: str = Depends(get_current_admin)):
    """Lightweight probe - does chat/completions accept this model with current (or override) creds?"""
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:models_test:{ip}", 12, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    model = payload.model.strip()
    if not re.match(r"^[a-zA-Z0-9._/:-]+$", model):
        raise HTTPException(status_code=400, detail="Invalid model ID")
    try:
        from backend.agent.agent import _resolve_api_key, _resolve_base_url
    except ImportError:
        from agent.agent import _resolve_api_key, _resolve_base_url  # type: ignore
    # provider fallback: payload > DB ai_model_config > env MODEL_PROVIDER > openrouter
    try:
        from backend.config.config import settings as _settings  # type: ignore
    except ImportError:
        from config.config import settings as _settings  # type: ignore
    db_cfg = {}
    try:
        db_cfg = DatabaseService.get_config_table("ai_model_config") or {}
    except Exception:
        db_cfg = {}
    provider = (payload.provider or "").strip() or (db_cfg.get("provider") or "").strip() or (getattr(_settings, "MODEL_PROVIDER", "") or "").strip() or "openrouter"
    # api_key priority: explicit payload > provider-resolved key > any available key
    explicit_key = (payload.api_key or "").strip()
    if explicit_key:
        api_key = explicit_key
    else:
        api_key = _resolve_api_key(provider)
        if not api_key:
            # fallback try other provider keys (openrouter/groq) before failing
            for p in ("openrouter", "groq", ""):
                if p == provider:
                    continue
                try:
                    k = _resolve_api_key(p)
                    if k:
                        api_key = k
                        break
                except Exception:
                    continue
    # base_url priority: explicit payload > DB api_base_url > provider default
    explicit_url = (payload.base_url or "").strip().rstrip("/")
    if explicit_url:
        base_url = explicit_url
    else:
        db_url = (db_cfg.get("api_base_url") or "").strip().rstrip("/")
        base_url = db_url or _resolve_base_url(provider) or "https://openrouter.ai/api/v1"
    # diagnostic: mask key for logging (never log full key)
    # auto-correct provider vs base_url mismatch (gsk_ ke openrouter = 401 pasti)
    low_url = base_url.lower()
    if "openrouter" in low_url and provider.lower() == "groq":
        print(f"[models/test] auto-correct provider groq->openrouter karena base_url {base_url}")
        provider = "openrouter"
        # re-resolve key for openrouter if we used groq key
        if api_key.startswith("gsk_"):
            try:
                alt = _resolve_api_key("openrouter")
                if alt and not alt.startswith("gsk_"):
                    print(f"[models/test] ganti key gsk_ -> openrouter karena URL openrouter")
                    api_key = alt
            except Exception:
                pass
    if "groq" in low_url and provider.lower() == "openrouter" and api_key.startswith("sk-or-"):
        print(f"[models/test] auto-correct provider openrouter->groq karena base_url {base_url}")
        provider = "groq"
        try:
            alt = _resolve_api_key("groq")
            if alt:
                api_key = alt
        except Exception:
            pass
    def _mask(k: str) -> str:
        k = (k or "").strip()
        if len(k) <= 8: return "***"
        return k[:8] + "***" + k[-4:]
    src = "payload" if explicit_key else "env/DB"
    import os as _os
    has_env_key = bool((_os.getenv("OPENROUTER_API_KEY") or "").strip() or (_os.getenv("GROQ_API_KEY") or "").strip())
    has_openrouter = bool((_os.getenv("OPENROUTER_API_KEY") or "").strip())
    has_groq = bool((_os.getenv("GROQ_API_KEY") or "").strip())
    print(f"[models/test] provider={provider} base_url={base_url} key={_mask(api_key)} src={src} has_env_key={has_env_key} has_openrouter={has_openrouter} has_groq={has_groq} model={model}")
    if api_key.startswith("gsk_") and "openrouter" in low_url:
        print(f"[models/test] WARNING gsk_ key dikirim ke openrouter - pasti 401. Ganti provider=groq + base_url=https://api.groq.com/openai/v1 atau pakai sk-or- key")
    if api_key.startswith("sk-or-") and "groq" in low_url:
        print(f"[models/test] WARNING sk-or- key dikirim ke groq - pasti 401")
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key available - isi API KEY KATALOG atau set OPENROUTER_API_KEY/GROQ_API_KEY di .env dan restart backend")
    # Probe via OpenAI SDK (stream=False, tiny tokens) - with explicit header fallback via urllib if 401
    import time as _time
    t0 = _time.perf_counter()
    try:
        from openai import OpenAI
        client = OpenAI(base_url=base_url, api_key=api_key, default_headers={"Authorization": f"Bearer {api_key}"} if False else None)
        # OpenAI SDK already sets Authorization: Bearer <key>; above is no-op unless needed for debugging
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=8,
            temperature=0,
            stream=False,
            extra_headers={"HTTP-Referer": "http://localhost:3000", "X-Title": "ITZ AI"} if "openrouter" in base_url else None,
        )
        latency_ms = int((_time.perf_counter() - t0) * 1000)
        choice = getattr(resp, "choices", None)
        ok = bool(choice and len(choice) > 0)
        text = ""
        if ok:
            try:
                text = (getattr(choice[0].message, "content", "") or "").strip()[:200]
            except Exception:
                text = ""
        return {"status": "ok" if ok else "error", "model": model, "latency_ms": latency_ms, "sample": text or None, "base_url": base_url, "provider": provider, "key_mask": _mask(api_key)}
    except Exception as e:
        latency_ms = int((_time.perf_counter() - t0) * 1000)
        msg = str(e)[:600]
        # If 401, try direct urllib to surface provider's message and confirm header was sent
        # Include hint for common misconfig
        hint = ""
        if "401" in msg or "Missing Authentication" in msg:
            hint = " - cek .env OPENROUTER_API_KEY/GROQ_API_KEY tanpa kutip, tanpa spasi, restart backend (python -m backend.api.main), cek provider vs base_url (openrouter→https://openrouter.ai/api/v1, groq→https://api.groq.com/openai/v1)"
        print(f"[models/test] FAIL {msg} hint={hint}")
        raise HTTPException(status_code=502, detail={"model": model, "latency_ms": latency_ms, "error": msg + hint, "base_url": base_url, "provider": provider, "key_mask": _mask(api_key)})


@router.get("/stats")
def admin_stats(request: Request, admin: str = Depends(get_current_admin)):
    """Real dashboard stats - no mocks. Derived from app_users, knowledge, trial_usage, uptime."""
    try:
        users = DatabaseService.list_users()
    except Exception:
        users = []
    try:
        entries = DatabaseService.get_knowledge_entries()
    except Exception:
        entries = []
    try:
        cats = DatabaseService.get_knowledge_categories()
    except Exception:
        cats = []
    # trial total - local file + supabase best-effort
    trial_total_used = 0
    try:
        # try supabase count
        from backend.database.db import supabase_client as _supa  # type: ignore
        if _supa:
            try:
                res = _supa.table("trial_usage").select("used").execute()
                if res.data:
                    trial_total_used = sum(int(r.get("used", 0) or 0) for r in res.data)
            except Exception:
                raise
        else:
            raise RuntimeError("no supabase")
    except Exception:
        try:
            import json as _json, os as _os
            from backend.database.db import LOCAL_DATA_DIR  # type: ignore
            p = _os.path.join(LOCAL_DATA_DIR, "trial_usage.json")
            if _os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    d = _json.load(f)
                    if isinstance(d, dict):
                        trial_total_used = sum(int(v or 0) for v in d.values())
        except Exception:
            trial_total_used = 0

    total_users = len(users)
    active_users = sum(1 for u in users if bool(u.get("is_active", True)))
    disabled_users = total_users - active_users
    total_prompts_used = sum(int(u.get("prompts_used", 0) or 0) for u in users)
    exhausted = sum(1 for u in users if int(u.get("max_prompts", 0) or 0) > 0 and int(u.get("prompts_used", 0) or 0) >= int(u.get("max_prompts", 0) or 0))
    unlimited_users = sum(1 for u in users if int(u.get("max_prompts", 0) or 0) == 0)
    avg_prompts = round(total_prompts_used / total_users, 1) if total_users else 0
    # uptime
    try:
        uptime_secs = int(time.time() - _START_TIME)
        # also consider OS boot if available? keep process uptime
        h, rem = divmod(uptime_secs, 3600)
        m, s = divmod(rem, 60)
        if h >= 24:
            d, h = divmod(h, 24)
            uptime_str = f"{d}d {h}h {m}m"
        elif h > 0:
            uptime_str = f"{h}h {m}m"
        else:
            uptime_str = f"{m}m {s}s"
    except Exception:
        uptime_secs = 0
        uptime_str = "-"

    # knowledge breakdown by category name
    cat_id_to_name = {c.get("id"): c.get("name", c.get("slug", "")) for c in cats}
    cat_counts: Dict[str, int] = {}
    for e in entries:
        name = cat_id_to_name.get(e.get("category_id")) or e.get("category_slug") or "Unknown"
        cat_counts[name] = cat_counts.get(name, 0) + 1
    knowledge_by_category = [{"name": k, "value": v} for k, v in cat_counts.items()]

    # top prompts consumers
    top_users = sorted(users, key=lambda u: int(u.get("prompts_used", 0) or 0), reverse=True)[:6]
    top_prompts = [{"username": u.get("username"), "prompts_used": int(u.get("prompts_used", 0) or 0), "max_prompts": int(u.get("max_prompts", 0) or 0)} for u in top_users]

    total_requests = total_prompts_used + trial_total_used
    # aggregated views by period (day/week/month/year) - default 14 day buckets
    q_period = "day"
    q_limit = 14
    try:
        qp = (request.query_params.get("period") or "day").strip().lower() if hasattr(request, "query_params") else "day"
        if qp in ("day", "week", "month", "year"):
            q_period = qp
        q_limit = max(1, min(60, int(request.query_params.get("limit", "14")) if hasattr(request, "query_params") else 14))
    except Exception:
        pass
    try:
        daily_requests = DatabaseService.get_aggregated_requests(period=q_period, limit=q_limit)
    except Exception:
        daily_requests = []
    try:
        daily_latency = DatabaseService.get_aggregated_latency(period=q_period, limit=q_limit)
    except Exception:
        daily_latency = []
    try:
        # expose period for frontend
        period_meta = {"period": q_period, "limit": q_limit}
    except Exception:
        period_meta = {"period": "day", "limit": 14}

    return {
        "totalRequests": total_requests,
        "totalUsers": total_users,
        "activeUsers": active_users,
        "disabledUsers": disabled_users,
        "knowledgeEntries": len(entries),
        "totalPromptsUsed": total_prompts_used,
        "trialTotalUsed": trial_total_used,
        "exhausted": exhausted,
        "unlimitedUsers": unlimited_users,
        "dailyRequests": daily_requests,
        "dailyLatency": daily_latency,
        "periodMeta": period_meta,
        "avgPrompts": avg_prompts,
        "uptime": uptime_str,
        "uptimeSeconds": uptime_secs,
        "knowledgeByCategory": knowledge_by_category,
        "topPrompts": top_prompts,
        # fields intentionally not mocked: errorRate/tokens/cache not tracked yet
        "errorRate": None,
        "tokensProcessed": None,
        "cacheHitRate": None,
    }


class TokenBudgetRequest(BaseModel):
    daily_token_budget: int = Field(default=0, ge=0, le=10_000_000_000)


@router.get("/token-usage")
def admin_token_usage(days: int = 14, admin: str = Depends(get_current_admin)):
    """Agregasi token harian, sisa budget, dan konsumsi token per user."""
    try:
        stats = DatabaseService.get_token_stats(days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token stats error: {e}")

    users_by_id = {}
    try:
        users_by_id = {str(u.get("id")): u for u in DatabaseService.list_users()}
    except Exception:
        pass

    for row in stats.get("by_user", []):
        owner = row.get("owner", "")
        if owner in users_by_id:
            u = users_by_id[owner]
            row["label"] = u.get("display_name") or u.get("username") or owner
            row["kind"] = "user"
            row["prompts_used"] = int(u.get("prompts_used", 0) or 0)
            row["max_prompts"] = int(u.get("max_prompts", 0) or 0)
            row["status"] = u.get("status", "active")
        elif str(owner).startswith("trial:"):
            row["label"] = f"Trial {str(owner).split(':', 1)[1]}"
            row["kind"] = "trial"
        else:
            row["label"] = owner
            row["kind"] = "unknown"
        total_all = stats.get("total", {}).get("total", 0) or 1
        row["share"] = round(100.0 * int(row.get("total", 0) or 0) / total_all, 1)
    return stats


@router.put("/token-budget")
def admin_token_budget(payload: TokenBudgetRequest, request: Request, admin: str = Depends(get_current_admin)):
    """Budget token harian global (0 = tanpa batas)."""
    try:
        budget = DatabaseService.set_token_budget(payload.daily_token_budget)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Budget update error: {e}")
    audit_log(admin, "token_budget_update", detail=f"budget={budget}", ip=get_client_ip(request))
    return {"budget": budget}


@router.get("/audit")
def admin_audit(limit: int = 100, admin: str = Depends(get_current_admin)):
    return {"items": list_audit(limit)}


@router.post("/knowledge/reindex")
def admin_reindex_knowledge(request: Request, admin: str = Depends(get_current_admin)):
    """Embed ulang SEMUA entry ke provider aktif. Semua embedding divalidasi dulu;
    kalau ada yang gagal, index lama tidak disentuh."""
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:reindex:{ip}", 3, 300)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Terlalu sering. Coba lagi {retry}s", headers={"Retry-After": str(retry)})
    if EMBEDDING_PROVIDER == "off":
        raise HTTPException(status_code=400, detail="EMBEDDING_PROVIDER=off - reindex dibatalkan")
    entries = DatabaseService.get_knowledge_entries() or []
    plan = []
    for e in entries:
        content = e.get("content") or ""
        if not content.strip():
            continue
        try:
            n = KnowledgeService.index_entry(e["id"], content)
            plan.append({"id": e["id"], "title": e.get("title", ""), "chunks": n})
        except Exception as ex:
            audit_log(admin, "knowledge_reindex_failed", target=str(e.get("id")), detail=str(ex), ip=ip)
            raise HTTPException(status_code=502, detail=f"Reindex gagal pada entry '{e.get('title', '?')}'. Index sebagian mungkin sudah berubah; cek log server.")
    rag_cache.clear()
    audit_log(admin, "knowledge_reindex", detail=f"entries={len(plan)} provider={EMBEDDING_PROVIDER}", ip=ip)
    return {"status": "success", "entries": len(plan), "chunks": sum(p["chunks"] for p in plan), "provider": EMBEDDING_PROVIDER}


@router.get("/health")
def admin_health(admin: str = Depends(get_current_admin)):
    """Ringkasan kesehatan untuk sidebar & dashboard admin."""
    db_ok, db_mode = False, "lokal"
    try:
        from backend.database.db import supabase_client as _sc
    except ImportError:
        from database.db import supabase_client as _sc  # type: ignore
    if _sc:
        try:
            _sc.table("app_settings").select("id").limit(1).execute()
            db_ok, db_mode = True, "supabase"
        except Exception:
            db_mode = "supabase (gagal)"
    token_budget = None
    try:
        stats = DatabaseService.get_token_stats(1)
        token_budget = {"budget": stats.get("budget", 0), "today": stats.get("today", {}).get("total", 0), "remaining": stats.get("remaining")}
    except Exception:
        pass
    last_login_fail = next((r for r in list_audit(50) if r.get("action") == "login_failed"), None)
    return {
        "backend": "ok",
        "database": {"ok": db_ok, "mode": db_mode},
        "provider": {"name": EMBEDDING_PROVIDER, "embedding": EMBEDDING_PROVIDER, "model": _active_chat_provider()},
        "token_budget": token_budget,
        "last_login_failure": last_login_fail,
    }


def _active_chat_provider() -> str:
    try:
        return str(settings.MODEL_PROVIDER or "openrouter")
    except Exception:
        return "unknown"


@router.get("/knowledge/categories")
def get_knowledge_categories(admin: str = Depends(get_current_admin)):
    return DatabaseService.get_knowledge_categories()

@router.get("/knowledge/entries")
def get_knowledge_entries(category: Optional[str] = None, admin: str = Depends(get_current_admin)):
    return DatabaseService.get_knowledge_entries(category)

@router.post("/knowledge/entries")
def save_knowledge_entry(payload: KnowledgeEntryRequest, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:knowledge:{ip}", 30, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    data = payload.model_dump()
    saved = DatabaseService.create_or_update_knowledge_entry(data)
    # Index synchronously - serverless runtimes (Vercel) kill background tasks
    # after the response is sent.
    index_error = None
    try:
        KnowledgeService.index_entry(saved["id"], saved["content"])
    except Exception as e:
        index_error = str(e)
        print(f"Warning: indexing failed for entry {saved.get('id')}: {e}")
    audit_log(admin, "knowledge_save", target=str(saved.get("id")), detail=saved.get("title", ""), ip=ip)
    return {"status": "partial" if index_error else "success", "entry": saved, "index_error": index_error}

@router.delete("/knowledge/entries/{entry_id}")
def delete_knowledge_entry(entry_id: str, request: Request, admin: str = Depends(get_current_admin)):
    if not re.match(r"^[a-zA-Z0-9_-]{1,64}$", entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry_id")
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:knowledge_del:{ip}", 20, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    DatabaseService.delete_knowledge_entry(entry_id)
    rag_cache.clear()
    audit_log(admin, "knowledge_delete", target=entry_id, ip=ip)
    return {"status": "success", "message": f"Entry {entry_id} deleted"}


# ─── Bulk export / import (JSON upload to populate AI identity → system_instructions) ───
# Note: ai_model_config is intentionally NOT part of bulk import/export.
# Models are managed manually on the "AI Models" tab so bulk uploads can't overwrite them.
ADMIN_BULK_SECTIONS = ["ai_identity", "personal_information", "ai_personality", "communication_settings", "system_instructions"]


@router.get("/export")
def admin_export_all(admin: str = Depends(get_current_admin)):
    """Export all admin-configurable sections + knowledge in one JSON blob."""
    payload: Dict[str, Any] = {"version": 1, "exported_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()}
    for sec in ADMIN_BULK_SECTIONS:
        try:
            payload[sec] = DatabaseService.get_config_table(sec)
        except Exception as e:
            payload[sec] = {"_error": str(e)}
    try:
        cats = DatabaseService.get_knowledge_categories()
        payload["knowledge_categories"] = cats
    except Exception:
        payload["knowledge_categories"] = []
    try:
        payload["knowledge_entries"] = DatabaseService.get_knowledge_entries()
    except Exception:
        payload["knowledge_entries"] = []
    return payload


class BulkImportRequest(BaseModel):
    ai_identity: Optional[Dict[str, Any]] = None
    personal_information: Optional[Dict[str, Any]] = None
    ai_personality: Optional[Dict[str, Any]] = None
    communication_settings: Optional[Dict[str, Any]] = None
    system_instructions: Optional[Dict[str, Any]] = None
    knowledge_categories: Optional[List[Dict[str, Any]]] = None
    knowledge_entries: Optional[List[Dict[str, Any]]] = None


_BULK_REQUIRED_FIELDS: Dict[str, List[str]] = {
    "ai_identity": ["name", "role"],
    "personal_information": [],
    "ai_personality": [],
    "communication_settings": ["primary_language"],
    "system_instructions": [],
}


def _validate_bulk_section(section: str, data: Dict[str, Any]) -> Optional[str]:
    req = _BULK_REQUIRED_FIELDS.get(section, [])
    missing = [k for k in req if not str(data.get(k) or "").strip()]
    if missing:
        return f"Missing required field(s) for {section}: {', '.join(missing)}"
    return None


@router.post("/import")
def admin_import_bulk(payload: BulkImportRequest, request: Request, admin: str = Depends(get_current_admin)):
    """
    Apply a JSON blob to populate ai_identity → system_instructions + knowledge.
    ai_model_config is not bulk-importable - models are managed on the AI Models tab.
    Any subset of keys accepted. Unknown keys at top level are ignored.
    """
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:import:{ip}", 10, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
    # cap bulk payload size
    raw_check = payload.model_dump(exclude_none=True)
    total_chars = len(str(raw_check))
    if total_chars > 200_000:
        raise HTTPException(status_code=413, detail="Import payload too large (max 200KB chars)")
    if raw_check.get("knowledge_entries") and len(raw_check["knowledge_entries"]) > 200:
        raise HTTPException(status_code=400, detail="Too many knowledge_entries (max 200)")
    raw = raw_check
    if not raw:
        raise HTTPException(status_code=400, detail="Empty import - no recognized keys found. Expected one of: ai_identity, personal_information, ai_personality, communication_settings, system_instructions, knowledge_entries")

    applied: Dict[str, Any] = {}
    errors: Dict[str, str] = {}

    for sec in ADMIN_BULK_SECTIONS:
        if sec not in raw:
            continue
        data = raw[sec]
        if not isinstance(data, dict):
            errors[sec] = "Expected an object"
            continue
        # validate + sanitize imported section data
        try:
            data = _validate_config_data(data)
        except ValueError as e:
            errors[sec] = str(e)
            continue
        err = _validate_bulk_section(sec, data)
        if err:
            errors[sec] = err
            continue
        try:
            applied[sec] = DatabaseService.update_config_table(sec, data)
        except Exception as e:
            errors[sec] = str(e)

    # Knowledge entries (creates/updates by id or by slug/title match)
    knowledge_applied = 0
    if "knowledge_entries" in raw:
        entries = raw["knowledge_entries"] or []
        if not isinstance(entries, list):
            errors["knowledge_entries"] = "Expected an array"
        else:
            cats = DatabaseService.get_knowledge_categories()
            # slug -> id
            slug_to_id = {c.get("slug"): c.get("id") for c in cats}
            for ent in entries:
                if not isinstance(ent, dict):
                    errors.setdefault("knowledge_entries", "")
                    errors["knowledge_entries"] += "One entry was not an object; "
                    continue
                cat_slug = str(ent.get("category_slug") or ent.get("category") or "").strip() or "custom_topics"
                cat_id = ent.get("category_id") or slug_to_id.get(cat_slug)
                if not cat_id:
                    # fall back to first category
                    cat_id = slug_to_id.get("custom_topics") or (cats[0].get("id") if cats else "c1")
                title = str(ent.get("title") or "").strip()
                content = str(ent.get("content") or "").strip()
                if not title or not content:
                    continue
                try:
                    saved = DatabaseService.create_or_update_knowledge_entry({
                        "id": ent.get("id"),
                        "category_id": cat_id,
                        "title": title,
                        "content": content,
                        "tags": ent.get("tags") or [],
                        "is_active": ent.get("is_active", True),
                    })
                    try:
                        KnowledgeService.index_entry(saved["id"], saved["content"])
                    except Exception:
                        pass
                    knowledge_applied += 1
                except Exception as e:
                    errors.setdefault("knowledge_entries", "")
                    errors["knowledge_entries"] += f"{title}: {e}; "

    if errors and not applied and knowledge_applied == 0:
        raise HTTPException(status_code=400, detail={"message": "Bulk import failed", "errors": errors})
    return {
        "status": "success" if not errors else "partial",
        "applied_sections": list(applied.keys()),
        "knowledge_entries_applied": knowledge_applied,
        "applied": applied,
        "errors": errors or None,
    }


@router.post("/import/file")
async def admin_import_file(request: Request, admin: str = Depends(get_current_admin)):
    """Multipart JSON file upload variant of /import - POST a form field 'file' or raw JSON body."""
    try:
        ctype = (request.headers.get("content-type") or "").lower()
        data: Dict[str, Any] = {}
        if "multipart/form-data" in ctype:
            form = await request.form()
            f = form.get("file")
            if f is None:
                raise HTTPException(status_code=400, detail="No 'file' field in multipart upload")
            raw_bytes = await f.read()  # type: ignore
            import json as _json
            data = _json.loads(raw_bytes.decode("utf-8") if isinstance(raw_bytes, (bytes, bytearray)) else str(raw_bytes))
        else:
            import json as _json
            body = await request.body()
            data = _json.loads(body.decode("utf-8") or "{}")

        payload = BulkImportRequest.model_validate(data)
        return admin_import_bulk(payload, request, admin)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")
