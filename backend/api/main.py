import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

try:
    from backend.api.admin import router as admin_router
    from backend.api.chat import router as chat_router, v1_router
    from backend.api.users import router as user_router, admin_router as admin_users_router
    from backend.config.config import settings
    from backend.security.middleware import SecurityHeadersMiddleware, BodySizeLimitMiddleware
except ImportError:
    from api.admin import router as admin_router
    from api.chat import router as chat_router, v1_router
    from api.users import router as user_router, admin_router as admin_users_router  # type: ignore
    from config.config import settings
    from security.middleware import SecurityHeadersMiddleware, BodySizeLimitMiddleware

app = FastAPI(
    title="ITZ AI Backend API",
    description="Python API for ITZ AI Agent — LangChain, Vector Knowledge, and Admin Controls",
    version="1.0.0",
    docs_url="/docs" if os.getenv("NODE_ENV") != "production" else None,
    redoc_url=None if os.getenv("NODE_ENV") == "production" else "/redoc",
    openapi_url="/openapi.json" if os.getenv("NODE_ENV") != "production" else None,
)

# Security headers + body limit (order: outermost first)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(BodySizeLimitMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Balas 422 dengan pesan bersih — jangan bocorkan struktur schema Pydantic
    (loc/msg/ctx) ke client. Detail tetap di-log ke console untuk debugging."""
    print(f"[validation] {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": "Format data tidak valid — periksa field yang dikirim."},
    )

# CORS — explicit, no wildcard when credentials involved. Rewrites are same-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app",
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

@app.get("/")
def root():
    return {
        "app": "ITZ AI",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/cron/warmup")
def cron_warmup():
    """Vercel cron target (daily): keep the HF embedding model warm.

    Free-tier HF Inference API unloads idle models; a tiny daily embed call
    avoids cold-start latency on the first real user query.
    """
    try:
        from backend.knowledge.knowledge_service import KnowledgeService
    except ImportError:
        from knowledge.knowledge_service import KnowledgeService
    vec = KnowledgeService.get_embedding("warmup")
    is_dummy = not vec or all(x == 0.0 for x in vec[:20])
    return {"status": "ok" if not is_dummy else "embedding-fallback"}

if __name__ == "__main__":
    import uvicorn
    # UVICORN_RELOAD=0 kalau ingin server stabil (tanpa auto-reload — cocok
    # saat sedang dipakai chat; reload bikin server mati beberapa detik)
    _reload = os.getenv("UVICORN_RELOAD", "1") == "1"
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=settings.PORT, reload=_reload)
