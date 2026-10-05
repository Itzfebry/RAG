from fastapi import APIRouter, HTTPException, Depends, Request, Response, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

try:
    from backend.database.db import DatabaseService
    from backend.knowledge.knowledge_service import KnowledgeService
    from backend.security.auth import verify_password, create_jwt, verify_jwt, COOKIE_NAME, settings
except ImportError:
    from database.db import DatabaseService
    from knowledge.knowledge_service import KnowledgeService
    from security.auth import verify_password, create_jwt, verify_jwt, COOKIE_NAME, settings

router = APIRouter(prefix="/api/admin", tags=["Admin"])

class LoginRequest(BaseModel):
    username: str
    password: str

class ConfigUpdateRequest(BaseModel):
    section: str # ai_identity, personal_information, ai_personality, communication_settings, system_instructions, ai_model_config
    data: Dict[str, Any]


class ModelConfigUpdateRequest(BaseModel):
    """Validated model switch — accepts ANY model ID string, any OpenAI-compatible provider."""
    active_model: str
    fallback_models: Optional[List[str]] = None
    provider: Optional[str] = None
    api_base_url: Optional[str] = None
    temperature: Optional[float] = None
    reasoning_enabled: Optional[bool] = None

class KnowledgeEntryRequest(BaseModel):
    id: Optional[str] = None
    category_id: str
    title: str
    content: str
    tags: Optional[List[str]] = []
    is_active: Optional[bool] = True

def get_current_admin(request: Request) -> str:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        # Also check Authorization header Bearer token
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized: No token provided")
    
    payload = verify_jwt(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid token")
    
    return payload.get("sub", "admin")

@router.post("/login")
def admin_login(payload: LoginRequest, response: Response):
    if payload.username != settings.ADMIN_USERNAME:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Verify password against hash
    if not verify_password(payload.password, settings.ADMIN_PASSWORD_HASH):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_jwt(payload.username)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="lax",
        max_age=12 * 3600
    )
    return {"status": "success", "message": "Admin authenticated successfully"}

@router.post("/logout")
def admin_logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/verify")
def verify_admin_session(admin: str = Depends(get_current_admin)):
    return {"status": "authenticated", "admin": admin}

@router.get("/config/{section}")
def get_config(section: str, admin: str = Depends(get_current_admin)):
    valid_sections = ["ai_identity", "personal_information", "ai_personality", "communication_settings", "system_instructions", "ai_model_config"]
    if section not in valid_sections:
        raise HTTPException(status_code=400, detail="Invalid configuration section")
    return DatabaseService.get_config_table(section)

@router.put("/config")
def update_config(payload: ConfigUpdateRequest, admin: str = Depends(get_current_admin)):
    valid_sections = ["ai_identity", "personal_information", "ai_personality", "communication_settings", "system_instructions", "ai_model_config"]
    if payload.section not in valid_sections:
        raise HTTPException(status_code=400, detail="Invalid configuration section")
    # When saving ai_model_config, enforce no hardcoded validation — any model string allowed.
    # Normalize strings so upstream model loop can't break on whitespace.
    if payload.section == "ai_model_config" and isinstance(payload.data, dict):
        if "active_model" in payload.data and isinstance(payload.data["active_model"], str):
            payload.data["active_model"] = payload.data["active_model"].strip()
        if "api_base_url" in payload.data and isinstance(payload.data["api_base_url"], str):
            payload.data["api_base_url"] = payload.data["api_base_url"].strip().rstrip("/")
        if "fallback_models" in payload.data and isinstance(payload.data["fallback_models"], list):
            payload.data["fallback_models"] = [str(m).strip() for m in payload.data["fallback_models"] if str(m).strip()]
    updated = DatabaseService.update_config_table(payload.section, payload.data)
    return {"status": "success", "section": payload.section, "data": updated}


@router.get("/models")
def admin_list_models(
    include_free_only: bool = False,
    limit: int = 60,
    admin: str = Depends(get_current_admin),
):
    """Return current model config + live catalog for the admin picker (no hardcoding)."""
    try:
        from backend.agent.agent import _resolve_base_url, _resolve_default_model
    except ImportError:
        from agent.agent import _resolve_base_url, _resolve_default_model  # type: ignore
    try:
        from backend.api.chat import list_available_models  # type: ignore
    except ImportError:
        from api.chat import list_available_models  # type: ignore

    cfg = DatabaseService.get_config_table("ai_model_config")
    active = (cfg.get("active_model") or "").strip() or _resolve_default_model()
    fallbacks = [str(m).strip() for m in (cfg.get("fallback_models") or []) if str(m).strip()]
    provider = (cfg.get("provider") or "").strip() or "openrouter"
    base_url = (cfg.get("api_base_url") or "").strip() or _resolve_base_url()
    # Include a live preview (first page) so admin sees real provider models
    live: Dict[str, Any] = {}
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
        },
        "live_catalog": live,
    }


@router.put("/models")
def admin_update_models(payload: ModelConfigUpdateRequest, admin: str = Depends(get_current_admin)):
    """Switch active model + fallbacks. Any model ID accepted — no whitelist, no Gemini hardcoding."""
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
    }
    # clamp temperature to valid range
    if updated_cfg["temperature"] < 0:
        updated_cfg["temperature"] = 0
    if updated_cfg["temperature"] > 2:
        updated_cfg["temperature"] = 2

    saved = DatabaseService.update_config_table("ai_model_config", updated_cfg)
    return {"status": "success", "data": saved}

@router.get("/knowledge/categories")
def get_knowledge_categories(admin: str = Depends(get_current_admin)):
    return DatabaseService.get_knowledge_categories()

@router.get("/knowledge/entries")
def get_knowledge_entries(category: Optional[str] = None, admin: str = Depends(get_current_admin)):
    return DatabaseService.get_knowledge_entries(category)

@router.post("/knowledge/entries")
def save_knowledge_entry(payload: KnowledgeEntryRequest, background_tasks: BackgroundTasks, admin: str = Depends(get_current_admin)):
    data = payload.model_dump()
    saved = DatabaseService.create_or_update_knowledge_entry(data)
    # Trigger vector indexing in background (non-blocking)
    background_tasks.add_task(KnowledgeService.index_entry, saved["id"], saved["content"])
    return {"status": "success", "entry": saved}

@router.delete("/knowledge/entries/{entry_id}")
def delete_knowledge_entry(entry_id: str, admin: str = Depends(get_current_admin)):
    DatabaseService.delete_knowledge_entry(entry_id)
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
def admin_import_bulk(payload: BulkImportRequest, admin: str = Depends(get_current_admin)):
    """
    Apply a JSON blob to populate ai_identity → system_instructions + knowledge.
    ai_model_config is not bulk-importable — models are managed on the AI Models tab.
    Any subset of keys accepted. Unknown keys at top level are ignored.
    """
    raw = payload.model_dump(exclude_none=True)
    if not raw:
        raise HTTPException(status_code=400, detail="Empty import — no recognized keys found. Expected one of: ai_identity, personal_information, ai_personality, communication_settings, system_instructions, knowledge_entries")

    applied: Dict[str, Any] = {}
    errors: Dict[str, str] = {}

    for sec in ADMIN_BULK_SECTIONS:
        if sec not in raw:
            continue
        data = raw[sec]
        if not isinstance(data, dict):
            errors[sec] = "Expected an object"
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
    """Multipart JSON file upload variant of /import — POST a form field 'file' or raw JSON body."""
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
        return admin_import_bulk(payload, admin)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")
