from datetime import UTC, datetime


class RateLimitMixin:
    @staticmethod
    def bump_rate_limit(key: str, window_seconds: int) -> tuple | None:
        """Tambah 1 hitungan untuk `key` dalam jendela `window_seconds` (atomik via RPC).
        Return (count, reset_in_seconds) atau None bila DB tidak tersedia."""
        from backend.database.db import logger, supabase_client

        if not supabase_client:
            return None
        try:
            res = supabase_client.rpc("bump_rate_limit", {"p_key": str(key), "p_window": int(window_seconds)}).execute()
            rows = res.data
            row = rows[0] if isinstance(rows, list) and rows else (rows if isinstance(rows, dict) else None)
            if row:
                return int(row.get("count") or 0), int(row.get("reset_in") or window_seconds)
        except Exception as e:
            logger.warning(f"[rate_limit] bump gagal ({key}): {e}")
        return None

    @staticmethod
    def peek_rate_limit(key: str) -> int | None:
        """Baca hitungan `key` tanpa menambah. None bila DB tidak tersedia."""
        from backend.database.db import logger, supabase_client

        if not supabase_client:
            return None
        try:
            res = supabase_client.table("rate_limits").select("count").eq("key", str(key)).limit(1).execute()
            if res.data:
                return int(res.data[0].get("count") or 0)
            return 0
        except Exception as e:
            logger.warning(f"[rate_limit] peek gagal ({key}): {e}")
            return None

    @staticmethod
    def reset_rate_limit(key: str) -> bool:
        """Hapus hitungan `key`. Return True bila dijalankan di DB, False bila fallback."""
        from backend.database.db import logger, supabase_client

        if not supabase_client:
            return False
        try:
            supabase_client.table("rate_limits").delete().eq("key", str(key)).execute()
            return True
        except Exception as e:
            logger.warning(f"[rate_limit] reset gagal ({key}): {e}")
            return False

    @staticmethod
    def prune_rate_limits(older_than_hours: int = 24) -> int:
        """Buang baris rate limit yang jendelanya sudah lewat (dipanggil cron harian)."""
        from backend.database.db import logger, supabase_client

        if not supabase_client:
            return 0
        from datetime import timedelta as _td

        cutoff = (datetime.now(UTC) - _td(hours=max(1, int(older_than_hours)))).isoformat()
        try:
            res = supabase_client.table("rate_limits").delete().lt("window_start", cutoff).execute()
            return len(res.data or [])
        except Exception as e:
            logger.warning(f"[rate_limit] prune gagal: {e}")
            return 0
