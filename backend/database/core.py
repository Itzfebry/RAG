import json
import os
import threading
from typing import Any

try:
    from backend.config.config import settings
    from backend.core.logging_config import get_logger
except ImportError:
    try:
        from config.config import settings
        from core.logging_config import get_logger  # type: ignore
    except ImportError:
        # Final fallback for unusual execution contexts
        import os
        import sys

        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from config.config import settings
        from core.logging_config import get_logger  # type: ignore

logger = get_logger(__name__)

# Attempt to initialize Supabase client if configured
supabase_client = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        from supabase import Client, create_client

        supabase_client: Client | None = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        logger.warning(f"Supabase init warning: {e}")

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
    logger.warning(f"Warning: cannot create local data dir {LOCAL_DATA_DIR}: {e}")


def _read_local_json(file_name: str, default_data: Any) -> Any:
    # Baca direktori aktual dari facade (db.py) saat runtime supaya
    # monkeypatch LOCAL_DATA_DIR tetap berfungsi; fallback ke nilai core.
    try:
        from backend.database.db import LOCAL_DATA_DIR as _base
    except ImportError:
        _base = LOCAL_DATA_DIR
    path = os.path.join(_base, file_name)
    if not os.path.exists(path):
        _write_local_json(file_name, default_data)
        return default_data
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default_data


def _write_local_json(file_name: str, data: Any):
    try:
        from backend.database.db import LOCAL_DATA_DIR as _base
    except ImportError:
        _base = LOCAL_DATA_DIR
    path = os.path.join(_base, file_name)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError as e:
        # Serverless read-only FS - Supabase remains the source of truth
        logger.warning(f"Warning: cannot write local json {path}: {e}")


# Serialisasi read-modify-write counter (kuota prompt, trial, token) per proses.
# Mencegah undercount saat beberapa request menyentuh counter yang sama.
# Catatan: hanya mengamankan satu instance; multi-instance butuh atomik di DB.
_counter_lock = threading.Lock()
