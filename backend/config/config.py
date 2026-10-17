import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

# Load .env file manually (ensure it's found regardless of working directory)
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent.parent / ".env"
if not os.getenv("VERCEL"):
    # Lokal saja. Di Vercel, nilai env datang dari dashboard Environment
    # Variables; file .env tidak boleh dibaca/menimpanya (override=True dulu
    # menyebabkan nilai localhost dari .env lokal menimpa GOOGLE_REDIRECT_URI
    # produksi -> redirect_uri_mismatch).
    load_dotenv(env_path)

class Settings(BaseSettings):
    # Primary keys - generic, provider-agnostic. OPENROUTER_* is canonical.
    # GEMINI_* kept as legacy alias so old .env files keep working.
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "") or os.getenv("ACTIVE_MODEL", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "")

    # Generic active model + base URL. Any OpenAI-compatible provider works.
    ACTIVE_MODEL: str = os.getenv("ACTIVE_MODEL", "") or os.getenv("GROQ_MODEL", "") or os.getenv("GEMINI_MODEL", "")
    API_BASE_URL: str = os.getenv("API_BASE_URL", "") or os.getenv("OPENROUTER_BASE_URL", "") or "https://openrouter.ai/api/v1"
    MODEL_PROVIDER: str = os.getenv("MODEL_PROVIDER", "openrouter")
    NVIDIA_MODEL: str = os.getenv("NVIDIA_MODEL", "")
    
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD_HASH: str = os.getenv("ADMIN_PASSWORD_HASH", "")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")

    def model_post_init(self, __context):
        # Fail fast di semua environment: JWT kosong/default/pendek = token bisa dipalsukan
        rejected = {"super-secret-jwt-key-itz-ai-2026", "generate_new_secret_key_here", ""}
        if self.JWT_SECRET_KEY.strip() in rejected or len(self.JWT_SECRET_KEY) < 32:
            raise ValueError(
                "JWT_SECRET_KEY wajib diisi dengan string acak minimal 32 karakter di .env "
                "(python -c \"import secrets; print(secrets.token_urlsafe(48))\")"
            )
        if not self.ADMIN_PASSWORD_HASH.startswith("$2"):
            raise ValueError(
                "ADMIN_PASSWORD_HASH wajib diisi (bcrypt hash) di .env - tidak ada default password"
            )
    
    PORT: int = int(os.getenv("PORT", 8000))
    NODE_ENV: str = os.getenv("NODE_ENV", "development")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
