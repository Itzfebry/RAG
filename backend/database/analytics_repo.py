import contextlib
from datetime import datetime
from typing import Any


class UsageMixin:
    # ── Analytics: daily requests + model latency ──
    @staticmethod
    def _events_file() -> str:
        return "request_events.json"

    @staticmethod
    def _latency_file() -> str:
        return "model_latency.json"

    @staticmethod
    def _token_file() -> str:
        return "token_usage.json"

    @staticmethod
    def _load_token_data() -> dict[str, Any]:
        """Bentuk data sama dengan token_usage.json: budget, daily, by_user."""
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

        if supabase_client:
            try:
                rows = (
                    supabase_client.table("token_usage")
                    .select("day,owner,prompt,completion")
                    .limit(10000)
                    .execute()
                    .data
                    or []
                )
                bud = supabase_client.table("token_budget").select("budget").eq("id", 1).limit(1).execute().data or []
                data: dict[str, Any] = {
                    "budget": int(bud[0].get("budget", 0) or 0) if bud else 0,
                    "daily": {},
                    "by_user": {},
                }
                for r in rows:
                    day, owner = str(r["day"]), str(r["owner"])
                    p, c = int(r.get("prompt", 0) or 0), int(r.get("completion", 0) or 0)
                    d = data["daily"].setdefault(day, {"prompt": 0, "completion": 0, "total": 0})
                    d["prompt"] += p
                    d["completion"] += c
                    d["total"] += p + c
                    u = data["by_user"].setdefault(owner, {"prompt": 0, "completion": 0, "total": 0, "daily": {}})
                    u["prompt"] += p
                    u["completion"] += c
                    u["total"] += p + c
                    u["daily"][day] = {"prompt": p, "completion": c, "total": p + c}
                return data
            except Exception:
                pass
        return _read_local_json(DatabaseService._token_file(), {})

    @staticmethod
    def record_token_usage(owner: str, prompt_tokens: int, completion_tokens: int):
        """Agregasi token per hari + per owner (Supabase token_usage, fallback JSON lokal)."""
        from backend.database.db import DatabaseService, _counter_lock

        with _counter_lock:
            DatabaseService._record_token_usage_locked(owner, prompt_tokens, completion_tokens)

    @staticmethod
    def _record_token_usage_locked(owner: str, prompt_tokens: int, completion_tokens: int):
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, supabase_client

        try:
            p = max(0, int(prompt_tokens or 0))
            c = max(0, int(completion_tokens or 0))
            if p == 0 and c == 0:
                return
            day = datetime.now().date().isoformat()
            if supabase_client:
                try:
                    cur = (
                        supabase_client.table("token_usage")
                        .select("prompt,completion")
                        .eq("day", day)
                        .eq("owner", owner)
                        .limit(1)
                        .execute()
                        .data
                        or []
                    )
                    base_p = int(cur[0].get("prompt", 0) or 0) if cur else 0
                    base_c = int(cur[0].get("completion", 0) or 0) if cur else 0
                    supabase_client.table("token_usage").upsert(
                        {"day": day, "owner": owner, "prompt": base_p + p, "completion": base_c + c},
                        on_conflict="day,owner",
                    ).execute()
                    return
                except Exception:
                    pass
            data = _read_local_json(DatabaseService._token_file(), {})
            data.setdefault("budget", 0)
            # harian global
            daily = data.setdefault("daily", {})
            cur = daily.get(day) or {"prompt": 0, "completion": 0}
            np_ = int(cur.get("prompt", 0)) + p
            nc_ = int(cur.get("completion", 0)) + c
            daily[day] = {"prompt": np_, "completion": nc_, "total": np_ + nc_}
            if len(daily) > 120:
                for k in sorted(daily.keys())[:-120]:
                    daily.pop(k, None)
            # per user (owner = user_id atau "trial:<ip>")
            bu = data.setdefault("by_user", {})
            u = bu.setdefault(owner, {"prompt": 0, "completion": 0, "total": 0, "daily": {}})
            u["prompt"] = int(u.get("prompt", 0)) + p
            u["completion"] = int(u.get("completion", 0)) + c
            u["total"] = int(u.get("total", 0)) + p + c
            ud = u.setdefault("daily", {})
            ucur = ud.get(day) or {"prompt": 0, "completion": 0}
            unp = int(ucur.get("prompt", 0)) + p
            unc = int(ucur.get("completion", 0)) + c
            ud[day] = {"prompt": unp, "completion": unc, "total": unp + unc}
            if len(ud) > 120:
                for k in sorted(ud.keys())[:-120]:
                    ud.pop(k, None)
            _write_local_json(DatabaseService._token_file(), data)
        except Exception:
            pass

    @staticmethod
    def get_token_stats(days: int = 14) -> dict[str, Any]:
        from datetime import timedelta

        from backend.database.db import DatabaseService

        days = max(1, min(120, int(days)))
        data = DatabaseService._load_token_data()
        daily: dict[str, Any] = data.get("daily") or {}
        by_user: dict[str, Any] = data.get("by_user") or {}
        today = datetime.now().date()
        daily_out: list[dict[str, Any]] = []
        for i in range(days - 1, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            row = daily.get(d) or {"prompt": 0, "completion": 0}
            pr = int(row.get("prompt", 0) or 0)
            co = int(row.get("completion", 0) or 0)
            daily_out.append({"day": d, "prompt": pr, "completion": co, "total": pr + co})
        t = daily.get(today.isoformat()) or {}
        y = daily.get((today - timedelta(days=1)).isoformat()) or {}
        total_p = sum(int(v.get("prompt", 0) or 0) for v in daily.values())
        total_c = sum(int(v.get("completion", 0) or 0) for v in daily.values())
        by_out: list[dict[str, Any]] = []
        for owner, u in by_user.items():
            ud = (u.get("daily") or {}).get(today.isoformat()) or {}
            by_out.append(
                {
                    "owner": owner,
                    "prompt": int(u.get("prompt", 0) or 0),
                    "completion": int(u.get("completion", 0) or 0),
                    "total": int(u.get("total", 0) or 0),
                    "today": int(ud.get("total", 0) or 0),
                }
            )
        by_out.sort(key=lambda x: x["total"], reverse=True)
        budget = int(data.get("budget", 0) or 0)
        today_total = int(t.get("total", 0) or 0) or (int(t.get("prompt", 0) or 0) + int(t.get("completion", 0) or 0))
        y_total = int(y.get("total", 0) or 0) or (int(y.get("prompt", 0) or 0) + int(y.get("completion", 0) or 0))
        return {
            "daily": daily_out,
            "today": {
                "prompt": int(t.get("prompt", 0) or 0),
                "completion": int(t.get("completion", 0) or 0),
                "total": today_total,
            },
            "yesterday": {
                "prompt": int(y.get("prompt", 0) or 0),
                "completion": int(y.get("completion", 0) or 0),
                "total": y_total,
            },
            "total": {"prompt": total_p, "completion": total_c, "total": total_p + total_c},
            "budget": budget,
            "remaining": (budget - today_total) if budget > 0 else None,
            "by_user": by_out,
        }

    @staticmethod
    def set_token_budget(budget: int) -> int:
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, supabase_client

        value = max(0, int(budget or 0))
        if supabase_client:
            try:
                supabase_client.table("token_budget").upsert(
                    {"id": 1, "budget": value, "updated_at": datetime.now().isoformat()},
                    on_conflict="id",
                ).execute()
                return value
            except Exception:
                pass
        data = _read_local_json(DatabaseService._token_file(), {})
        data["budget"] = value
        _write_local_json(DatabaseService._token_file(), data)
        return value

    @staticmethod
    def record_request_event(model: str | None = None, latency_ms: int | None = None):
        from backend.database.db import DatabaseService, _read_local_json, _write_local_json, supabase_client

        try:
            day = datetime.now().date().isoformat()
            events = _read_local_json(DatabaseService._events_file(), {})
            events[day] = int(events.get(day, 0) or 0) + 1
            # keep last 365 days for week/month/year views
            if len(events) > 365:
                for k in sorted(events.keys())[:-365]:
                    events.pop(k, None)
            _write_local_json(DatabaseService._events_file(), events)
            if supabase_client:
                with contextlib.suppress(Exception):
                    supabase_client.table("request_events").upsert(
                        {"day": day, "count": events[day]}, on_conflict="day"
                    ).execute()
            if model and latency_ms is not None:
                lats = _read_local_json(DatabaseService._latency_file(), {})
                # store per-day per-model samples aggregated: count + sum
                key = f"{day}::{model}"
                cur = lats.get(key) or {"count": 0, "sum_ms": 0}
                lats[key] = {
                    "count": int(cur.get("count", 0)) + 1,
                    "sum_ms": int(cur.get("sum_ms", 0)) + int(latency_ms),
                }
                # buang sample > 60 hari (key = "YYYY-MM-DD::model")
                _cutoff = (datetime.now().date() - __import__("datetime").timedelta(days=60)).isoformat()
                for _k in [k for k in lats if k.split("::", 1)[0] < _cutoff]:
                    lats.pop(_k, None)
                _write_local_json(DatabaseService._latency_file(), lats)
                if supabase_client:
                    with contextlib.suppress(Exception):
                        supabase_client.table("model_latency").upsert(
                            {
                                "key": key,
                                "day": day,
                                "model": model,
                                "count": lats[key]["count"],
                                "sum_ms": lats[key]["sum_ms"],
                            },
                            on_conflict="key",
                        ).execute()
        except Exception:
            pass

    @staticmethod
    def get_daily_requests(days: int = 14) -> list[dict[str, Any]]:
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

        days = max(1, min(365, int(days)))
        events: dict[str, int] = {}
        if supabase_client:
            try:
                res = supabase_client.table("request_events").select("day,count").execute()
                if res.data:
                    for r in res.data:
                        events[str(r.get("day"))] = int(r.get("count", 0) or 0)
            except Exception:
                pass
        if not events:
            events = _read_local_json(DatabaseService._events_file(), {})
        today = datetime.now().date()
        out: list[dict[str, Any]] = []
        for i in range(days - 1, -1, -1):
            d = (today - __import__("datetime").timedelta(days=i)).isoformat()
            out.append({"day": d, "count": int(events.get(d, 0) or 0)})
        return out

    @staticmethod
    def get_aggregated_requests(period: str = "day", limit: int = 14) -> list[dict[str, Any]]:
        """Aggregate daily events into week/month/year buckets. Returns left-to-right chronological."""
        from backend.database.db import DatabaseService

        daily = DatabaseService.get_daily_requests(days=365)
        if period == "day":
            return daily[-max(1, min(60, int(limit))) :]
        # week: Monday-start ISO weeks
        buckets: dict[str, int] = {}
        order: list[str] = []
        for r in daily:
            d = datetime.strptime(r["day"], "%Y-%m-%d").date()
            if period == "week":
                monday = d - __import__("datetime").timedelta(days=d.weekday())
                key = monday.isoformat()
            elif period == "month":
                key = d.strftime("%Y-%m")
            elif period == "year":
                key = d.strftime("%Y")
            else:
                key = r["day"]
            if key not in buckets:
                buckets[key] = 0
                order.append(key)
            buckets[key] += int(r.get("count", 0) or 0)
        # keep last N buckets
        tail_keys = order[-max(1, min(60, int(limit))) :]
        return [{"day": k, "count": buckets[k]} for k in tail_keys]

    @staticmethod
    def get_aggregated_latency(period: str = "day", limit: int = 14) -> list[dict[str, Any]]:
        """Aggregate per-day latency buckets into week/month/year."""
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

        # Re-aggregate dari raw model_latency
        lats_raw: dict[str, dict[str, Any]] = {}
        if supabase_client:
            try:
                res = supabase_client.table("model_latency").select("key,day,model,count,sum_ms").execute()
                if res.data:
                    for r in res.data:
                        lats_raw[str(r.get("key"))] = {
                            "count": int(r.get("count", 0)),
                            "sum_ms": int(r.get("sum_ms", 0)),
                            "day": str(r.get("day")),
                            "model": str(r.get("model")),
                        }
            except Exception:
                pass
        if not lats_raw:
            raw = _read_local_json(DatabaseService._latency_file(), {})
            for k, v in (raw or {}).items():
                if isinstance(v, dict):
                    parts = k.split("::", 1)
                    lats_raw[k] = {
                        "count": int(v.get("count", 0)),
                        "sum_ms": int(v.get("sum_ms", 0)),
                        "day": parts[0] if parts else "",
                        "model": parts[1] if len(parts) > 1 else k,
                    }
        # bucket by period
        from collections import defaultdict

        bucket_models: dict[str, dict[str, dict[str, int]]] = defaultdict(
            lambda: defaultdict(lambda: {"count": 0, "sum_ms": 0})
        )
        bucket_days: dict[str, set] = defaultdict(set)
        for v in lats_raw.values():
            try:
                d = datetime.strptime(v.get("day", ""), "%Y-%m-%d").date()
            except Exception:
                continue
            if period == "day":
                key = v.get("day", "")
            elif period == "week":
                monday = d - __import__("datetime").timedelta(days=d.weekday())
                key = monday.isoformat()
            elif period == "month":
                key = d.strftime("%Y-%m")
            elif period == "year":
                key = d.strftime("%Y")
            else:
                key = v.get("day", "")
            model = v.get("model", "unknown")
            bucket_models[key][model]["count"] += int(v.get("count", 0) or 0)
            bucket_models[key][model]["sum_ms"] += int(v.get("sum_ms", 0) or 0)
            bucket_days[key].add(v.get("day", ""))
        # order keys chronologically
        keys = sorted(bucket_models.keys())
        keys = keys[-max(1, min(60, int(limit))) :]
        out: list[dict[str, Any]] = []
        for k in keys:
            per_model = []
            total_c = 0
            total_s = 0
            for model, vals in bucket_models[k].items():
                c = int(vals["count"] or 0)
                s = int(vals["sum_ms"] or 0)
                total_c += c
                total_s += s
                per_model.append({"model": model, "avg_ms": round(s / max(1, c)), "count": c})
            per_model.sort(key=lambda x: x["avg_ms"])
            avg = round(total_s / total_c) if total_c else None
            out.append({"day": k, "avg_ms": avg, "models": per_model})
        # if no data yet but period=day, return days with nulls so chart shows timeline
        if not out and period == "day":
            return DatabaseService.get_model_latency(days=limit)
        return out

    @staticmethod
    def get_model_latency(days: int = 14) -> list[dict[str, Any]]:
        from backend.database.db import DatabaseService, _read_local_json, supabase_client

        days = max(1, min(60, int(days)))
        lats: dict[str, dict[str, Any]] = {}
        if supabase_client:
            try:
                res = supabase_client.table("model_latency").select("key,day,model,count,sum_ms").execute()
                if res.data:
                    for r in res.data:
                        lats[str(r.get("key"))] = {
                            "count": int(r.get("count", 0)),
                            "sum_ms": int(r.get("sum_ms", 0)),
                            "day": str(r.get("day")),
                            "model": str(r.get("model")),
                        }
            except Exception:
                pass
        if not lats:
            raw = _read_local_json(DatabaseService._latency_file(), {})
            for k, v in (raw or {}).items():
                if isinstance(v, dict):
                    # parse key day::model
                    parts = k.split("::", 1)
                    lats[k] = {
                        "count": int(v.get("count", 0)),
                        "sum_ms": int(v.get("sum_ms", 0)),
                        "day": parts[0] if parts else "",
                        "model": parts[1] if len(parts) > 1 else k,
                    }
        # aggregate per day: avg latency across models, and per-model avg
        today = datetime.now().date()
        days_list = [(today - __import__("datetime").timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
        by_day: dict[str, list[dict[str, Any]]] = {d: [] for d in days_list}
        for v in lats.values():
            d = v.get("day")
            if d in by_day:
                by_day[d].append(v)
        # output: per day avg latency + per-model breakdown
        out: list[dict[str, Any]] = []
        for d in days_list:
            vals = by_day[d]
            if not vals:
                out.append({"day": d, "avg_ms": None, "models": []})
            else:
                total_c = sum(int(x.get("count", 0) or 0) for x in vals)
                total_s = sum(int(x.get("sum_ms", 0) or 0) for x in vals)
                avg = round(total_s / total_c) if total_c else None
                per_model = [
                    {
                        "model": x.get("model"),
                        "avg_ms": round(int(x.get("sum_ms", 0)) / max(1, int(x.get("count", 0)))),
                        "count": int(x.get("count", 0)),
                    }
                    for x in vals
                ]
                per_model.sort(key=lambda x: x["avg_ms"])
                out.append({"day": d, "avg_ms": avg, "models": per_model})
        return out
