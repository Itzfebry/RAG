"""Penyimpanan brief discovery (lead) - Supabase dengan fallback JSON lokal.

Percakapan discovery tidak ditulis per turn (mahal di serverless). Transcript
dikirim client satu kali saat menyimpan brief, lalu disimpan sebagai jsonb.
"""

import uuid
from datetime import datetime
from typing import Any

# Pipeline follow-up yang ditampilkan di tab Prospek.
BRIEF_STATUSES = ("new", "contacted", "quoted", "won", "lost")


class DiscoveryMixin:
    @staticmethod
    def _discovery_file() -> str:
        return "discovery_briefs.json"

    @staticmethod
    def create_discovery_brief(data: dict[str, Any]) -> dict[str, Any]:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        now = datetime.now().isoformat()
        row = {
            "id": str(uuid.uuid4()),
            "session_key": str(data.get("session_key") or ""),
            "name": (str(data.get("name")).strip() if data.get("name") else None),
            "contact_channel": (str(data.get("contact_channel")).strip() if data.get("contact_channel") else None),
            "contact_value": (str(data.get("contact_value")).strip() if data.get("contact_value") else None),
            "summary": (str(data.get("summary")).strip() if data.get("summary") else None),
            "brief": data.get("brief") or {},
            "transcript": data.get("transcript") or [],
            "status": "new",
            "notes": None,
            "turn_count": int(data.get("turn_count") or 0),
            "created_at": now,
            "updated_at": now,
        }
        if supabase_client:
            try:
                res = supabase_client.table("discovery_briefs").insert(row).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error saving discovery_brief in Supabase: {e}")
        rows = _read_local_json(DatabaseService._discovery_file(), [])
        rows.append(row)
        _write_local_json(DatabaseService._discovery_file(), rows)
        return row

    @staticmethod
    def list_discovery_briefs(limit: int = 100, status: str | None = None) -> list[dict[str, Any]]:
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        limit = max(1, min(500, int(limit or 100)))
        status = (status or "").strip() or None
        if status and status not in BRIEF_STATUSES:
            status = None
        if supabase_client:
            try:
                query = supabase_client.table("discovery_briefs").select("*")
                if status:
                    query = query.eq("status", status)
                res = query.order("created_at", desc=True).limit(limit).execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                logger.warning(f"Error listing discovery_briefs in Supabase: {e}")
        rows = _read_local_json(DatabaseService._discovery_file(), [])
        if status:
            rows = [r for r in rows if str(r.get("status")) == status]
        rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
        return rows[:limit]

    @staticmethod
    def get_discovery_brief(brief_id: str) -> dict[str, Any] | None:
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        if supabase_client:
            try:
                res = supabase_client.table("discovery_briefs").select("*").eq("id", brief_id).limit(1).execute()
                if res.data:
                    return res.data[0]
                return None
            except Exception as e:
                logger.warning(f"Error reading discovery_brief in Supabase: {e}")
        for row in _read_local_json(DatabaseService._discovery_file(), []):
            if str(row.get("id")) == str(brief_id):
                return row
        return None

    @staticmethod
    def update_discovery_brief(brief_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        """Update status/notes prosepek. Return baris terbaru atau None."""
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        clean: dict[str, Any] = {"updated_at": datetime.now().isoformat()}
        status = str(patch.get("status") or "").strip()
        if status:
            if status not in BRIEF_STATUSES:
                return None
            clean["status"] = status
        if "notes" in patch:
            notes = patch.get("notes")
            clean["notes"] = (str(notes).strip()[:2000] if notes else None)

        if supabase_client:
            try:
                res = supabase_client.table("discovery_briefs").update(clean).eq("id", brief_id).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error updating discovery_brief in Supabase: {e}")
        rows = _read_local_json(DatabaseService._discovery_file(), [])
        updated = None
        for row in rows:
            if str(row.get("id")) == str(brief_id):
                row.update(clean)
                updated = row
        if updated is not None:
            _write_local_json(DatabaseService._discovery_file(), rows)
        return updated

    @staticmethod
    def count_discovery_briefs() -> int:
        from backend.database.db import DatabaseService

        return len(DatabaseService.list_discovery_briefs(limit=500))
