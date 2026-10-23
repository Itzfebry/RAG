"""Regresi: grant kuota manual admin + status langganan per user.

Grant manual (angka + paket) menang atas paket paid & kuota default, tapi kalah
dari flag Unlimited. Status langganan: tanpa paket paid & tanpa grant manual =
"tidak berlangganan" (plan_source == "default").

Jalankan:
  python -m pytest backend/tests/test_admin_manual_quota.py -q
"""

import os
import sys
from datetime import datetime, timedelta

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
os.environ.setdefault("ADMIN_PASSWORD_HASH", "$2b$12$abcdefghijklmnopqrstuuS4pU0CxAAKx4tVhKq8yjLaQG9m7kyK6")

PLAN = {"id": "100", "label": "Paket 100 Prompt", "prompts": 100, "amount": 30000, "popular": False}


@pytest.fixture
def db(tmp_path, monkeypatch):
    from backend.database import db as m

    monkeypatch.setattr(m, "supabase_client", None)
    monkeypatch.setattr(m, "LOCAL_DATA_DIR", str(tmp_path))
    m.config_cache.clear()
    return m.DatabaseService


def _user(db, username, **extra):
    data = {"username": username, "password_hash": "x", "max_prompts": 0, "prompts_used": 0}
    data.update(extra)
    return db.create_user(data)


def test_no_plan_no_grant_is_not_subscribed(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    u = _user(db, "budi")

    st = db.status_map([u])[str(u["id"])]

    assert st["plan_source"] == "default"
    assert st["subscribed"] is False


def test_paid_order_marks_subscribed(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    u = _user(db, "budi")
    order = db.create_order(str(u["id"]), PLAN)
    db.set_order_status_paid(str(order["id"]), confirmed_by="admin")

    st = db.status_map([u])[str(u["id"])]

    assert st["subscribed"] is True
    assert st["plan_source"] == "plan"
    assert st["daily_limit"] == 100


def test_manual_grant_beats_paid_order_and_default(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    u = _user(db, "budi")
    order = db.create_order(str(u["id"]), PLAN)
    db.set_order_status_paid(str(order["id"]), confirmed_by="admin")

    db.update_user(str(u["id"]), {"manual_daily_limit": 7, "manual_plan_label": "Bonus manual"})
    fresh = db.get_user_by_id(str(u["id"]))

    st = db.status_map([fresh])[str(fresh["id"])]

    assert st["plan_source"] == "manual"
    assert st["subscribed"] is True
    assert st["daily_limit"] == 7
    assert st["plan_label"] == "Bonus manual"


def test_manual_grant_when_no_paid_order(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 3})
    u = _user(db, "siti")
    db.update_user(str(u["id"]), {"manual_daily_limit": 500, "manual_plan_label": "Paket 500 (manual)"})
    fresh = db.get_user_by_id(str(u["id"]))

    st = db.status_map([fresh])[str(fresh["id"])]

    assert st["mode"] == "daily"
    assert st["daily_limit"] == 500
    assert st["subscribed"] is True


def test_manual_grant_expiry_zeroes_remaining(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    u = _user(db, "budi")
    past = (datetime.now() - timedelta(days=1)).isoformat()
    db.update_user(str(u["id"]), {"manual_daily_limit": 9, "manual_expires_at": past})
    fresh = db.get_user_by_id(str(u["id"]))

    st = db.status_map([fresh])[str(fresh["id"])]

    assert st["mode"] == "expired"
    assert st["remaining"] == 0


def test_manual_grant_future_expiry_sets_days_left(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    u = _user(db, "budi")
    future = (datetime.now() + timedelta(days=5)).isoformat()
    db.update_user(str(u["id"]), {"manual_daily_limit": 9, "manual_expires_at": future})
    fresh = db.get_user_by_id(str(u["id"]))

    st = db.status_map([fresh])[str(fresh["id"])]

    assert st["mode"] == "daily"
    assert st["plan_days_left"] == 5


def test_unlimited_flag_beats_manual_grant(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    u = _user(db, "budi", unlimited=True)
    db.update_user(str(u["id"]), {"manual_daily_limit": 4})
    fresh = db.get_user_by_id(str(u["id"]))

    st = db.status_map([fresh])[str(fresh["id"])]

    assert st["mode"] == "unlimited"
    assert st["daily_limit"] is None


def test_chat_gating_uses_manual_grant(db):
    """is_prompt_quota_exhausted harus ikut grant manual, bukan default global."""
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    u = _user(db, "budi")
    db.update_user(str(u["id"]), {"manual_daily_limit": 2, "manual_plan_label": "Manual"})
    fresh = db.get_user_by_id(str(u["id"]))

    assert db.is_prompt_quota_exhausted(fresh) is False
    assert db.try_consume_daily_prompt(str(u["id"]), 2) is True
    assert db.try_consume_daily_prompt(str(u["id"]), 2) is True
    assert db.try_consume_daily_prompt(str(u["id"]), 2) is False
    assert db.is_prompt_quota_exhausted(fresh) is True


def test_grant_endpoint_sets_quota_and_returns_status(db, monkeypatch):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    u = _user(db, "budi")

    from backend.api import users as users_api

    monkeypatch.setattr(users_api, "DatabaseService", db)
    res = users_api.admin_grant_user_quota(
        str(u["id"]),
        users_api.UserQuotaGrantRequest(prompts=250, plan_id="100", days=3),
        request=_fake_request(),
        admin="admin",
    )

    assert res["status"] == "success"
    assert res["user"]["manual_daily_limit"] == 250
    assert "(manual)" in res["user"]["manual_plan_label"]
    assert res["user"]["manual_expires_at"] is not None
    assert res["quota"]["daily_limit"] == 250
    assert res["quota"]["subscribed"] is True


def test_grant_endpoint_rejects_unknown_plan(db, monkeypatch):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    u = _user(db, "budi")

    from fastapi import HTTPException

    from backend.api import users as users_api

    monkeypatch.setattr(users_api, "DatabaseService", db)
    with pytest.raises(HTTPException) as exc:
        users_api.admin_grant_user_quota(
            str(u["id"]),
            users_api.UserQuotaGrantRequest(prompts=10, plan_id="tidak-ada"),
            request=_fake_request(),
            admin="admin",
        )
    assert exc.value.status_code == 400


def test_clear_endpoint_reverts_to_default(db, monkeypatch):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    u = _user(db, "budi")
    db.update_user(str(u["id"]), {"manual_daily_limit": 250, "manual_plan_label": "Manual"})

    from backend.api import users as users_api

    monkeypatch.setattr(users_api, "DatabaseService", db)
    res = users_api.admin_clear_user_quota(str(u["id"]), request=_fake_request(), admin="admin")

    assert res["status"] == "success"
    assert res["quota"]["plan_source"] == "default"
    assert res["quota"]["daily_limit"] == 20
    assert res["quota"]["subscribed"] is False


def _fake_request():
    class _Req:
        headers: dict
        client = None
        query_params: dict

        def __init__(self):
            self.headers = {}
            self.query_params = {}
            self.client = None

    return _Req()
