import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

try:
    from backend.api.admin import router as admin_router
    from backend.api.chat import router as chat_router, v1_router
    from backend.api.users import router as user_router, admin_router as admin_users_router
    from backend.api.auth import router as auth_router
    from backend.api.pricing import router as pricing_router, admin_router as admin_pricing_router, payment_router
    from backend.config.config import settings
    from backend.security.middleware import SecurityHeadersMiddleware, BodySizeLimitMiddleware
except ImportError:
    from api.admin import router as admin_router
    from api.chat import router as chat_router, v1_router
    from api.users import router as user_router, admin_router as admin_users_router  # type: ignore
    from api.auth import router as auth_router  # type: ignore
    from api.pricing import router as pricing_router, admin_router as admin_pricing_router, payment_router  # type: ignore
    from config.config import settings  # type: ignore
    from security.middleware import SecurityHeadersMiddleware, BodySizeLimitMiddleware  # type: ignore

app = FastAPI(
    title="ITZ AI Backend API",
    description="Python API for ITZ AI Agent - LangChain, Vector Knowledge, and Admin Controls",
    version="1.0.0",
    docs_url="/docs" if os.getenv("NODE_ENV") != "production" else None,
    redoc_url=None if os.getenv("NODE_ENV") == "production" else "/redoc",
    openapi_url="/openapi.json" if os.getenv("NODE_ENV") != "production" else None,
)

# Security headers + body limit (order: outermost first)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware)


_FIELD_LABELS = {
    "plans": "daftar paket",
    "payment_qris": "gambar/isi QRIS",
    "payment_instructions": "instruksi pembayaran",
    "contact": "kontak admin",
    "order_note": "catatan halaman harga",
}


def _friendly_validation_error(exc: RequestValidationError) -> str:
    """Rangkum error validasi jadi pesan yang menyebut field + alasan, tanpa
    membocorkan struktur schema Pydantic (loc/type/ctx/input) ke client."""
    errs = exc.errors()
    if not errs:
        return "Format data tidak valid - periksa field yang dikirim."
    parts = []
    for e in errs[:4]:
        loc = e.get("loc") or []
        field = next((str(x) for x in reversed(loc) if isinstance(x, str) and x not in ("body", "query", "path")), "")
        label = _FIELD_LABELS.get(field, field or "data")
        typ = e.get("type", "")
        ctx = e.get("ctx") or {}
        if typ == "string_too_long":
            parts.append(f"{label}: terlalu panjang (maks {ctx.get('max_length')} karakter)")
        elif typ == "too_long":
            parts.append(f"{label}: terlalu banyak item (maks {ctx.get('max_length')})")
        elif typ in ("missing",):
            parts.append(f"{label}: wajib diisi")
        elif typ in ("int_parsing", "int_type", "float_parsing"):
            parts.append(f"{label}: harus berupa angka")
        elif typ in ("string_type", "str_type"):
            parts.append(f"{label}: harus berupa teks")
        else:
            msg = str(e.get("msg") or typ or "tidak valid")
            parts.append(f"{label}: {msg}")
    return "Tidak bisa disimpan - " + "; ".join(parts) + "."


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Balas 422 dengan pesan yang berguna bagi admin/user, tanpa membocorkan
    struktur schema Pydantic (loc/ctx/input) ke client. Detail tetap di-log."""
    print(f"[validation] {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": _friendly_validation_error(exc)},
    )

# CORS - explicit, no wildcard when credentials involved. Rewrites are same-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"https://itzfebry\.vercel\.app") or None,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    max_age=600,
)

app.include_router(chat_router)
app.include_router(v1_router)
app.include_router(v1_router, prefix="/api")  # alias: /api/v1/* so the OpenAI-compatible
# endpoint stays reachable on Vercel, where only /api/* routes hit the Python function
app.include_router(user_router)
app.include_router(admin_router)
app.include_router(admin_users_router)
app.include_router(pricing_router)
app.include_router(admin_pricing_router)
app.include_router(payment_router)
app.include_router(auth_router)

@app.get("/")
def root():
    return {
        "app": "ITZ AI",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs"
    }

@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/cron/warmup")
def cron_warmup(request: Request):
    """Vercel cron target (daily): keep the HF embedding model warm.

    Free-tier HF Inference API unloads idle models; a tiny daily embed call
    avoids cold-start latency on the first real user query.
    Dilindungi CRON_SECRET (Vercel mengirim Authorization: Bearer <CRON_SECRET>).
    """
    secret = os.getenv("CRON_SECRET", "").strip()
    if not secret or request.headers.get("authorization", "") != f"Bearer {secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        from backend.knowledge.knowledge_service import KnowledgeService
        from backend.database.db import DatabaseService
    except ImportError:
        from knowledge.knowledge_service import KnowledgeService
        from database.db import DatabaseService  # type: ignore
    vec = KnowledgeService.get_embedding("warmup")
    is_dummy = not vec or all(x == 0.0 for x in vec[:20])
    # bersihkan baris rate limit yang sudah kedaluwarsa (sekali sehari)
    try:
        DatabaseService.prune_rate_limits()
    except Exception:
        pass
    return {"status": "ok" if not is_dummy else "embedding-fallback"}

if __name__ == "__main__":
    import uvicorn
    # UVICORN_RELOAD=0 kalau ingin server stabil (tanpa auto-reload - cocok
    # saat sedang dipakai chat; reload bikin server mati beberapa detik)
    _reload = os.getenv("UVICORN_RELOAD", "1") == "1"
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=settings.PORT, reload=_reload)
