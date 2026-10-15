import json
import os
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    from backend.config.config import settings
    from backend.database.cache import config_cache
except ImportError:
    try:
        from config.config import settings
        from database.cache import config_cache
    except ImportError:
        # Final fallback for unusual execution contexts
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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

# Local JSON store fallback directory.
# On Vercel/serverless the root FS is read-only (only /tmp is writable) and
# ephemeral - route writes to /tmp so imports never crash. Config that must
# survive cold starts lives in Supabase; local JSON is best-effort fallback.
_ON_VERCEL = bool(os.getenv("VERCEL"))
if _ON_VERCEL:
    LOCAL_DATA_DIR = "/tmp/data/storage"
else:
    LOCAL_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "storage")
try:
    os.makedirs(LOCAL_DATA_DIR, exist_ok=True)
except OSError as e:
    print(f"Warning: cannot create local data dir {LOCAL_DATA_DIR}: {e}")

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
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError as e:
        # Serverless read-only FS - Supabase remains the source of truth
        print(f"Warning: cannot write local json {path}: {e}")

RAG_SETTING_DEFAULTS: Dict[str, Any] = {
    "rag_match_count_short": 6,
    "rag_match_count_long": 8,
    "rag_match_threshold": None,
}


def _rag_settings_from_row(row: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(RAG_SETTING_DEFAULTS)
    for k in RAG_SETTING_DEFAULTS:
        if row.get(k) is not None:
            out[k] = row[k]
    return _clamp_rag_settings(out)


def _clamp_rag_settings(data: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(data)
    for k in ("rag_match_count_short", "rag_match_count_long"):
        try:
            out[k] = max(1, min(30, int(out.get(k) or RAG_SETTING_DEFAULTS[k])))
        except Exception:
            out[k] = RAG_SETTING_DEFAULTS[k]
    try:
        t = out.get("rag_match_threshold")
        out["rag_match_threshold"] = None if t in (None, "") else max(0.0, min(1.0, float(t)))
    except Exception:
        out["rag_match_threshold"] = None
    return out


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
                "active_model": (getattr(settings, "ACTIVE_MODEL", "") or getattr(settings, "GEMINI_MODEL", "") or "").strip(),
                "provider": (getattr(settings, "MODEL_PROVIDER", "") or "openrouter").strip(),
                "temperature": 0.4,
                "reasoning_enabled": False,
                "max_tokens": 8192,
                "fallback_models": [],
                "api_base_url": (getattr(settings, "API_BASE_URL", "") or "https://openrouter.ai/api/v1").strip()
            },
            "response_styles": {
                "styles": [
                    {
                        "id": "ringkas",
                        "name": "Sangat Ringkas",
                        "description": "Jawaban super singkat langsung ke inti. Bullet rapat, tanpa basa-basi.",
                        "prompt": "Balas singkat dan langsung ke inti, tanpa pembuka atau basa-basi. Tetap pakai format kaya: **bold** untuk poin kunci, numbering untuk langkah, bullet untuk daftar, dan spasi antar bagian. Batasi jumlah poin, bukan format. Tambahkan detail hanya jika user minta."
                    },
                    {
                        "id": "edukatif",
                        "name": "Guru Penjelas",
                        "description": "Penjelasan panjang, sabar, bertahap dengan analogi dan contoh.",
                        "prompt": "Gaya mengajar yang sabar dan detail. Jelaskan konsep dari dasar, gunakan analogi dan contoh nyata, pecah jadi langkah-langkah bernomor, dan ulangi poin penting dengan kalimat berbeda bila perlu. Tidak apa-apa panjang asalkan mudah dipahami pemula."
                    },
                    {
                        "id": "santai",
                        "name": "Santai & Asik",
                        "description": "Ngobrol santai seperti dengan teman, humor ringan, gaya kasual.",
                        "prompt": "Gaya ngobrol santai seperti bicara dengan teman dekat. Gunakan bahasa kasual sehari-hari, boleh humor ringan dan opini personal. Format tetap rapi dengan **bold** untuk poin penting dan spasi antar bagian, tapi hindari heading formal. Sapa dengan akrab."
                    }
                ]
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
                # Upsert needs the row id; without it upsert inserts a DUPLICATE row
                if "id" not in payload:
                    try:
                        existing = supabase_client.table(table_name).select("id").limit(1).execute()
                        if existing.data:
                            payload["id"] = existing.data[0]["id"]
                    except Exception:
                        pass
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
        defaults = {"user_token_expiry_hours": 24, "trial_prompts": 3, **RAG_SETTING_DEFAULTS}
        if supabase_client:
            try:
                res = supabase_client.table("app_settings").select("*").limit(1).execute()
                if res.data and len(res.data) > 0:
                    row = res.data[0]
                    return {
                        "user_token_expiry_hours": int(row.get("user_token_expiry_hours", 24)),
                        "trial_prompts": int(row.get("trial_prompts", 3)),
                        **_rag_settings_from_row(row),
                    }
            except Exception:
                pass
        data = _read_local_json(DatabaseService._settings_file(), defaults)
        # migrate old files
        if "trial_prompts" not in data:
            data["trial_prompts"] = 3
        if "user_token_expiry_hours" not in data:
            data["user_token_expiry_hours"] = 24
        for k, v in RAG_SETTING_DEFAULTS.items():
            data.setdefault(k, v)
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
        merged = _clamp_rag_settings(merged)
        merged["updated_at"] = datetime.now().isoformat()
        if supabase_client:
            try:
                row = {"id": 1, **merged}
                res = supabase_client.table("app_settings").upsert(row, on_conflict="id").execute()
                if res.data:
                    return {
                        "user_token_expiry_hours": int(res.data[0].get("user_token_expiry_hours", 24)),
                        "trial_prompts": int(res.data[0].get("trial_prompts", 3)),
                        **_rag_settings_from_row(res.data[0]),
                        "updated_at": res.data[0].get("updated_at"),
                    }
            except Exception as e:
                print(f"Error updating app_settings in Supabase: {e}")
        _write_local_json(DatabaseService._settings_file(), merged)
        return {
            "user_token_expiry_hours": int(merged["user_token_expiry_hours"]),
            "trial_prompts": int(merged["trial_prompts"]),
            **{k: merged[k] for k in RAG_SETTING_DEFAULTS},
            "updated_at": merged.get("updated_at"),
        }

    # trial usage per IP - local JSON + supabase optional
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
    def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
        mail = str(email or "").strip().lower()
        if not mail:
            return None
        if supabase_client:
            try:
                res = supabase_client.table("app_users").select("*").ilike("email", mail).execute()
                for row in res.data or []:
                    if str(row.get("email") or "").strip().lower() == mail:
                        return row
            except Exception:
                pass
        for u in _read_local_json(DatabaseService._users_file(), []):
            if str(u.get("email") or "").strip().lower() == mail:
                return u
        return None

    # ── Email OTP (verifikasi email & reset kata sandi). Tabel email_otps; fallback JSON lokal. ──
    @staticmethod
    def _otps_file() -> str:
        return "email_otps.json"

    @staticmethod
    def delete_email_otps(email: str, purpose: str) -> None:
        if supabase_client:
            try:
                supabase_client.table("email_otps").delete().eq("email", email).eq("purpose", purpose).execute()
            except Exception as e:
                print(f"Error deleting OTP in Supabase: {e}")
        rows = _read_local_json(DatabaseService._otps_file(), [])
        kept = [r for r in rows if not (r.get("email") == email and r.get("purpose") == purpose)]
        if len(kept) != len(rows):
            _write_local_json(DatabaseService._otps_file(), kept)

    @staticmethod
    def create_email_otp(email: str, purpose: str, code_hash: str, expires_at: str) -> Dict[str, Any]:
        DatabaseService.delete_email_otps(email, purpose)
        row = {
            "id": str(uuid.uuid4()),
            "email": email,
            "purpose": purpose,
            "code_hash": code_hash,
            "attempts": 0,
            "expires_at": expires_at,
            "created_at": datetime.now().isoformat(),
        }
        if supabase_client:
            try:
                res = supabase_client.table("email_otps").insert(row).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"Error creating OTP in Supabase: {e}")
        rows = _read_local_json(DatabaseService._otps_file(), [])
        rows.append(row)
        _write_local_json(DatabaseService._otps_file(), rows)
        return row

    @staticmethod
    def get_latest_email_otp(email: str, purpose: str) -> Optional[Dict[str, Any]]:
        if supabase_client:
            try:
                res = (
                    supabase_client.table("email_otps").select("*")
                    .eq("email", email).eq("purpose", purpose)
                    .order("created_at", desc=True).limit(1).execute()
                )
                if res.data:
                    return res.data[0]
            except Exception:
                pass
        rows = [r for r in _read_local_json(DatabaseService._otps_file(), []) if r.get("email") == email and r.get("purpose") == purpose]
        if not rows:
            return None
        return max(rows, key=lambda r: str(r.get("created_at") or ""))

    @staticmethod
    def update_email_otp_attempts(otp_id: str, attempts: int) -> None:
        if supabase_client:
            try:
                supabase_client.table("email_otps").update({"attempts": attempts}).eq("id", otp_id).execute()
                return
            except Exception as e:
                print(f"Error updating OTP in Supabase: {e}")
        rows = _read_local_json(DatabaseService._otps_file(), [])
        for r in rows:
            if str(r.get("id")) == str(otp_id):
                r["attempts"] = attempts
                _write_local_json(DatabaseService._otps_file(), rows)
                break

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

    # ── User profile (display name override, tujuan, gaya respons) ──
    # Tabel Supabase user_profiles; fallback JSON lokal jika DB tidak bisa diakses.
    @staticmethod
    def _profiles_file() -> str:
        return "user_profiles.json"

    @staticmethod
    def get_user_profile(user_id: str) -> Dict[str, Any]:
        if supabase_client:
            try:
                res = supabase_client.table("user_profiles").select("profile").eq("user_id", str(user_id)).limit(1).execute()
                if res.data:
                    p = res.data[0].get("profile")
                    return p if isinstance(p, dict) else {}
                return {}
            except Exception:
                pass
        data = _read_local_json(DatabaseService._profiles_file(), {})
        p = data.get(str(user_id))
        return p if isinstance(p, dict) else {}

    @staticmethod
    def update_user_profile(user_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        current = DatabaseService.get_user_profile(user_id)
        current.update(patch)
        current["updated_at"] = datetime.now().isoformat()
        if supabase_client:
            try:
                supabase_client.table("user_profiles").upsert(
                    {"user_id": str(user_id), "profile": current, "updated_at": current["updated_at"]},
                    on_conflict="user_id",
                ).execute()
                return current
            except Exception:
                pass
        data = _read_local_json(DatabaseService._profiles_file(), {})
        data[str(user_id)] = current
        _write_local_json(DatabaseService._profiles_file(), data)
        return current

    # ── Analytics: daily requests + model latency ──
    @staticmethod
    def _events_file() -> str:
        return "request_events.json"

    @staticmethod
    def _latency_file() -> str:
        return "model_latency.json"

    @staticmethod
    def _token_file() -> str:
        return "token_usage.json"

    @staticmethod
    def _load_token_data() -> Dict[str, Any]:
        """Bentuk data sama dengan token_usage.json: budget, daily, by_user."""
        if supabase_client:
            try:
                rows = supabase_client.table("token_usage").select("day,owner,prompt,completion").limit(10000).execute().data or []
                bud = supabase_client.table("token_budget").select("budget").eq("id", 1).limit(1).execute().data or []
                data: Dict[str, Any] = {"budget": int(bud[0].get("budget", 0) or 0) if bud else 0, "daily": {}, "by_user": {}}
                for r in rows:
                    day, owner = str(r["day"]), str(r["owner"])
                    p, c = int(r.get("prompt", 0) or 0), int(r.get("completion", 0) or 0)
                    d = data["daily"].setdefault(day, {"prompt": 0, "completion": 0, "total": 0})
                    d["prompt"] += p
                    d["completion"] += c
                    d["total"] += p + c
                    u = data["by_user"].setdefault(owner, {"prompt": 0, "completion": 0, "total": 0, "daily": {}})
                    u["prompt"] += p
                    u["completion"] += c
                    u["total"] += p + c
                    u["daily"][day] = {"prompt": p, "completion": c, "total": p + c}
                return data
            except Exception:
                pass
        return _read_local_json(DatabaseService._token_file(), {})

    @staticmethod
    def record_token_usage(owner: str, prompt_tokens: int, completion_tokens: int):
        """Agregasi token per hari + per owner (Supabase token_usage, fallback JSON lokal)."""
        try:
            p = max(0, int(prompt_tokens or 0))
            c = max(0, int(completion_tokens or 0))
            if p == 0 and c == 0:
                return
            day = datetime.now().date().isoformat()
            if supabase_client:
                try:
                    cur = supabase_client.table("token_usage").select("prompt,completion").eq("day", day).eq("owner", owner).limit(1).execute().data or []
                    base_p = int(cur[0].get("prompt", 0) or 0) if cur else 0
                    base_c = int(cur[0].get("completion", 0) or 0) if cur else 0
                    supabase_client.table("token_usage").upsert(
                        {"day": day, "owner": owner, "prompt": base_p + p, "completion": base_c + c},
                        on_conflict="day,owner",
                    ).execute()
                    return
                except Exception:
                    pass
            from datetime import timedelta
            data = _read_local_json(DatabaseService._token_file(), {})
            data.setdefault("budget", 0)
            # harian global
            daily = data.setdefault("daily", {})
            cur = daily.get(day) or {"prompt": 0, "completion": 0}
            np_ = int(cur.get("prompt", 0)) + p
            nc_ = int(cur.get("completion", 0)) + c
            daily[day] = {"prompt": np_, "completion": nc_, "total": np_ + nc_}
            if len(daily) > 120:
                for k in sorted(daily.keys())[:-120]:
                    daily.pop(k, None)
            # per user (owner = user_id atau "trial:<ip>")
            bu = data.setdefault("by_user", {})
            u = bu.setdefault(owner, {"prompt": 0, "completion": 0, "total": 0, "daily": {}})
            u["prompt"] = int(u.get("prompt", 0)) + p
            u["completion"] = int(u.get("completion", 0)) + c
            u["total"] = int(u.get("total", 0)) + p + c
            ud = u.setdefault("daily", {})
            ucur = ud.get(day) or {"prompt": 0, "completion": 0}
            unp = int(ucur.get("prompt", 0)) + p
            unc = int(ucur.get("completion", 0)) + c
            ud[day] = {"prompt": unp, "completion": unc, "total": unp + unc}
            if len(ud) > 120:
                for k in sorted(ud.keys())[:-120]:
                    ud.pop(k, None)
            _write_local_json(DatabaseService._token_file(), data)
        except Exception:
            pass

    @staticmethod
    def get_token_stats(days: int = 14) -> Dict[str, Any]:
        from datetime import timedelta
        days = max(1, min(120, int(days)))
        data = DatabaseService._load_token_data()
        daily: Dict[str, Any] = data.get("daily") or {}
        by_user: Dict[str, Any] = data.get("by_user") or {}
        today = datetime.now().date()
        daily_out: List[Dict[str, Any]] = []
        for i in range(days - 1, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            row = daily.get(d) or {"prompt": 0, "completion": 0}
            pr = int(row.get("prompt", 0) or 0)
            co = int(row.get("completion", 0) or 0)
            daily_out.append({"day": d, "prompt": pr, "completion": co, "total": pr + co})
        t = daily.get(today.isoformat()) or {}
        y = daily.get((today - timedelta(days=1)).isoformat()) or {}
        total_p = sum(int(v.get("prompt", 0) or 0) for v in daily.values())
        total_c = sum(int(v.get("completion", 0) or 0) for v in daily.values())
        by_out: List[Dict[str, Any]] = []
        for owner, u in by_user.items():
            ud = (u.get("daily") or {}).get(today.isoformat()) or {}
            by_out.append({
                "owner": owner,
                "prompt": int(u.get("prompt", 0) or 0),
                "completion": int(u.get("completion", 0) or 0),
                "total": int(u.get("total", 0) or 0),
                "today": int(ud.get("total", 0) or 0),
            })
        by_out.sort(key=lambda x: x["total"], reverse=True)
        budget = int(data.get("budget", 0) or 0)
        today_total = int(t.get("total", 0) or 0) or (int(t.get("prompt", 0) or 0) + int(t.get("completion", 0) or 0))
        y_total = int(y.get("total", 0) or 0) or (int(y.get("prompt", 0) or 0) + int(y.get("completion", 0) or 0))
        return {
            "daily": daily_out,
            "today": {"prompt": int(t.get("prompt", 0) or 0), "completion": int(t.get("completion", 0) or 0), "total": today_total},
            "yesterday": {"prompt": int(y.get("prompt", 0) or 0), "completion": int(y.get("completion", 0) or 0), "total": y_total},
            "total": {"prompt": total_p, "completion": total_c, "total": total_p + total_c},
            "budget": budget,
            "remaining": (budget - today_total) if budget > 0 else None,
            "by_user": by_out,
        }

    @staticmethod
    def set_token_budget(budget: int) -> int:
        value = max(0, int(budget or 0))
        if supabase_client:
            try:
                supabase_client.table("token_budget").upsert(
                    {"id": 1, "budget": value, "updated_at": datetime.now().isoformat()},
                    on_conflict="id",
                ).execute()
                return value
            except Exception:
                pass
        data = _read_local_json(DatabaseService._token_file(), {})
        data["budget"] = value
        _write_local_json(DatabaseService._token_file(), data)
        return value

    @staticmethod
    def record_request_event(model: Optional[str] = None, latency_ms: Optional[int] = None):
        try:
            day = datetime.now().date().isoformat()
            events = _read_local_json(DatabaseService._events_file(), {})
            events[day] = int(events.get(day, 0) or 0) + 1
            # keep last 365 days for week/month/year views
            if len(events) > 365:
                for k in sorted(events.keys())[:-365]:
                    events.pop(k, None)
            _write_local_json(DatabaseService._events_file(), events)
            if supabase_client:
                try:
                    supabase_client.table("request_events").upsert({"day": day, "count": events[day]}, on_conflict="day").execute()
                except Exception:
                    pass
            if model and latency_ms is not None:
                lats = _read_local_json(DatabaseService._latency_file(), {})
                # store per-day per-model samples aggregated: count + sum
                key = f"{day}::{model}"
                cur = lats.get(key) or {"count": 0, "sum_ms": 0}
                lats[key] = {"count": int(cur.get("count", 0)) + 1, "sum_ms": int(cur.get("sum_ms", 0)) + int(latency_ms)}
                # prune 60 days
                cutoff = (datetime.now().date().isoformat()[:8])  # keep simple: file grows slowly
                _write_local_json(DatabaseService._latency_file(), lats)
                if supabase_client:
                    try:
                        supabase_client.table("model_latency").upsert({"key": key, "day": day, "model": model, "count": lats[key]["count"], "sum_ms": lats[key]["sum_ms"]}, on_conflict="key").execute()
                    except Exception:
                        pass
        except Exception:
            pass

    @staticmethod
    def get_daily_requests(days: int = 14) -> List[Dict[str, Any]]:
        days = max(1, min(365, int(days)))
        events: Dict[str, int] = {}
        if supabase_client:
            try:
                res = supabase_client.table("request_events").select("day,count").execute()
                if res.data:
                    for r in res.data:
                        events[str(r.get("day"))] = int(r.get("count", 0) or 0)
            except Exception:
                pass
        if not events:
            events = _read_local_json(DatabaseService._events_file(), {})
        today = datetime.now().date()
        out: List[Dict[str, Any]] = []
        for i in range(days - 1, -1, -1):
            d = (today - __import__("datetime").timedelta(days=i)).isoformat()
            out.append({"day": d, "count": int(events.get(d, 0) or 0)})
        return out

    @staticmethod
    def get_aggregated_requests(period: str = "day", limit: int = 14) -> List[Dict[str, Any]]:
        """Aggregate daily events into week/month/year buckets. Returns left-to-right chronological."""
        daily = DatabaseService.get_daily_requests(days=365)
        if period == "day":
            return daily[-max(1, min(60, int(limit))):]
        # week: Monday-start ISO weeks
        buckets: Dict[str, int] = {}
        order: List[str] = []
        for r in daily:
            d = datetime.strptime(r["day"], "%Y-%m-%d").date()
            if period == "week":
                monday = d - __import__("datetime").timedelta(days=d.weekday())
                key = monday.isoformat()
                label = f"{key}"  # week starting Monday
            elif period == "month":
                key = d.strftime("%Y-%m")
                label = key
            elif period == "year":
                key = d.strftime("%Y")
                label = key
            else:
                key = r["day"]
                label = key
            if key not in buckets:
                buckets[key] = 0
                order.append(key)
            buckets[key] += int(r.get("count", 0) or 0)
        # keep last N buckets
        tail_keys = order[-max(1, min(60, int(limit))):]
        return [{"day": k, "count": buckets[k]} for k in tail_keys]

    @staticmethod
    def get_aggregated_latency(period: str = "day", limit: int = 14) -> List[Dict[str, Any]]:
        """Aggregate per-day latency buckets into week/month/year."""
        daily = DatabaseService.get_model_latency(days=365)  # internal raw would recurse - use model_latency directly via daily path
        # Re-aggregate from raw model_latency
        lats_raw: Dict[str, Dict[str, Any]] = {}
        if supabase_client:
            try:
                res = supabase_client.table("model_latency").select("key,day,model,count,sum_ms").execute()
                if res.data:
                    for r in res.data:
                        lats_raw[str(r.get("key"))] = {"count": int(r.get("count", 0)), "sum_ms": int(r.get("sum_ms", 0)), "day": str(r.get("day")), "model": str(r.get("model"))}
            except Exception:
                pass
        if not lats_raw:
            raw = _read_local_json(DatabaseService._latency_file(), {})
            for k, v in (raw or {}).items():
                if isinstance(v, dict):
                    parts = k.split("::", 1)
                    lats_raw[k] = {"count": int(v.get("count", 0)), "sum_ms": int(v.get("sum_ms", 0)), "day": parts[0] if parts else "", "model": parts[1] if len(parts) > 1 else k}
        # bucket by period
        from collections import defaultdict
        bucket_models: Dict[str, Dict[str, Dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: {"count": 0, "sum_ms": 0}))
        bucket_days: Dict[str, set] = defaultdict(set)
        for v in lats_raw.values():
            try:
                d = datetime.strptime(v.get("day", ""), "%Y-%m-%d").date()
            except Exception:
                continue
            if period == "day":
                key = v.get("day", "")
            elif period == "week":
                monday = d - __import__("datetime").timedelta(days=d.weekday())
                key = monday.isoformat()
            elif period == "month":
                key = d.strftime("%Y-%m")
            elif period == "year":
                key = d.strftime("%Y")
            else:
                key = v.get("day", "")
            model = v.get("model", "unknown")
            bucket_models[key][model]["count"] += int(v.get("count", 0) or 0)
            bucket_models[key][model]["sum_ms"] += int(v.get("sum_ms", 0) or 0)
            bucket_days[key].add(v.get("day", ""))
        # order keys chronologically
        keys = sorted(bucket_models.keys())
        keys = keys[-max(1, min(60, int(limit))):]
        out: List[Dict[str, Any]] = []
        for k in keys:
            per_model = []
            total_c = 0
            total_s = 0
            for model, vals in bucket_models[k].items():
                c = int(vals["count"] or 0)
                s = int(vals["sum_ms"] or 0)
                total_c += c
                total_s += s
                per_model.append({"model": model, "avg_ms": round(s / max(1, c)), "count": c})
            per_model.sort(key=lambda x: x["avg_ms"])
            avg = round(total_s / total_c) if total_c else None
            out.append({"day": k, "avg_ms": avg, "models": per_model})
        # if no data yet but period=day, return days with nulls so chart shows timeline
        if not out and period == "day":
            return DatabaseService.get_model_latency(days=limit)
        return out

    @staticmethod
    def get_model_latency(days: int = 14) -> List[Dict[str, Any]]:
        days = max(1, min(60, int(days)))
        lats: Dict[str, Dict[str, Any]] = {}
        if supabase_client:
            try:
                res = supabase_client.table("model_latency").select("key,day,model,count,sum_ms").execute()
                if res.data:
                    for r in res.data:
                        lats[str(r.get("key"))] = {"count": int(r.get("count", 0)), "sum_ms": int(r.get("sum_ms", 0)), "day": str(r.get("day")), "model": str(r.get("model"))}
            except Exception:
                pass
        if not lats:
            raw = _read_local_json(DatabaseService._latency_file(), {})
            for k, v in (raw or {}).items():
                if isinstance(v, dict):
                    # parse key day::model
                    parts = k.split("::", 1)
                    lats[k] = {"count": int(v.get("count", 0)), "sum_ms": int(v.get("sum_ms", 0)), "day": parts[0] if parts else "", "model": parts[1] if len(parts) > 1 else k}
        # aggregate per day: avg latency across models, and per-model avg
        today = datetime.now().date()
        days_list = [(today - __import__("datetime").timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
        by_day: Dict[str, List[Dict[str, Any]]] = {d: [] for d in days_list}
        for v in lats.values():
            d = v.get("day")
            if d in by_day:
                by_day[d].append(v)
        # output: per day avg latency + per-model breakdown
        out: List[Dict[str, Any]] = []
        for d in days_list:
            vals = by_day[d]
            if not vals:
                out.append({"day": d, "avg_ms": None, "models": []})
            else:
                total_c = sum(int(x.get("count", 0) or 0) for x in vals)
                total_s = sum(int(x.get("sum_ms", 0) or 0) for x in vals)
                avg = round(total_s / total_c) if total_c else None
                per_model = [{"model": x.get("model"), "avg_ms": round(int(x.get("sum_ms", 0)) / max(1, int(x.get("count", 0)))), "count": int(x.get("count", 0))} for x in vals]
                per_model.sort(key=lambda x: x["avg_ms"])
                out.append({"day": d, "avg_ms": avg, "models": per_model})
        return out
