from fastapi import APIRouter, Request, Query, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional
import json
import os
import re
import random

try:
    from backend.security.rate_limiter import get_client_ip, check_rate_limit
    from backend.security.auth import USER_COOKIE_NAME, verify_user_jwt
    from backend.database.db import DatabaseService
    from backend.knowledge.knowledge_service import KnowledgeService
    from backend.api.admin import get_current_admin
except ImportError:
    from security.rate_limiter import get_client_ip, check_rate_limit  # type: ignore
    from security.auth import USER_COOKIE_NAME, verify_user_jwt  # type: ignore
    from database.db import DatabaseService  # type: ignore
    from knowledge.knowledge_service import KnowledgeService  # type: ignore
    from api.admin import get_current_admin  # type: ignore

try:
    from backend.agent.agent import AgentOrchestrator, _resolve_base_url, _resolve_api_key, _resolve_default_model
    from backend.agent.commands import parse_command, list_commands, list_command_details
except ImportError:
    from agent.agent import AgentOrchestrator, _resolve_base_url, _resolve_api_key, _resolve_default_model # type: ignore
    from agent.commands import parse_command, list_commands, list_command_details # type: ignore

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


def get_current_chat_user_optional(request: Request) -> Optional[Dict]:
    token = request.cookies.get(USER_COOKIE_NAME)
    if not token:
        auth = request.headers.get("Authorization") or ""
        if auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1].strip()
    if not token:
        return None
    payload = verify_user_jwt(token)
    if not payload:
        return None
    username = str(payload.get("sub") or "").strip().lower()
    user = DatabaseService.get_user_by_username(username)
    if not user:
        return None
    if not bool(user.get("is_active", True)):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan - hubungi admin")
    if int(payload.get("sv") or 0) != int(user.get("session_version") or 0):
        return None
    # Enforce verifikasi email: user yang punya email tapi belum terverifikasi
    # tidak boleh chat sampai kode 6 digit dikonfirmasi. User tanpa email
    # (mis. dibuat admin) tidak terpengaruh.
    if str(user.get("email") or "").strip() and not bool(user.get("email_verified", False)):
        raise HTTPException(status_code=403, detail="Verifikasi email dulu sebelum chat - masukkan kode 6 digit yang dikirim ke email Anda")
    if DatabaseService.is_prompt_quota_exhausted(user):
        raise HTTPException(status_code=403, detail="Batas prompt habis - hubungi admin untuk menambah kuota")
    return user


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
    Sans hardcode. Returns whatever the provider lists - different providers,
    different IDs. Frontend filters + search client-side.
    """
    api_key = _resolve_api_key()
    base_url = (_resolve_base_url() or "https://openrouter.ai/api/v1").strip().rstrip("/")

    if not api_key or "/api/" not in base_url or not (base_url.startswith("http://") or base_url.startswith("https://")):
        return list_models()

    def _try_urls(urls: list) -> Optional[list]:
        import urllib.request, ssl
        ctx = ssl.create_default_context()
        for u in urls:
            try:
                req = urllib.request.Request(u, headers={"Authorization": f"Bearer {api_key}"})
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
    role: str = Field(pattern=r"^(user|assistant|system)$")
    content: str = Field(min_length=1, max_length=8000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, v: str) -> str:
        return v.strip()

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    history: Optional[List[ChatMessage]] = Field(default=None, max_length=50)
    model: Optional[str] = Field(default=None, max_length=256)

    @field_validator("message")
    @classmethod
    def strip_message(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("message empty")
        return v

    @field_validator("model")
    @classmethod
    def check_model(cls, v):  # type: ignore
        if v is None:
            return v
        v = v.strip()
        if not re.match(r"^[a-zA-Z0-9._/:-]+$", v):
            raise ValueError("Invalid model ID")
        return v

def _commands_help_text(unknown: Optional[str] = None) -> str:
    lines = []
    if unknown:
        lines.append(f"Command `{unknown}` tidak dikenal. Daftar command yang tersedia:")
    else:
        lines.append("Daftar command yang tersedia:")
    lines.append("")
    for c in list_commands():
        lines.append(f"- `/{c['name']}`: {c['purpose']} Contoh: `{c['example']}`")
    lines.append("")
    lines.append("Gunakan command di awal pesan, misalnya `/explain REST API`. Maksimal 2 command per pesan.")
    lines.append("Dokumentasi lengkap: `/docs`.")
    return "\n".join(lines)


async def _help_stream(text: str):
    yield f"data: {json.dumps({'content': text})}\n\n"
    yield f"data: {json.dumps({'answered': True})}\n\n"
    yield "data: [DONE]\n\n"


@router.get("/commands")
def get_commands():
    return {"commands": list_command_details()}


@router.post("/chat")
async def stream_chat(payload: ChatRequest, request: Request):
    ip = get_client_ip(request)
    command_names, clean_message, unknown_command = parse_command(payload.message)
    if unknown_command or (command_names and not clean_message):
        return StreamingResponse(
            _help_stream(_commands_help_text(unknown_command)),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no", "X-Command-Mode": "static"},
        )
    if command_names:
        payload.message = clean_message
    user = get_current_chat_user_optional(request)
    if user is not None:
        allowed, retry = check_rate_limit(f"chat:{user.get('id')}:{ip}", 30, 60)
        if not allowed:
            raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
        fresh = DatabaseService.get_user_by_id(str(user.get("id")))
        if fresh and DatabaseService.is_prompt_quota_exhausted(fresh):
            raise HTTPException(status_code=403, detail="Batas prompt habis - hubungi admin untuk menambah kuota")
        if fresh and not str(fresh.get("display_name") or "").strip():
            raise HTTPException(status_code=428, detail="Isi nama tampilan di profil sebelum chat")
    else:
        # trial gate - soft setting trial_prompts (0 = trial disabled => require login)
        allowed, retry = check_rate_limit(f"chat:trial:{ip}", 30, 60)
        if not allowed:
            raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})
        s = DatabaseService.get_app_settings()
        limit = max(0, int(s.get("trial_prompts", 3)))
        if limit == 0:
            raise HTTPException(status_code=401, detail="Login diperlukan - hubungi admin untuk akses")
        used = DatabaseService.get_trial_used(ip)
        if used >= limit:
            raise HTTPException(status_code=403, detail="Trial habis - login atau hubungi admin untuk akses")

    budget_stats = DatabaseService.get_token_stats(1)
    if budget_stats.get("budget", 0) > 0 and (budget_stats.get("remaining") or 0) <= 0:
        raise HTTPException(status_code=503, detail="Budget token harian habis - coba lagi besok atau hubungi admin")

    history_dicts = [m.model_dump() for m in payload.history] if payload.history else []
    # Profil user untuk system prompt (nama, tujuan, gaya respons, sapaan chat pertama)
    user_profile = None
    if user is not None:
        prof = DatabaseService.get_user_profile(str(user.get("id")))
        user_profile = {
            "display_name": str(user.get("display_name") or "").strip(),
            "goal": str(prof.get("goal") or "").strip(),
            "style_id": str(prof.get("style_id") or "").strip(),
            "gender": str(prof.get("gender") or "").strip(),
            "first_chat": len(history_dicts) == 0,
        }
    # capture model/resolved latency for analytics - non-blocking
    import time as _t
    t0 = _t.perf_counter()

    usage_owner = str(user.get("id")) if user is not None else f"trial:{ip}"

    async def generate():
        answered = False
        async for chunk in agent_orchestrator.stream_chat_response(payload.message, history_dicts, model_override=payload.model, user_profile=user_profile, command_names=command_names or None):
            # event token usage dari agent -> catat, jangan diteruskan ke client
            if chunk.startswith("data: ") and '"usage"' in chunk:
                try:
                    import json as _json
                    u = _json.loads(chunk[6:].strip()).get("usage") or {}
                    DatabaseService.record_token_usage(
                        usage_owner,
                        int(u.get("prompt_tokens", 0) or 0),
                        int(u.get("completion_tokens", 0) or 0),
                    )
                except Exception:
                    pass
                continue
            # event penanda dari agent: jawaban asli dari provider (bukan fallback error)
            if chunk.startswith("data: ") and '"answered"' in chunk:
                answered = True
                continue
            yield chunk
        # Kuota/trial hanya dipotong jika jawaban asli dari provider sudah terkirim
        if answered:
            try:
                if user is not None:
                    DatabaseService.increment_prompt_usage(str(user.get("id")))
                else:
                    DatabaseService.increment_trial(ip)
            except Exception as e:
                print(f"[quota] gagal mencatat pemakaian: {e}")
        try:
            elapsed = int((_t.perf_counter() - t0) * 1000)
            # best-effort: use override or active config model
            mname = (payload.model or "").strip()
            if not mname:
                try:
                    cfg = DatabaseService.get_config_table("ai_model_config")
                    mname = (cfg.get("active_model") or "").strip() or "unknown"
                except Exception:
                    mname = "unknown"
            DatabaseService.record_request_event(model=mname, latency_ms=elapsed)
        except Exception:
            try:
                DatabaseService.record_request_event()
            except Exception:
                pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

_DEFAULT_SUGGESTIONS = [
    "Ringkas knowledge base saya",
    "Buatkan outline artikel futuristik",
    "Jelaskan RAG dengan contoh sederhana",
    "Apa saja yang kamu tahu tentang saya?",
    "Bantu saya brainstorm ide konten",
    "Review arsitektur proyek saya",
    "Buatkan prompt untuk use case saya",
    "Ringkas poin penting minggu ini",
    "Jelaskan konsep AI agent secara sederhana",
    "Saran cara improve workflow kerja saya",
]


@router.get("/suggestions")
def get_suggestions(limit: int = 3):
    """Chat suggestion untuk empty state. Sumber prioritas:
    1. system_instructions.chat_suggestions - override manual admin
       (field teks, dipisah ";" atau baris baru - bisa diisi via panel admin)
    2. judul knowledge entries aktif - suggestion hidup mengikuti isi KB
    3. pool default
    """
    limit = max(1, min(6, limit))
    # 1) admin override
    try:
        cfg = DatabaseService.get_config_table("system_instructions") or {}
        raw = str(cfg.get("chat_suggestions") or "").strip()
        if raw:
            items = [s.strip() for s in re.split(r"[;\n]", raw) if s.strip()]
            if items:
                random.shuffle(items)
                return {"suggestions": items[:limit], "source": "admin"}
    except Exception:
        pass
    # 2) knowledge entry titles
    try:
        titles = []
        for e in (DatabaseService.get_knowledge_entries() or []):
            if not e.get("is_active", True):
                continue
            t = str(e.get("title") or "").strip()
            if 4 <= len(t) <= 80:
                titles.append(t)
        if titles:
            random.shuffle(titles)
            return {"suggestions": titles[:limit], "source": "knowledge"}
    except Exception:
        pass
    # 3) fallback
    items = list(_DEFAULT_SUGGESTIONS)
    random.shuffle(items)
    return {"suggestions": items[:limit], "source": "default"}


@router.post("/admin/knowledge/upload")
async def upload_knowledge_file(
    file: UploadFile = File(...),
    category_id: str = Query(...),
    request: Request = None,
    admin: str = Depends(get_current_admin),
):
    """Ingest knowledge from PDF/Text files."""
    suffix = os.path.splitext(file.filename)[1].lower()
    if suffix not in [".txt", ".pdf", ".md"]:
        raise HTTPException(status_code=400, detail="Format file tidak didukung (hanya .txt, .pdf, .md)")

    content = ""
    try:
        if suffix == ".pdf":
            # Requires pypdf
            import pypdf
            reader = pypdf.PdfReader(file.file)
            content = "\n".join([page.extract_text() for page in reader.pages])
        else:
            # Text / Markdown
            content = (await file.read()).decode("utf-8")
        
        if not content.strip():
            raise HTTPException(status_code=400, detail="File kosong")

        # Save to DB as new entry
        entry_data = {
            "category_id": category_id,
            "title": file.filename,
            "content": content,
            "is_active": True
        }
        entry = DatabaseService.create_or_update_knowledge_entry(entry_data)
        
        # Trigger indexing
        KnowledgeService.index_entry(entry["id"], content)
        
        return {"status": "success", "entry_id": entry["id"], "chars": len(content)}
    except Exception as e:
        print(f"[upload] gagal memproses file: {e}")
        raise HTTPException(status_code=500, detail="Gagal memproses file. Cek log server.")

