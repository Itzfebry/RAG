import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD_HASH: str = os.getenv("ADMIN_PASSWORD_HASH", "$2b$12$EixZaYVK1fsbfVSTZ4xQHu0kU2Q6g.R1iYQfT/w2o8NnZ5Kj0tOqm")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "super-secret-jwt-key-itz-ai-2026")
    
    PORT: int = int(os.getenv("PORT", 8000))
    NODE_ENV: str = os.getenv("NODE_ENV", "development")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
