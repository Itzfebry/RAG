import os
from pydantic_settings import BaseSettings
from pathlib import Path

# Load .env file manually (ensure it's found regardless of working directory)
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

class Settings(BaseSettings):
    # Primary keys — generic, provider-agnostic. OPENROUTER_* is canonical.
    # GEMINI_* kept as legacy alias so old .env files keep working.
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "") or os.getenv("ACTIVE_MODEL", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "") or "llama-3.1-8b-instant"

    # Generic active model + base URL. Any OpenAI-compatible provider works.
    ACTIVE_MODEL: str = os.getenv("ACTIVE_MODEL", "") or os.getenv("GROQ_MODEL", "") or os.getenv("GEMINI_MODEL", "") or "llama-3.1-8b-instant"
    API_BASE_URL: str = os.getenv("API_BASE_URL", "") or os.getenv("OPENROUTER_BASE_URL", "") or "https://api.groq.com/openai/v1"
    MODEL_PROVIDER: str = os.getenv("MODEL_PROVIDER", "groq")
    NVIDIA_MODEL: str = os.getenv("NVIDIA_MODEL", "") or "poolside/laguna-xs-2.1"
    
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
