import uuid
from datetime import datetime
from typing import Any


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
    def list_orders(user_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        from backend.database.db import DatabaseService, _read_local_json, logger, supabase_client

        lim = max(1, min(500, int(limit or 100)))
        if supabase_client:
            try:
                q = supabase_client.table("orders").select("*")
                if user_id is not None:
                    q = q.eq("user_id", str(user_id))
                res = q.order("created_at", desc=True).limit(lim).execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                logger.warning(f"Error listing orders in Supabase: {e}")
        rows = _read_local_json(DatabaseService._orders_file(), [])
        if user_id is not None:
            rows = [o for o in rows if str(o.get("user_id")) == str(user_id)]
        rows = sorted(rows, key=lambda o: str(o.get("created_at") or ""), reverse=True)
        return rows[:lim]

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
