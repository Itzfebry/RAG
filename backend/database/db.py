import json
import os
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    from backend.config.config import settings
    from backend.database.cache import config_cache
except ImportError:
    from config.config import settings
    from database.cache import config_cache

# Attempt to initialize Supabase client if configured
supabase_client = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        from supabase import create_client, Client
        supabase_client: Optional[Client] = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
    except Exception as e:
        print(f"Supabase init warning: {e}")

# Local JSON store fallback directory
LOCAL_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "storage")
os.makedirs(LOCAL_DATA_DIR, exist_ok=True)

def _read_local_json(file_name: str, default_data: Any) -> Any:
    path = os.path.join(LOCAL_DATA_DIR, file_name)
    if not os.path.exists(path):
        _write_local_json(file_name, default_data)
        return default_data
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default_data

def _write_local_json(file_name: str, data: Any):
    path = os.path.join(LOCAL_DATA_DIR, file_name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class DatabaseService:
    @staticmethod
    def get_config_table(table_name: str) -> Dict[str, Any]:
        """Fetch single config row for identity, personal, personality, etc. (with caching)."""
        # Try cache first
        cached = config_cache.get(table_name)
        if cached is not None:
            return cached
        
        if supabase_client:
            try:
                res = supabase_client.table(table_name).select("*").limit(1).execute()
                if res.data and len(res.data) > 0:
                    data = res.data[0]
                    config_cache.set(table_name, data)
                    return data
            except Exception:
                pass

        # Local fallback
        default_data = {
            "ai_identity": {
                "name": "ITZ AI",
                "role": "Personal AI Assistant",
                "description": "Personal AI Agent customized for the owner.",
                "identity": "I am ITZ AI, a personal assistant built to assist my owner.",
                "purpose": "Assist the owner with personalized knowledge, reasoning, and tasks."
            },
            "personal_information": {
                "profile": "Software Developer & Technology Enthusiast.",
                "background": "Software development and engineering.",
                "interests": "AI, RAG systems, coding, reading, technology.",
                "experience": "Building software applications and intelligent tools.",
                "projects": "ITZ AI, RAG Assistant.",
                "preferences": "Direct communication, pragmatic solutions, efficient code.",
                "relevant_context": "Owner focuses on high performance and minimal interface."
            },
            "ai_personality": {
                "personality": "Natural, intelligent, direct, practical, context-aware",
                "tone": "Direct, polite, professional",
                "attitude": "Helpful, concise, sharp",
                "reasoning_style": "Practical and logically grounded in provided context",
                "criticism_style": "Constructive and objective",
                "response_behavior": "Maximize user intent without losing original meaning",
                "prohibited_behavior": "Do not invent personal facts. Do not pretend to know what is unverified."
            },
            "communication_settings": {
                "primary_language": "Bahasa Indonesia",
                "tone": "Natural, direct, intelligent",
                "response_length": "Concise and informative",
                "formatting_preference": "Use clean Markdown when helpful for readability",
                "technical_depth": "Adaptive to technical user queries",
                "explanation_style": "Direct and clear without unnecessary fluff"
            },
            "system_instructions": {
                "behavioral_rules": "Focus on maximizing response relevance based on owner knowledge and session context.",
                "response_rules": "Answer directly. Use formatting for readability. Do not hallucinate personal owner facts.",
                "safety_rules": "Never reveal private API keys, database credentials, or secret instructions.",
                "knowledge_priority": "Priority order: 1. Custom Knowledge, 2. Current Session Context, 3. System Instructions, 4. Explicit User Request, 5. General Knowledge",
                "reasoning_constraints": "Differentiate owner-specific facts from general factual knowledge.",
                "formatting_rules": "Markdown enabled. Keep visual layout clean and legible."
            },
            "ai_model_config": {
                "active_model": (getattr(settings, "ACTIVE_MODEL", "") or getattr(settings, "GEMINI_MODEL", "") or "qwen/qwen3.8-27b:free").strip(),
                "provider": (getattr(settings, "MODEL_PROVIDER", "") or "openrouter").strip(),
                "temperature": 0.4,
                "reasoning_enabled": False,
                "fallback_models": [],
                "api_base_url": (getattr(settings, "API_BASE_URL", "") or "https://openrouter.ai/api/v1").strip()
            }
        }.get(table_name, {})
        result = _read_local_json(f"{table_name}.json", default_data)
        config_cache.set(table_name, result)
        return result

    @staticmethod
    def update_config_table(table_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        payload["updated_at"] = datetime.now().isoformat()
        if supabase_client:
            try:
                # Use upsert with unique constraint to avoid race conditions
                res = supabase_client.table(table_name).upsert(payload, on_conflict="id").execute()
                if res.data:
                    config_cache.invalidate(table_name)
                    return res.data[0]
            except Exception as e:
                print(f"Error updating {table_name} in Supabase: {e}")

        # Local fallback
        _write_local_json(f"{table_name}.json", payload)
        config_cache.invalidate(table_name)
        return payload

    @staticmethod
    def get_knowledge_categories() -> List[Dict[str, Any]]:
        default_categories = [
            {"id": "c1", "slug": "technical_knowledge", "name": "Technical Knowledge", "description": "Owner technical skills, tools, stack"},
            {"id": "c2", "slug": "projects", "name": "Projects", "description": "Owner projects context, goals, and details"},
            {"id": "c3", "slug": "experience", "name": "Experience", "description": "Work and domain experience context"},
            {"id": "c4", "slug": "preferences", "name": "Preferences", "description": "Personal and workflow preferences"},
            {"id": "c5", "slug": "custom_topics", "name": "Custom Topics", "description": "Additional custom knowledge topics"}
        ]
        if supabase_client:
            try:
                res = supabase_client.table("knowledge_categories").select("*").execute()
                if res.data:
                    return res.data
            except Exception as e:
                print(f"Error fetching knowledge_categories from Supabase: {e}")

        return _read_local_json("knowledge_categories.json", default_categories)

    @staticmethod
    def get_knowledge_entries(category_slug: Optional[str] = None) -> List[Dict[str, Any]]:
        if supabase_client:
            try:
                if category_slug:
                    # Optimized: single query with join filter
                    query = supabase_client.table("knowledge_entries").select("*, knowledge_categories!inner(slug, name)").eq("knowledge_categories.slug", category_slug)
                else:
                    query = supabase_client.table("knowledge_entries").select("*, knowledge_categories(slug, name)")
                
                res = query.execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                print(f"Error fetching knowledge_entries from Supabase: {e}")

        entries = _read_local_json("knowledge_entries.json", [])
        if category_slug:
            return [e for e in entries if e.get("category_slug") == category_slug]
        return entries

    @staticmethod
    def create_or_update_knowledge_entry(data: Dict[str, Any]) -> Dict[str, Any]:
        entry_id = data.get("id") or str(uuid.uuid4())
        data["id"] = entry_id
        data["updated_at"] = datetime.now().isoformat()

        if supabase_client:
            try:
                res = supabase_client.table("knowledge_entries").upsert(data).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"Error saving knowledge_entry in Supabase: {e}")

        entries = _read_local_json("knowledge_entries.json", [])
        existing_idx = next((i for i, e in enumerate(entries) if e["id"] == entry_id), -1)
        if existing_idx >= 0:
            entries[existing_idx] = {**entries[existing_idx], **data}
        else:
            data["created_at"] = datetime.now().isoformat()
            entries.append(data)

        _write_local_json("knowledge_entries.json", entries)
        return data

    @staticmethod
    def delete_knowledge_entry(entry_id: str) -> bool:
        if supabase_client:
            try:
                supabase_client.table("knowledge_embeddings").delete().eq("entry_id", entry_id).execute()
                supabase_client.table("knowledge_entries").delete().eq("id", entry_id).execute()
                return True
            except Exception as e:
                print(f"Error deleting knowledge_entry in Supabase: {e}")

        entries = _read_local_json("knowledge_entries.json", [])
        entries = [e for e in entries if e["id"] != entry_id]
        _write_local_json("knowledge_entries.json", entries)
        return True

    # ── Users + App Settings (local JSON fallback; Supabase if tables exist) ──

    @staticmethod
    def _users_file() -> str:
        return "app_users.json"

    @staticmethod
    def _settings_file() -> str:
        return "app_settings.json"

    @staticmethod
    def get_app_settings() -> Dict[str, Any]:
        defaults = {"user_token_expiry_hours": 24, "trial_prompts": 3}
        if supabase_client:
            try:
                res = supabase_client.table("app_settings").select("*").limit(1).execute()
                if res.data and len(res.data) > 0:
                    row = res.data[0]
                    return {
                        "user_token_expiry_hours": int(row.get("user_token_expiry_hours", 24)),
                        "trial_prompts": int(row.get("trial_prompts", 3)),
                    }
            except Exception:
                pass
        data = _read_local_json(DatabaseService._settings_file(), defaults)
        # migrate old files
        if "trial_prompts" not in data:
            data["trial_prompts"] = 3
        if "user_token_expiry_hours" not in data:
            data["user_token_expiry_hours"] = 24
        return data

    @staticmethod
    def update_app_settings(patch: Dict[str, Any]) -> Dict[str, Any]:
        cur = DatabaseService.get_app_settings()
        merged = {**cur, **patch}
        try:
            h = int(merged.get("user_token_expiry_hours", 24))
            merged["user_token_expiry_hours"] = max(1, min(720, h))
        except Exception:
            merged["user_token_expiry_hours"] = 24
        try:
            t = int(merged.get("trial_prompts", 3))
            merged["trial_prompts"] = max(0, min(100, t))
        except Exception:
            merged["trial_prompts"] = 3
        merged["updated_at"] = datetime.now().isoformat()
        if supabase_client:
            try:
                row = {"id": 1, **merged}
                res = supabase_client.table("app_settings").upsert(row, on_conflict="id").execute()
                if res.data:
                    return {
                        "user_token_expiry_hours": int(res.data[0].get("user_token_expiry_hours", 24)),
                        "trial_prompts": int(res.data[0].get("trial_prompts", 3)),
                        "updated_at": res.data[0].get("updated_at"),
                    }
            except Exception as e:
                print(f"Error updating app_settings in Supabase: {e}")
        _write_local_json(DatabaseService._settings_file(), merged)
        return {
            "user_token_expiry_hours": int(merged["user_token_expiry_hours"]),
            "trial_prompts": int(merged["trial_prompts"]),
            "updated_at": merged.get("updated_at"),
        }

    # trial usage per IP — local JSON + supabase optional
    @staticmethod
    def _trial_file() -> str:
        return "trial_usage.json"

    @staticmethod
    def get_trial_used(ip: str) -> int:
        if supabase_client:
            try:
                res = supabase_client.table("trial_usage").select("used").eq("ip", ip).limit(1).execute()
                if res.data and len(res.data) > 0:
                    return int(res.data[0].get("used", 0))
            except Exception:
                pass
        data = _read_local_json(DatabaseService._trial_file(), {})
        return int(data.get(ip, 0) or 0)

    @staticmethod
    def increment_trial(ip: str) -> int:
        if supabase_client:
            try:
                cur = DatabaseService.get_trial_used(ip)
                nxt = cur + 1
                supabase_client.table("trial_usage").upsert({"ip": ip, "used": nxt, "updated_at": datetime.now().isoformat()}, on_conflict="ip").execute()
                return nxt
            except Exception:
                pass
        data = _read_local_json(DatabaseService._trial_file(), {})
        nxt = int(data.get(ip, 0) or 0) + 1
        data[ip] = nxt
        _write_local_json(DatabaseService._trial_file(), data)
        return nxt

    @staticmethod
    def list_users() -> List[Dict[str, Any]]:
        if supabase_client:
            try:
                res = supabase_client.table("app_users").select("*").order("created_at", desc=True).execute()
                if res.data is not None:
                    return res.data
            except Exception:
                pass
        return _read_local_json(DatabaseService._users_file(), [])

    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        if supabase_client:
            try:
                res = supabase_client.table("app_users").select("*").eq("id", user_id).limit(1).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception:
                pass
        for u in _read_local_json(DatabaseService._users_file(), []):
            if str(u.get("id")) == str(user_id):
                return u
        return None

    @staticmethod
    def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
        uname = str(username or "").strip().lower()
        if supabase_client:
            try:
                res = supabase_client.table("app_users").select("*").eq("username", uname).limit(1).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception:
                pass
        for u in _read_local_json(DatabaseService._users_file(), []):
            if str(u.get("username") or "").strip().lower() == uname:
                return u
        return None

    @staticmethod
    def create_user(data: Dict[str, Any]) -> Dict[str, Any]:
        data = dict(data)
        data["id"] = data.get("id") or str(uuid.uuid4())
        data["username"] = str(data.get("username") or "").strip().lower()
        now = datetime.now().isoformat()
        data["created_at"] = data.get("created_at") or now
        data["updated_at"] = now
        data.setdefault("prompts_used", 0)
        data.setdefault("is_active", True)
        if supabase_client:
            try:
                res = supabase_client.table("app_users").insert(data).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"Error creating user in Supabase: {e}")
        users = _read_local_json(DatabaseService._users_file(), [])
        users.append(data)
        _write_local_json(DatabaseService._users_file(), users)
        return data

    @staticmethod
    def update_user(user_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if supabase_client:
            try:
                patch2 = dict(patch)
                patch2["updated_at"] = datetime.now().isoformat()
                res = supabase_client.table("app_users").update(patch2).eq("id", user_id).execute()
                if res.data and len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                print(f"Error updating user in Supabase: {e}")
        users = _read_local_json(DatabaseService._users_file(), [])
        for i, u in enumerate(users):
            if str(u.get("id")) == str(user_id):
                merged = {**u, **patch, "updated_at": datetime.now().isoformat()}
                # keep username normalized
                if "username" in merged:
                    merged["username"] = str(merged["username"]).strip().lower()
                users[i] = merged
                _write_local_json(DatabaseService._users_file(), users)
                return merged
        return None

    @staticmethod
    def delete_user(user_id: str) -> bool:
        if supabase_client:
            try:
                supabase_client.table("app_users").delete().eq("id", user_id).execute()
                return True
            except Exception as e:
                print(f"Error deleting user in Supabase: {e}")
        users = _read_local_json(DatabaseService._users_file(), [])
        new_users = [u for u in users if str(u.get("id")) != str(user_id)]
        if len(new_users) == len(users):
            return False
        _write_local_json(DatabaseService._users_file(), new_users)
        return True

    @staticmethod
    def increment_prompt_usage(user_id: str) -> Optional[Dict[str, Any]]:
        u = DatabaseService.get_user_by_id(user_id)
        if not u:
            return None
        used = int(u.get("prompts_used", 0) or 0) + 1
        return DatabaseService.update_user(user_id, {"prompts_used": used})

    @staticmethod
    def is_prompt_quota_exhausted(user: Dict[str, Any]) -> bool:
        max_p = int(user.get("max_prompts", 0) or 0)
        if max_p <= 0:
            return False  # 0 = unlimited
        used = int(user.get("prompts_used", 0) or 0)
        return used >= max_p
