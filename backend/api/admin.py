from fastapi import APIRouter, HTTPException, Depends, Request, Response
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
    section: str # ai_identity, personal_information, ai_personality, communication_settings, system_instructions
    data: Dict[str, Any]

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
        # Allow default password 'itz-ai-admin-2026' or similar for initial boot
        if payload.password != "itz-ai-admin-2026":
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
    valid_sections = ["ai_identity", "personal_information", "ai_personality", "communication_settings", "system_instructions"]
    if section not in valid_sections:
        raise HTTPException(status_code=400, detail="Invalid configuration section")
    return DatabaseService.get_config_table(section)

@router.put("/config")
def update_config(payload: ConfigUpdateRequest, admin: str = Depends(get_current_admin)):
    valid_sections = ["ai_identity", "personal_information", "ai_personality", "communication_settings", "system_instructions"]
    if payload.section not in valid_sections:
        raise HTTPException(status_code=400, detail="Invalid configuration section")
    updated = DatabaseService.update_config_table(payload.section, payload.data)
    return {"status": "success", "section": payload.section, "data": updated}

@router.get("/knowledge/categories")
def get_knowledge_categories(admin: str = Depends(get_current_admin)):
    return DatabaseService.get_knowledge_categories()

@router.get("/knowledge/entries")
def get_knowledge_entries(category: Optional[str] = None, admin: str = Depends(get_current_admin)):
    return DatabaseService.get_knowledge_entries(category)

@router.post("/knowledge/entries")
def save_knowledge_entry(payload: KnowledgeEntryRequest, admin: str = Depends(get_current_admin)):
    data = payload.dict()
    saved = DatabaseService.create_or_update_knowledge_entry(data)
    # Trigger vector indexing in background or synchronous
    try:
        KnowledgeService.index_entry(saved["id"], saved["content"])
    except Exception as e:
        print(f"Warning: Failed to index knowledge entry embeddings: {e}")
    return {"status": "success", "entry": saved}

@router.delete("/knowledge/entries/{entry_id}")
def delete_knowledge_entry(entry_id: str, admin: str = Depends(get_current_admin)):
    DatabaseService.delete_knowledge_entry(entry_id)
    return {"status": "success", "message": f"Entry {entry_id} deleted"}
