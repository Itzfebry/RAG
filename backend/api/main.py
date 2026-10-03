import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.api.admin import router as admin_router
    from backend.api.chat import router as chat_router
    from backend.config.config import settings
except ImportError:
    from api.admin import router as admin_router
    from api.chat import router as chat_router
    from config.config import settings

app = FastAPI(
    title="ITZ AI Backend API",
    description="Python API for ITZ AI Agent — LangChain, Vector Knowledge, and Admin Controls",
    version="1.0.0"
)

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(admin_router)

@app.get("/")
def root():
    return {
        "app": "ITZ AI",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
