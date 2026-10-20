"""Kuota prompt harian (periode berbasis Asia/Jakarta).

Sumber nilai kuota:
- Paket aktif pengguna = order dengan status "paid" TERBARU yang plan_id-nya
  masih dikenali di `pricing_config.plans` (data milik admin panel).
- Batas harian = field `prompts` pada paket tersebut, dibaca dari database
  setiap kali digunakan. Perubahan di panel admin langsung berlaku.
- Pengguna TANPA order paid (akun legacy / kuota `max_prompts` lama) tetap
  memakai mekanisme lama yang kumulatif — kompatibel, tidak dipaksa harian.

Reset harian: berbasis PERIODE (kunci tanggal WIB), bukan scheduler.
Row penggunaan hari sebelumnya tidak dihapus — hanya berganti kunci.
"""

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

WIB = ZoneInfo("Asia/Jakarta")


def _wib_day() -> str:
    return datetime.now(WIB).date().isoformat()


def _next_reset_iso() -> str:
    now = datetime.now(WIB)
    nxt = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return nxt.strftime("%Y-%m-%d %H:%M WIB")


class QuotaMixin:
    @staticmethod
    def _daily_quota_file() -> str:
        return "user_daily_quota.json"

    # ── Resolusi batas harian dari database ──
    @staticmethod
    def resolve_daily_plan(user_id: str) -> dict[str, Any] | None:
        """Paket aktif = order paid terbaru yang masih dikenali di pricing.

        Order paid terbaru yang menentukan; bila masa aktifnya (field `days`
        order) sudah lewat, plan kembali dengan `expired: True` - kuota dianggap
        habis (remaining 0) sampai user beli paket lagi. Order legacy tanpa
        `days` tidak pernah expire. Return None bila pengguna tidak punya paket
        harian sama sekali (legacy/unlimited) - bukan karena expired.
        Batas selalu dibaca dari pricing_config saat ini - bukan snapshot.
        """
        from backend.database.billing_repo import order_expiry
        from backend.database.db import DatabaseService

        uid = str(user_id)
        orders = DatabaseService.list_orders(user_id=uid, limit=100)
        for o in orders:
            if str(o.get("user_id") or "") != uid or str(o.get("status") or "") != "paid":
                continue
            plan = DatabaseService.find_plan(str(o.get("plan_id") or ""))
            if plan:
                prompts = int(plan.get("prompts") or 0)
                if prompts > 0:
                    expired, expiry = order_expiry(o)
                    days_left: int | None = None
                    if expiry is not None:
                        delta = expiry - (datetime.now(expiry.tzinfo) if expiry.tzinfo else datetime.now())
                        days_left = max(
                            0, int(delta.total_seconds() // 86400) + (1 if delta.total_seconds() % 86400 else 0)
                        )
                    return {
                        "plan_id": str(plan.get("id")),
                        "plan_label": str(plan.get("label") or plan.get("id")),
                        "daily_limit": prompts,
                        "expired": expired,
                        "expires_at": expiry.isoformat() if expiry else None,
                        "days_left": days_left if expiry is not None else None,
                    }
        return None

    # ── Satu fungsi untuk UI/backend: status kuota hari ini ──
    @staticmethod
    def get_quota_status(user: dict[str, Any]) -> dict[str, Any]:
        """Status kuota lengkap untuk /user/me, chat UI, dan halaman akun."""
        from backend.database.db import DatabaseService

        uid = str(user.get("id"))
        plan = DatabaseService.resolve_daily_plan(uid)
        used = DatabaseService.get_daily_usage(uid)
        if plan is None:
            # Legacy: kumulatif max_prompts (0 = unlimited) - perilaku lama.
            max_p = int(user.get("max_prompts", 0) or 0)
            legacy_used = int(user.get("prompts_used", 0) or 0)
            return {
                "mode": "legacy",
                "plan_id": None,
                "plan_label": None,
                "daily_limit": None,
                "used_today": None,
                "remaining": max(0, max_p - legacy_used) if max_p > 0 else None,
                "quota_day": None,
                "next_reset_wib": None,
            }
        limit = int(plan["daily_limit"])
        expired = bool(plan.get("expired"))
        if expired:
            # Masa aktif habis: kuota hari ini dianggap nol sampai beli paket lagi.
            return {
                "mode": "expired",
                "plan_id": plan["plan_id"],
                "plan_label": plan["plan_label"],
                "daily_limit": limit,
                "used_today": used,
                "remaining": 0,
                "quota_day": _wib_day(),
                "next_reset_wib": None,
                "plan_expires_at": plan.get("expires_at"),
                "plan_days_left": 0,
            }
        remaining = max(0, limit - used)
        return {
            "mode": "daily",
            "plan_id": plan["plan_id"],
            "plan_label": plan["plan_label"],
            "daily_limit": limit,
            "used_today": used,
            "remaining": remaining,
            "quota_day": _wib_day(),
            "next_reset_wib": _next_reset_iso(),
            "plan_expires_at": plan.get("expires_at"),
            "plan_days_left": plan.get("days_left"),
        }

    @staticmethod
    def get_daily_usage(user_id: str) -> int:
        """Jumlah prompt yang dipakai pada periode harian WIB yang berlaku."""
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        uid, day = str(user_id), _wib_day()
        if supabase_client:
            try:
                res = (
                    supabase_client.table("user_daily_quota")
                    .select("prompts_used")
                    .eq("user_id", uid)
                    .eq("quota_day", day)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    return int(res.data[0].get("prompts_used") or 0)
                return 0
            except Exception as e:
                logger.warning(f"Error reading daily quota: {e}")
        row = (_read_local_json(DatabaseService._daily_quota_file(), {}).get(day) or {}).get(uid)
        return int((row or {}).get("prompts_used") or 0)

    # ── Konsumsi & refund kuota harian ──
    @staticmethod
    def try_consume_daily_prompt(user_id: str, daily_limit: int) -> bool:
        """Kurangi kuota harian secara atomik.

        Supabase: RPC `consume_daily_prompt` (single statement, aman paralel).
        Fallback JSON lokal: inkrement dengan `_counter_lock`.
        """
        from backend.database.db import (
            DatabaseService,
            _counter_lock,
            _read_local_json,
            _write_local_json,
            logger,
            supabase_client,
        )

        uid, day = str(user_id), _wib_day()
        if supabase_client:
            try:
                res = supabase_client.rpc(
                    "consume_daily_prompt", {"p_user_id": uid, "p_limit": int(daily_limit)}
                ).execute()
                return bool(res.data) if res.data is not None else False
            except Exception as e:
                logger.warning(f"Error consuming daily quota: {e}")
        with _counter_lock:
            data = _read_local_json(DatabaseService._daily_quota_file(), {})
            cur = int((((data.get(day) or {}).get(uid)) or {}).get("prompts_used") or 0)
            if cur + 1 > int(daily_limit):
                return False
            data.setdefault(day, {})[uid] = {"prompts_used": cur + 1, "updated_at": datetime.now(WIB).isoformat()}
            _write_local_json(DatabaseService._daily_quota_file(), data)
            return True

    @staticmethod
    def refund_daily_prompt(user_id: str) -> None:
        """Kembalikan 1 kuota pada periode berjalan (provider gagal/tidak jawab)."""
        from backend.database.db import (
            DatabaseService,
            _counter_lock,
            _read_local_json,
            _write_local_json,
            logger,
            supabase_client,
        )

        uid, day = str(user_id), _wib_day()
        if supabase_client:
            try:
                supabase_client.rpc("refund_daily_prompt", {"p_user_id": uid}).execute()
                return
            except Exception as e:
                logger.warning(f"Error refunding daily quota: {e}")
        with _counter_lock:
            data = _read_local_json(DatabaseService._daily_quota_file(), {})
            cur = int((((data.get(day) or {}).get(uid)) or {}).get("prompts_used") or 0)
            if cur > 0:
                data.setdefault(day, {})[uid] = {"prompts_used": cur - 1, "updated_at": datetime.now(WIB).isoformat()}
                _write_local_json(DatabaseService._daily_quota_file(), data)

    # ── Kompatibilitas: menggantikan is_prompt_quota_exhausted lama ──
    @staticmethod
    def is_prompt_quota_exhausted(user: dict[str, Any]) -> bool:
        """Daily-aware. User tanpa paket harian tetap dicek laras kumulatif lama."""
        from backend.database.db import DatabaseService
        from backend.database.users_repo import UsersMixin

        plan = None
        try:
            plan = DatabaseService.resolve_daily_plan(str(user.get("id")))
        except Exception:
            return True  # db error → jangan open-gate diam-diam
        if plan is None:
            return UsersMixin.is_prompt_quota_exhausted(user)
        if plan.get("expired"):
            return True  # masa aktif paket habis
        return DatabaseService.get_daily_usage(str(user.get("id"))) >= int(plan["daily_limit"])
