"""Kuota prompt harian (periode berbasis Asia/Jakarta).

Sumber nilai kuota:
- Paket aktif pengguna = order dengan status "paid" TERBARU yang plan_id-nya
  masih dikenali di `pricing_config.plans` (data milik admin panel).
- Batas harian = field `prompts` pada paket tersebut, dibaca dari database
  setiap kali digunakan. Perubahan di panel admin langsung berlaku.
- Mode harian-only: pengguna TANPA order paid dianggap tanpa batas
  (`remaining: None`).
 Kuota kumulatif lama (`max_prompts`/`prompts_used`) tidak lagi
 digunakan dalam gating — data legacy hanya disimpan untuk riwayat.

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
    def _plan_from_orders(
        uid: str,
        orders: list[dict[str, Any]],
        plans: dict[str, dict[str, Any]] | None = None,
        default_limit: int | None = None,
    ) -> dict[str, Any] | None:
        """Resolusi paket dari daftar order yang SUDAH diambil (dipakai versi bulk).

        Urutan sama dengan resolve_daily_plan: order paid terbaru yang plan-nya
        masih dikenali menang; tanpa itu pakai kuota default global.
        `plans` / `default_limit` boleh diisi versi bulk supaya pricing dibaca
        sekali per request, bukan per user.
        """
        from backend.database.billing_repo import order_expiry
        from backend.database.db import DatabaseService

        for o in orders:
            if str(o.get("user_id") or "") != uid or str(o.get("status") or "") != "paid":
                continue
            plan_id = str(o.get("plan_id") or "")
            plan = plans.get(plan_id) if plans is not None else DatabaseService.find_plan(plan_id)
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
                        "source": "plan",
                    }
        # Tanpa order paid: pakai kuota harian default global (admin panel).
        limit_default = default_limit if default_limit is not None else DatabaseService._default_daily_limit()
        if limit_default > 0:
            return {
                "plan_id": None,
                "plan_label": "Kuota Default",
                "daily_limit": limit_default,
                "expired": False,
                "expires_at": None,
                "days_left": None,
                "source": "default",
            }
        return None

    @staticmethod
    def _manual_grant_plan(user: dict[str, Any]) -> dict[str, Any] | None:
        """Kuota manual yang diberikan admin (menang atas paket & default).

        Dibaca dari kolom app_users: `manual_daily_limit`, `manual_plan_label`,
        `manual_expires_at`. limit <= 0 / kosong = tidak ada grant.
        """
        from backend.database.billing_repo import parse_dt

        try:
            limit = int((user or {}).get("manual_daily_limit") or 0)
        except (TypeError, ValueError):
            limit = 0
        if limit <= 0:
            return None
        expires_raw = str((user or {}).get("manual_expires_at") or "").strip() or None
        expiry = parse_dt(expires_raw) if expires_raw else None
        days_left: int | None = None
        expired = False
        if expiry is not None:
            now = datetime.now(expiry.tzinfo) if expiry.tzinfo else datetime.now()
            expired = now >= expiry
            delta = expiry - now
            days_left = max(0, int(delta.total_seconds() // 86400) + (1 if delta.total_seconds() % 86400 else 0))
        return {
            "plan_id": None,
            "plan_label": str((user or {}).get("manual_plan_label") or "Kuota manual"),
            "daily_limit": limit,
            "expired": expired,
            "expires_at": expires_raw,
            "days_left": days_left,
            "source": "manual",
        }

    @staticmethod
    def _plan_from_user(
        user: dict[str, Any],
        orders: list[dict[str, Any]],
        plans: dict[str, dict[str, Any]] | None = None,
        default_limit: int | None = None,
    ) -> dict[str, Any] | None:
        """Resolusi plan untuk satu user row: manual grant > order paid > default."""
        grant = QuotaMixin._manual_grant_plan(user)
        if grant is not None:
            return grant
        return QuotaMixin._plan_from_orders(str(user.get("id")), orders, plans=plans, default_limit=default_limit)

    @staticmethod
    def resolve_daily_plan(user_id: str) -> dict[str, Any] | None:
        """Paket aktif user: grant manual admin > order paid terbaru > default global.

        Order paid terbaru yang menentukan; bila masa aktifnya (field `days`
        order) sudah lewat, plan kembali dengan `expired: True` - kuota dianggap
        habis (remaining 0) sampai user beli paket lagi. Order legacy tanpa
        `days` tidak pernah expire. Return plan sintetis "Kuota Default" untuk
        user tanpa paket paid bila kuota default global > 0; return None hanya
        bila default global 0 (unlimited).
        Batas selalu dibaca dari pricing_config saat ini - bukan snapshot.
        """
        from backend.database.db import DatabaseService

        uid = str(user_id)
        row: dict[str, Any] = {"id": uid}
        try:
            fetched = DatabaseService.get_user_by_id(uid)
            if fetched:
                row = fetched
        except Exception:
            pass
        orders = DatabaseService.list_orders(user_id=uid, limit=100)
        return QuotaMixin._plan_from_user(row, orders)

    @staticmethod
    def _default_daily_limit() -> int:
        """Kuota harian default untuk user TANPA paket paid.

        Dibaca live dari `pricing_config.default_daily_prompts` (admin panel).
        Selalu minimal 1 harian - nilai 0 TIDAK lagi berarti unlimited
        (unlimited hanya via tombol Unlimited per user di panel admin).
        Key tidak ada (konfigurasi lama) dianggap 20.
        """
        from backend.database.db import DatabaseService

        val = DatabaseService.get_pricing().get("default_daily_prompts")
        if val is None:
            return 20
        try:
            return max(1, int(val))
        except (TypeError, ValueError):
            return 20

    @staticmethod
    def _is_unlimited(user: dict[str, Any]) -> bool:
        """Flag Unlimited eksplisit per user (tombol admin), bukan magic number."""
        return bool((user or {}).get("unlimited", False))

    @staticmethod
    def _unlimited_status() -> dict[str, Any]:
        return {
            "mode": "unlimited",
            "plan_id": None,
            "plan_label": "Unlimited",
            "plan_source": "unlimited",
            "subscribed": False,
            "daily_limit": None,
            "used_today": None,
            "remaining": None,
            "quota_day": _wib_day(),
            "next_reset_wib": _next_reset_iso(),
        }

    @staticmethod
    def _status_from_plan(plan: dict[str, Any] | None, used: int) -> dict[str, Any]:
        """Bentuk status kuota dari plan + pemakaian hari ini (tanpa I/O)."""
        if plan is None:
            # Kuota harian-only: tanpa paket = tanpa batas (unlimited).
            return QuotaMixin._unlimited_status()
        limit = int(plan["daily_limit"])
        source = str(plan.get("source") or "plan")
        # "langganan" = kuota berasal dari paket paid atau grant manual admin,
        # bukan dari Kuota Default global.
        subscribed = source in ("plan", "manual")
        if plan.get("expired"):
            # Masa aktif habis: kuota hari ini dianggap nol sampai beli paket lagi.
            return {
                "mode": "expired",
                "plan_id": plan["plan_id"],
                "plan_label": plan["plan_label"],
                "plan_source": source,
                "subscribed": subscribed,
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
            "plan_source": source,
            "subscribed": subscribed,
            "daily_limit": limit,
            "used_today": used,
            "remaining": remaining,
            "quota_day": _wib_day(),
            "next_reset_wib": _next_reset_iso(),
            "plan_expires_at": plan.get("expires_at"),
            "plan_days_left": plan.get("days_left"),
        }

    @staticmethod
    def get_quota_status(user: dict[str, Any]) -> dict[str, Any]:
        """Status kuota lengkap untuk /user/me, chat UI, dan halaman akun."""
        from backend.database.db import DatabaseService

        uid = str(user.get("id"))
        # Tombol Unlimited per user: tanpa batas apa pun, di atas paket/default.
        if QuotaMixin._is_unlimited(user):
            return QuotaMixin._unlimited_status()
        plan = DatabaseService.resolve_daily_plan(uid)
        used = DatabaseService.get_daily_usage(uid)
        return QuotaMixin._status_from_plan(plan, used)

    @staticmethod
    def usage_map(day: str | None = None) -> dict[str, int]:
        """Pemakaian harian seluruh user untuk satu periode — SATU query (bulk)."""
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        target = day or _wib_day()
        if supabase_client:
            try:
                res = (
                    supabase_client.table("user_daily_quota")
                    .select("user_id,prompts_used")
                    .eq("quota_day", target)
                    .limit(5000)
                    .execute()
                )
                if res.data is not None:
                    return {str(r.get("user_id")): int(r.get("prompts_used") or 0) for r in res.data}
            except Exception as e:
                logger.warning(f"Error reading daily quota map: {e}")
        rows = _read_local_json(DatabaseService._daily_quota_file(), {}).get(target) or {}
        return {str(k): int((v or {}).get("prompts_used") or 0) for k, v in rows.items()}

    @staticmethod
    def status_map(users: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        """Status kuota banyak user dengan query BULK (hindari N+1 di panel admin).

        Order diambil sekali dengan kolom minimal (max 500 baris terbaru, tanpa
        blob `proof`), pemakaian harian sekali per periode, dan tabel pricing
        dibaca sekali untuk seluruh user. Kembalikan map id -> status.
        """
        from backend.database.billing_repo import ORDER_QUOTA_COLUMNS
        from backend.database.db import DatabaseService

        day = _wib_day()
        try:
            orders = DatabaseService.list_orders(limit=500, columns=ORDER_QUOTA_COLUMNS)
        except Exception:
            orders = []
        # Pricing dibaca SEKALI per request (bukan per user / per order).
        plans: dict[str, dict[str, Any]] = {}
        default_limit: int | None = None
        try:
            pricing = DatabaseService.get_pricing()
            for p in pricing.get("plans") or []:
                if isinstance(p, dict) and p.get("id") is not None:
                    plans[str(p.get("id"))] = p
            raw_default = pricing.get("default_daily_prompts")
            if raw_default is None or str(raw_default).strip() == "":
                default_limit = 20
            else:
                try:
                    default_limit = max(1, int(raw_default))
                except (TypeError, ValueError):
                    default_limit = 20
        except Exception:
            default_limit = None
        usage = QuotaMixin.usage_map(day)
        out: dict[str, dict[str, Any]] = {}
        for u in users:
            uid = str(u.get("id"))
            if QuotaMixin._is_unlimited(u):
                out[uid] = QuotaMixin._unlimited_status()
                continue
            plan = None
            try:
                plan = QuotaMixin._plan_from_user(u, orders, plans=plans, default_limit=default_limit)
            except Exception:
                plan = None
            out[uid] = QuotaMixin._status_from_plan(plan, usage.get(uid, 0))
        return out

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
        """Daily-only. User tanpa paket harian = tanpa batas (tidak pernah habis)."""
        from backend.database.db import DatabaseService

        uid = str(user.get("id"))
        if QuotaMixin._is_unlimited(user):
            return False  # tombol Unlimited per user
        plan = None
        try:
            orders = DatabaseService.list_orders(user_id=uid, limit=100)
            plan = QuotaMixin._plan_from_user(user, orders)
        except Exception:
            return True  # db error → jangan open-gate diam-diam
        if plan is None:
            return False  # unlimited — kuota kumulatif legacy tidak digunakan lagi
        if plan.get("expired"):
            return True  # masa aktif paket habis
        return DatabaseService.get_daily_usage(uid) >= int(plan["daily_limit"])
