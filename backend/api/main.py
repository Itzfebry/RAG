import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.api.admin import router as admin_router
    from backend.api.chat import router as chat_router, v1_router
    from backend.config.config import settings
except ImportError:
    from api.admin import router as admin_router
    from api.chat import router as chat_router, v1_router
    from config.config import settings

app = FastAPI(
    title="ITZ AI Backend API",
    description="Python API for ITZ AI Agent — LangChain, Vector Knowledge, and Admin Controls",
    version="1.0.0"
)

# CORS Middleware setup
# NOTE: allow_origins=["*"] + allow_credentials=True is invalid in browsers.
# Next.js rewrites forward cookies same-origin, so credentials not needed here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https://itzfebry\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(v1_router)
app.include_router(admin_router)

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
