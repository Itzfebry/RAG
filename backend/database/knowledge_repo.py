import uuid
from datetime import datetime
from typing import Any


class KnowledgeMixin:
    @staticmethod
    def get_knowledge_categories() -> list[dict[str, Any]]:
        from backend.database.db import _read_local_json, logger, supabase_client

        default_categories = [
            {
                "id": "c1",
                "slug": "technical_knowledge",
                "name": "Technical Knowledge",
                "description": "Owner technical skills, tools, stack",
            },
            {
                "id": "c2",
                "slug": "projects",
                "name": "Projects",
                "description": "Owner projects context, goals, and details",
            },
            {
                "id": "c3",
                "slug": "experience",
                "name": "Experience",
                "description": "Work and domain experience context",
            },
            {
                "id": "c4",
                "slug": "preferences",
                "name": "Preferences",
                "description": "Personal and workflow preferences",
            },
            {
                "id": "c5",
                "slug": "custom_topics",
                "name": "Custom Topics",
                "description": "Additional custom knowledge topics",
            },
        ]
        if supabase_client:
            try:
                res = supabase_client.table("knowledge_categories").select("*").execute()
                if res.data:
                    return res.data
            except Exception as e:
                logger.warning(f"Error fetching knowledge_categories from Supabase: {e}")

        return _read_local_json("knowledge_categories.json", default_categories)

    @staticmethod
    def get_knowledge_entries(category_slug: str | None = None) -> list[dict[str, Any]]:
        from backend.database.db import _read_local_json, logger, supabase_client

        if supabase_client:
            try:
                if category_slug:
                    # Optimized: single query with join filter
                    query = (
                        supabase_client.table("knowledge_entries")
                        .select("*, knowledge_categories!inner(slug, name)")
                        .eq("knowledge_categories.slug", category_slug)
                    )
                else:
                    query = supabase_client.table("knowledge_entries").select("*, knowledge_categories(slug, name)")

                res = query.execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                logger.warning(f"Error fetching knowledge_entries from Supabase: {e}")

        entries = _read_local_json("knowledge_entries.json", [])
        if category_slug:
            return [e for e in entries if e.get("category_slug") == category_slug]
        return entries

    @staticmethod
    def create_or_update_knowledge_entry(data: dict[str, Any]) -> dict[str, Any]:
        from backend.database.db import _read_local_json, _write_local_json, logger, supabase_client

        entry_id = data.get("id") or str(uuid.uuid4())
        data["id"] = entry_id
        data["updated_at"] = datetime.now().isoformat()

        if supabase_client:
            try:
                res = supabase_client.table("knowledge_entries").upsert(data).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error saving knowledge_entry in Supabase: {e}")

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
        from backend.database.db import _read_local_json, _write_local_json, logger, supabase_client

        if supabase_client:
            try:
                supabase_client.table("knowledge_embeddings").delete().eq("entry_id", entry_id).execute()
                supabase_client.table("knowledge_entries").delete().eq("id", entry_id).execute()
                return True
            except Exception as e:
                logger.warning(f"Error deleting knowledge_entry in Supabase: {e}")

        entries = _read_local_json("knowledge_entries.json", [])
        entries = [e for e in entries if e["id"] != entry_id]
        _write_local_json("knowledge_entries.json", entries)
        return True
