from fastapi import APIRouter, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import os

try:
    from backend.agent.agent import AgentOrchestrator, _resolve_base_url, _resolve_api_key, _resolve_default_model
    from backend.database.db import DatabaseService
except ImportError:
    from agent.agent import AgentOrchestrator, _resolve_base_url, _resolve_api_key, _resolve_default_model # type: ignore
    from database.db import DatabaseService

router = APIRouter(prefix="/api", tags=["Chat"])
v1_router = APIRouter(prefix="/v1", tags=["OpenAI Compatible"])
agent_orchestrator = AgentOrchestrator()

def _sanitize_model_list(models: List[str], active: str) -> List[str]:
    out: List[str] = []
    for m in models:
        m = str(m).strip()
        if m and m not in out:
            out.append(m)
    if active and active not in out:
        out.insert(0, active)
    return out


@v1_router.get("/models")
def list_models():
    model_config = {}
    try:
        model_config = DatabaseService.get_config_table("ai_model_config")
    except Exception:
        pass

    active_model = (model_config.get("active_model") or "").strip() or _resolve_default_model()
    fallback_models = [str(m).strip() for m in (model_config.get("fallback_models") or []) if str(m).strip()]
    provider = (model_config.get("provider") or "").strip() or "openrouter"
    base_url = (model_config.get("api_base_url") or "").strip() or _resolve_base_url()
    model_ids = _sanitize_model_list(fallback_models, active_model)

    return {
        "object": "list",
        "data": [{"id": mid, "object": "model", "owned_by": provider, "active": mid == active_model} for mid in model_ids],
        "meta": {"active_model": active_model, "provider": provider, "api_base_url": base_url},
    }


@v1_router.get("/models/available")
def list_available_models(limit: int = Query(default=100, ge=1, le=200), include_free_only: bool = Query(default=False)):
    """
    Live discovery against the configured provider's /models endpoint.
    Sans hardcode. Returns whatever the provider lists — different providers,
    different IDs. Frontend filters + search client-side.
    """
    api_key = _resolve_api_key()
    base_url = (_resolve_base_url() or "https://openrouter.ai/api/v1").strip().rstrip("/")

    if not api_key or "/api/" not in base_url or not (base_url.startswith("http://") or base_url.startswith("https://")):
        return list_models()

    def _try_urls(urls: list) -> Optional[list]:
        import urllib.request, ssl
        for u in urls:
            try:
                req = urllib.request.Request(u, headers={"Authorization": f"Bearer {api_key}"})
                ctx = ssl._create_unverified_context()
                with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                    if getattr(resp, "status", 200) != 200:
                        continue
                    payload = json.loads(resp.read().decode() or "{}")
                    items = payload.get("data")
                    if isinstance(items, list):
                        return items
            except Exception:
                continue
        return None

    # OpenRouter-compatible: <origin>/api/v1/models. Also try OpenAI-style <base>/models.
    origin = base_url.split("/api/")[0]
    candidates = [origin + "/api/v1/models"] if base_url != origin + "/api/v1/models" else [base_url + "/models" if False else base_url.replace("/api/v1", "/api/v1/models") if "/models" not in base_url else base_url]
    if "/api/v1/models" not in candidates[0]:
        candidates.insert(0, origin + "/api/v1/models")
    candidates.append(base_url + "/models" if not base_url.endswith("/models") else base_url)
    candidates = list(dict.fromkeys(candidates))

    try:
        items = _try_urls(candidates)
        if items is None:
            return {"object": "list", "data": [], "error": "Provider /models discovery failed", "fallback": list_models()}
        if include_free_only:
            items = [it for it in items if isinstance(it, dict) and (":free" in str(it.get("id", "")) or str(it.get("pricing", {}).get("prompt", "x") if isinstance(it.get("pricing"), dict) else "") == "0")]
        items = items[:limit]
        return {
            "object": "list",
            "data": [
                {
                    "id": it.get("id"),
                    "name": it.get("name") or it.get("id"),
                    "context_length": it.get("context_length"),
                    "pricing": it.get("pricing"),
                    "description": (it.get("description") or "")[:240],
                    "object": "model",
                }
                for it in items if isinstance(it, dict) and it.get("id")
            ],
        }
    except Exception as e:
        return {"object": "list", "data": [], "error": str(e), "fallback": list_models()}

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    model: Optional[str] = None

@router.post("/chat")
async def stream_chat(payload: ChatRequest):
    """
    Streams ITZ AI response using Server-Sent Events (SSE).
    Response format: text/event-stream
    Each chunk is: data: {"content": "token"}
    Terminal chunk: data: [DONE]
    """
    history_dicts = [m.dict() for m in payload.history] if payload.history else []

    async def generate():
        async for chunk in agent_orchestrator.stream_chat_response(payload.message, history_dicts, model_override=payload.model):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "ITZ AI Python Backend"}
