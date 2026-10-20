import uuid
from datetime import datetime
from typing import Any


class ChatMixin:
    # ── Riwayat chat user login (retensi 7 hari, maks 3 chat per user) ──

    CHAT_RETENTION_DAYS = 7
    CHAT_MAX_PER_USER = 3

    @staticmethod
    def _chats_file() -> str:
        return "chat_sessions.json"

    @staticmethod
    def _chat_msgs_file() -> str:
        return "chat_messages.json"

    @staticmethod
    def _chat_cutoff_iso() -> str:
        from datetime import timedelta

        from backend.database.db import DatabaseService

        return (datetime.now() - timedelta(days=DatabaseService.CHAT_RETENTION_DAYS)).isoformat()

    @staticmethod
    def purge_expired_chats() -> None:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        cutoff = DatabaseService._chat_cutoff_iso()
        if supabase_client:
            try:
                old = supabase_client.table("chat_sessions").select("id").lt("updated_at", cutoff).execute()
                ids = [r["id"] for r in (old.data or [])]
                if ids:
                    supabase_client.table("chat_messages").delete().in_("session_id", ids).execute()
                    supabase_client.table("chat_sessions").delete().in_("id", ids).execute()
            except Exception as e:
                logger.warning(f"Error purging chats in Supabase: {e}")
        sessions = _read_local_json(DatabaseService._chats_file(), [])
        expired = {str(s["id"]) for s in sessions if str(s.get("updated_at") or "") < cutoff}
        if expired:
            _write_local_json(DatabaseService._chats_file(), [s for s in sessions if str(s["id"]) not in expired])
            msgs = _read_local_json(DatabaseService._chat_msgs_file(), [])
            _write_local_json(
                DatabaseService._chat_msgs_file(), [m for m in msgs if str(m.get("session_id")) not in expired]
            )

    @staticmethod
    def list_chat_sessions(user_id: str) -> list[dict[str, Any]]:
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        DatabaseService.purge_expired_chats()
        if supabase_client:
            try:
                res = (
                    supabase_client.table("chat_sessions")
                    .select("*")
                    .eq("user_id", str(user_id))
                    .order("updated_at", desc=True)
                    .execute()
                )
                if res.data is not None:
                    return res.data
            except Exception as e:
                logger.warning(f"Error listing chats in Supabase: {e}")
        rows = [s for s in _read_local_json(DatabaseService._chats_file(), []) if str(s.get("user_id")) == str(user_id)]
        return sorted(rows, key=lambda s: str(s.get("updated_at") or ""), reverse=True)

    @staticmethod
    def get_chat_session(user_id: str, session_id: str) -> dict[str, Any] | None:
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        if supabase_client:
            try:
                res = (
                    supabase_client.table("chat_sessions")
                    .select("*")
                    .eq("id", session_id)
                    .eq("user_id", str(user_id))
                    .limit(1)
                    .execute()
                )
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error reading chat in Supabase: {e}")
        for s in _read_local_json(DatabaseService._chats_file(), []):
            if str(s.get("id")) == str(session_id) and str(s.get("user_id")) == str(user_id):
                return s
        return None

    @staticmethod
    def list_chat_messages(session_id: str) -> list[dict[str, Any]]:
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        if supabase_client:
            try:
                res = (
                    supabase_client.table("chat_messages")
                    .select("*")
                    .eq("session_id", session_id)
                    .order("created_at")
                    .execute()
                )
                if res.data is not None:
                    return res.data
            except Exception as e:
                logger.warning(f"Error listing messages in Supabase: {e}")
        rows = [
            m
            for m in _read_local_json(DatabaseService._chat_msgs_file(), [])
            if str(m.get("session_id")) == str(session_id)
        ]
        return sorted(rows, key=lambda m: str(m.get("created_at") or ""))

    @staticmethod
    def create_chat_session(user_id: str, title: str) -> dict[str, Any]:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        now = datetime.now().isoformat()
        row = {
            "id": str(uuid.uuid4()),
            "user_id": str(user_id),
            "title": title or "Chat baru",
            "created_at": now,
            "updated_at": now,
        }
        if supabase_client:
            try:
                res = supabase_client.table("chat_sessions").insert(row).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error creating chat in Supabase: {e}")
        sessions = _read_local_json(DatabaseService._chats_file(), [])
        sessions.append(row)
        _write_local_json(DatabaseService._chats_file(), sessions)
        return row

    @staticmethod
    def append_chat_messages(session_id: str, items: list[dict[str, str]]) -> None:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        now = datetime.now().isoformat()
        rows = [
            {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "role": i["role"],
                "content": i["content"],
                "created_at": now,
            }
            for i in items
        ]
        if supabase_client:
            try:
                supabase_client.table("chat_messages").insert(rows).execute()
                supabase_client.table("chat_sessions").update({"updated_at": now}).eq("id", session_id).execute()
                return
            except Exception as e:
                logger.warning(f"Error saving messages in Supabase: {e}")
        msgs = _read_local_json(DatabaseService._chat_msgs_file(), [])
        msgs.extend(rows)
        _write_local_json(DatabaseService._chat_msgs_file(), msgs)
        sessions = _read_local_json(DatabaseService._chats_file(), [])
        for s in sessions:
            if str(s.get("id")) == str(session_id):
                s["updated_at"] = now
        _write_local_json(DatabaseService._chats_file(), sessions)

    @staticmethod
    def delete_chat_session(user_id: str, session_id: str) -> bool:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        if DatabaseService.get_chat_session(user_id, session_id) is None:
            return False
        if supabase_client:
            try:
                supabase_client.table("chat_messages").delete().eq("session_id", session_id).execute()
                supabase_client.table("chat_sessions").delete().eq("id", session_id).execute()
            except Exception as e:
                logger.warning(f"Error deleting chat in Supabase: {e}")
        sessions = _read_local_json(DatabaseService._chats_file(), [])
        _write_local_json(DatabaseService._chats_file(), [s for s in sessions if str(s.get("id")) != str(session_id)])
        msgs = _read_local_json(DatabaseService._chat_msgs_file(), [])
        _write_local_json(
            DatabaseService._chat_msgs_file(), [m for m in msgs if str(m.get("session_id")) != str(session_id)]
        )
        return True

    @staticmethod
    def rename_chat_session(session_id: str, title: str) -> None:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        if supabase_client:
            try:
                supabase_client.table("chat_sessions").update({"title": title}).eq("id", session_id).execute()
                return
            except Exception as e:
                logger.warning(f"Error renaming chat in Supabase: {e}")
        sessions = _read_local_json(DatabaseService._chats_file(), [])
        for s in sessions:
            if str(s.get("id")) == str(session_id):
                s["title"] = title
        _write_local_json(DatabaseService._chats_file(), sessions)

    @staticmethod
    def truncate_last_chat_turn(session_id: str) -> None:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        msgs = DatabaseService.list_chat_messages(session_id)
        user_idx = [i for i, m in enumerate(msgs) if m.get("role") == "user"]
        if not user_idx:
            return
        drop = {str(m["id"]) for m in msgs[user_idx[-1] :]}
        if supabase_client:
            try:
                supabase_client.table("chat_messages").delete().in_("id", list(drop)).execute()
                return
            except Exception as e:
                logger.warning(f"Error truncating chat in Supabase: {e}")
        local = _read_local_json(DatabaseService._chat_msgs_file(), [])
        _write_local_json(DatabaseService._chat_msgs_file(), [m for m in local if str(m.get("id")) not in drop])

    @staticmethod
    def count_chat_sessions(user_id: str) -> int:
        from backend.database.db import DatabaseService

        return len(DatabaseService.list_chat_sessions(user_id))
