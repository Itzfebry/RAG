from datetime import UTC, datetime
from typing import Any

try:
    from backend.database.db import _read_local_json, _write_local_json, supabase_client
except ImportError:
    from database.db import _read_local_json, _write_local_json, supabase_client  # type: ignore

AUDIT_FILE = "audit_log.json"
MAX_LOCAL_ROWS = 500


def log_action(actor: str, action: str, target: str = "", detail: str = "", ip: str = "") -> None:
    row = {
        "created_at": datetime.now(UTC).isoformat(),
        "actor": actor or "unknown",
        "action": action,
        "target": target or "",
        "detail": (detail or "")[:500],
        "ip": ip or "",
    }
    if supabase_client:
        try:
            supabase_client.table("audit_log").insert(row).execute()
            return
        except Exception as e:
            print(f"audit: supabase insert gagal, fallback lokal: {e}")
    rows = _read_local_json(AUDIT_FILE, [])
    rows.append(row)
    _write_local_json(AUDIT_FILE, rows[-MAX_LOCAL_ROWS:])


def list_actions(limit: int = 100) -> list[dict[str, Any]]:
    limit = max(1, min(500, int(limit)))
    if supabase_client:
        try:
            res = supabase_client.table("audit_log").select("*").order("created_at", desc=True).limit(limit).execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            print(f"audit: supabase read gagal, fallback lokal: {e}")
    rows = _read_local_json(AUDIT_FILE, [])
    return list(reversed(rows))[:limit]
