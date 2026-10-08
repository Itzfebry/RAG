import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
