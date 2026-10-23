import uuid
from datetime import datetime, timedelta
from typing import Any

MAX_PLAN_DAYS = 3650

# Kolom order yang dibutuhkan resolusi kuota — `select("*")` ikut menarik `proof`
# (base64 screenshot pembayaran) sehingga payload admin bisa membengkak.
ORDER_QUOTA_COLUMNS = "id,user_id,plan_id,status,paid_at,days,created_at"


def _project_order(row: dict[str, Any], columns: str | None) -> dict[str, Any]:
    """Batasi field order sesuai `columns` (None = apa adanya)."""
    if not columns or not isinstance(row, dict):
        return row
    wanted = [c.strip() for c in columns.split(",") if c.strip()]
    return {k: row.get(k) for k in wanted}


def parse_dt(value: Any) -> datetime | None:
    """Parse ISO timestamp (mis. order.paid_at). None bila tidak valid."""
    try:
        s = str(value or "").strip()
        return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None
    except Exception:
        return None


def order_expiry(order: dict[str, Any]) -> tuple[bool, datetime | None]:
    """(expired, expiry_dt) untuk satu order.

    Masa aktif dihitung dari `paid_at + days` hari. days = 0/kosong (order
    legacy) => tidak pernah expired. Timestamp paid_at disimpan naive lokal;
    bila punya tzinfo, bandingkan di zona yang sama.
    """
    try:
        days = int(order.get("days") or 0)
    except Exception:
        days = 0
    if days <= 0:
        return False, None
    paid = parse_dt(order.get("paid_at"))
    if paid is None:
        return False, None
    expiry = paid + timedelta(days=days)
    now = datetime.now(expiry.tzinfo) if expiry.tzinfo else datetime.now()
    return now >= expiry, expiry


class BillingMixin:
    @staticmethod
    def _orders_file() -> str:
        return "orders.json"

    @staticmethod
    def get_pricing() -> dict[str, Any]:
        from backend.database.db import DatabaseService

        return DatabaseService.get_config_table("pricing_config")

    @staticmethod
    def update_pricing(patch: dict[str, Any]) -> dict[str, Any]:
        from backend.database.db import DatabaseService

        current = DatabaseService.get_pricing()
        current.update(patch)
        return DatabaseService.update_config_table("pricing_config", current)

    @staticmethod
    def find_plan(plan_id: str) -> dict[str, Any] | None:
        from backend.database.db import DatabaseService

        for p in DatabaseService.get_pricing().get("plans") or []:
            if isinstance(p, dict) and str(p.get("id")) == str(plan_id):
                return p
        return None

    @staticmethod
    def create_order(user_id: str, plan: dict[str, Any], note: str = "", proof: str = "") -> dict[str, Any]:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        now = datetime.now().isoformat()
        row = {
            "id": str(uuid.uuid4()),
            "user_id": str(user_id),
            "plan_id": str(plan.get("id")),
            "plan_label": str(plan.get("label") or plan.get("id")),
            "prompts": int(plan.get("prompts") or 0),
            "days": int(plan.get("days") or 0),
            "amount": int(plan.get("amount") or 0),
            "status": "pending",
            "note": note,
            "proof": proof,
            "created_at": now,
            "paid_at": None,
            "confirmed_by": None,
            "updated_at": now,
        }
        if supabase_client:
            try:
                res = supabase_client.table("orders").insert(row).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error creating order in Supabase: {e}")
        orders = _read_local_json(DatabaseService._orders_file(), [])
        orders.append(row)
        _write_local_json(DatabaseService._orders_file(), orders)
        return row

    @staticmethod
    def list_orders(user_id: str | None = None, limit: int = 100, columns: str | None = None) -> list[dict[str, Any]]:
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        lim = max(1, min(500, int(limit or 100)))
        if supabase_client:
            try:
                q = supabase_client.table("orders").select(columns or "*")
                if user_id is not None:
                    q = q.eq("user_id", str(user_id))
                res = q.order("created_at", desc=True).limit(lim).execute()
                if res.data is not None:
                    return [_project_order(o, columns) for o in res.data]
            except Exception as e:
                logger.warning(f"Error listing orders in Supabase: {e}")
        rows = _read_local_json(DatabaseService._orders_file(), [])
        if user_id is not None:
            rows = [o for o in rows if str(o.get("user_id")) == str(user_id)]
        rows = sorted(rows, key=lambda o: str(o.get("created_at") or ""), reverse=True)
        return [_project_order(o, columns) for o in rows[:lim]]

    @staticmethod
    def get_order(order_id: str) -> dict[str, Any] | None:
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        if supabase_client:
            try:
                res = supabase_client.table("orders").select("*").eq("id", str(order_id)).limit(1).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error reading order in Supabase: {e}")
        for o in _read_local_json(DatabaseService._orders_file(), []):
            if str(o.get("id")) == str(order_id):
                return o
        return None

    @staticmethod
    def set_order_status_paid(order_id: str, confirmed_by: str | None = None) -> bool:
        """Transisi kondisional pending -> paid; True hanya jika transisi terjadi.

        Guard `.eq("status", "pending")` mencegah double-grant kuota saat dua
        jalur (callback gateway dan admin confirm) memproses order yang sama
        hampir bersamaan: hanya jalur yang berhasil meng-update yang boleh
        menambah kuota (lihat _grant_order_quota di api/pricing.py).
        """
        from backend.database.core import _read_local_json, _write_local_json
        from backend.database.db import DatabaseService, logger, supabase_client

        now = datetime.now().isoformat()
        patch: dict[str, Any] = {
            "status": "paid",
            "paid_at": now,
            "confirmed_by": confirmed_by,
            "updated_at": now,
        }
        if supabase_client:
            try:
                res = (
                    supabase_client.table("orders")
                    .update(patch)
                    .eq("id", str(order_id))
                    .eq("status", "pending")
                    .execute()
                )
                # Supabase mengembalikan baris yang kena update; kosong = order
                # bukan pending lagi (sudah paid/cancelled oleh jalur lain).
                return bool(res.data)
            except Exception as e:
                logger.warning(f"Error updating order in Supabase: {e}")
        # Fallback dev (tanpa Supabase): transisi menang bila masih pending.
        orders = _read_local_json(DatabaseService._orders_file(), [])
        for o in orders:
            if str(o.get("id")) == str(order_id):
                if str(o.get("status") or "") != "pending":
                    return False
                o.update(patch)
                _write_local_json(DatabaseService._orders_file(), orders)
                return True
        return False

    @staticmethod
    def set_order_status(order_id: str, status: str, confirmed_by: str | None = None) -> dict[str, Any] | None:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        if status not in ("pending", "paid", "cancelled"):
            raise ValueError("invalid status")
        now = datetime.now().isoformat()
        patch: dict[str, Any] = {"status": status, "updated_at": now}
        if status == "paid":
            patch["paid_at"] = now
            patch["confirmed_by"] = confirmed_by
        if supabase_client:
            try:
                res = supabase_client.table("orders").update(patch).eq("id", str(order_id)).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error updating order in Supabase: {e}")
        orders = _read_local_json(DatabaseService._orders_file(), [])
        for o in orders:
            if str(o.get("id")) == str(order_id):
                o.update(patch)
                _write_local_json(DatabaseService._orders_file(), orders)
                return o
        return None

    @staticmethod
    def update_order(order_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        """Patch field order (mis. simpan reference invoice gateway di `proof`)."""
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, logger, supabase_client

        if supabase_client:
            try:
                res = supabase_client.table("orders").update(patch).eq("id", str(order_id)).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Error updating order in Supabase: {e}")
        orders = _read_local_json(DatabaseService._orders_file(), [])
        for o in orders:
            if str(o.get("id")) == str(order_id):
                o.update(patch)
                _write_local_json(DatabaseService._orders_file(), orders)
                return o
        return None

    @staticmethod
    def count_orders_by_status() -> dict[str, int]:
        from backend.database.db import DatabaseService

        out = {"pending": 0, "paid": 0, "cancelled": 0}
        for o in DatabaseService.list_orders(limit=500):
            s = str(o.get("status") or "pending")
            if s in out:
                out[s] += 1
        return out
