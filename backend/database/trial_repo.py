from datetime import datetime


class TrialMixin:
    @staticmethod
    def _trial_file() -> str:
        return "trial_usage.json"

    @staticmethod
    def get_trial_used(ip: str) -> int:
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

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
    def try_consume_trial_prompt(ip: str, limit: int) -> bool:
        """Cek-batas + inkrement trial per-IP dalam SATU statement atomik.

        Request paralel dengan IP yang sama tidak bisa semua lolos gate karena
        batas dicek di tempat yang sama dengan inkrement (RPC Supabase).
        Fallback JSON lokal: inkrement di bawah `_counter_lock` (per-process).
        """
        from backend.database.db import (
            DatabaseService,
            _counter_lock,
            _read_local_json,
            _write_local_json,
            logger,
            supabase_client,
        )

        if supabase_client:
            try:
                res = supabase_client.rpc("consume_trial_prompt", {"p_ip": ip, "p_limit": int(limit)}).execute()
                return bool(res.data) if res.data is not None else False
            except Exception as e:
                logger.warning(f"[trial] RPC consume_trial_prompt gagal, fallback lokal: {e}")
        with _counter_lock:
            data = _read_local_json(DatabaseService._trial_file(), {})
            cur = int(data.get(ip, 0) or 0)
            if cur + 1 > int(limit):
                return False
            data[ip] = cur + 1
            _write_local_json(DatabaseService._trial_file(), data)
            return True

    @staticmethod
    def refund_trial_prompt(ip: str) -> None:
        """Kembalikan 1 trial kuota per-IP (provider gagal/tidak menjawab).

        Guard `used > 0` di SQL memastikan counter tidak pernah negatif.
        """
        from backend.database.db import (
            DatabaseService,
            _counter_lock,
            _read_local_json,
            _write_local_json,
            logger,
            supabase_client,
        )

        if supabase_client:
            try:
                supabase_client.rpc("refund_trial_prompt", {"p_ip": ip}).execute()
                return
            except Exception as e:
                logger.warning(f"[trial] RPC refund_trial_prompt gagal, fallback lokal: {e}")
        with _counter_lock:
            data = _read_local_json(DatabaseService._trial_file(), {})
            cur = int(data.get(ip, 0) or 0)
            if cur > 0:
                data[ip] = cur - 1
                _write_local_json(DatabaseService._trial_file(), data)

    @staticmethod
    def increment_trial(ip: str) -> int:
        from backend.database.db import (
            DatabaseService,
            _counter_lock,
            _read_local_json,
            _write_local_json,
            supabase_client,
        )

        with _counter_lock:
            if supabase_client:
                try:
                    cur = DatabaseService.get_trial_used(ip)
                    nxt = cur + 1
                    supabase_client.table("trial_usage").upsert(
                        {"ip": ip, "used": nxt, "updated_at": datetime.now().isoformat()}, on_conflict="ip"
                    ).execute()
                    return nxt
                except Exception:
                    pass
            data = _read_local_json(DatabaseService._trial_file(), {})
            nxt = int(data.get(ip, 0) or 0) + 1
            data[ip] = nxt
            _write_local_json(DatabaseService._trial_file(), data)
            return nxt

    @staticmethod
    def get_trial_usage_total() -> int:
        """Total pemakaian trial semua IP (Supabase; fallback JSON lokal)."""
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        if supabase_client:
            try:
                res = supabase_client.table("trial_usage").select("used").execute()
                if res.data:
                    return sum(int(r.get("used", 0) or 0) for r in res.data)
            except Exception as e:
                logger.warning(f"[trial] hitung total usage supabase gagal: {e}")
        data = _read_local_json(DatabaseService._trial_file(), {})
        return sum(int(v or 0) for v in data.values())

    @staticmethod
    def probe_database() -> tuple[bool, str]:
        """Cek kesehatan koneksi database. Return (ok, mode: lokal/supabase)."""
        from backend.database.db import logger, supabase_client

        if not supabase_client:
            return False, "lokal"
        try:
            supabase_client.table("app_settings").select("id").limit(1).execute()
            return True, "supabase"
        except Exception as e:
            logger.warning(f"[health] probe app_settings gagal: {e}")
            return False, "supabase (gagal)"
