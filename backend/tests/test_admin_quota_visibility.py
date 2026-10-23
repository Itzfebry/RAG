"""Regresi: panel admin harus memperlihatkan kuota HARIAN per user
(paket, batas, terpakai, sisa) — bukan kolom legacy `max_prompts` yang sudah
tidak dipakai backend.

Jalankan:
  python -m pytest backend/tests/test_admin_quota_visibility.py -q
"""

import os
import sys

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


def test_no_paid_order_uses_global_default_daily_quota(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 7})
    u = _user(db, "budi")

    st = db.status_map([u])[str(u["id"])]

    assert st["mode"] == "daily"
    assert st["daily_limit"] == 7
    assert st["plan_label"] == "Kuota Default"
    assert st["used_today"] == 0
    assert st["remaining"] == 7


def test_paid_order_sets_daily_limit_from_plan(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 7})
    u = _user(db, "budi")
    order = db.create_order(str(u["id"]), PLAN)
    db.set_order_status_paid(str(order["id"]), confirmed_by="admin")

    st = db.status_map([u])[str(u["id"])]

    assert st["mode"] == "daily"
    assert st["daily_limit"] == 100
    assert st["plan_label"] == "Paket 100 Prompt"


def test_status_map_reflects_usage_and_remaining(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 5})
    u = _user(db, "budi")

    for _ in range(3):
        assert db.try_consume_daily_prompt(str(u["id"]), 5) is True

    st = db.status_map([u])[str(u["id"])]

    assert st["used_today"] == 3
    assert st["remaining"] == 2


def test_unlimited_flag_wins_over_daily_plan(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 5})
    u = _user(db, "budi", unlimited=True)

    st = db.status_map([u])[str(u["id"])]

    assert st["mode"] == "unlimited"
    assert st["daily_limit"] is None
    assert st["remaining"] is None


def test_status_map_query_shape_matches_admin_list(db):
    """Field yang dibaca UsersTab harus ada di map ini."""
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 20})
    users = [_user(db, "budi"), _user(db, "siti")]
    m = db.status_map(users)

    for u in users:
        st = m[str(u["id"])]
        assert {"mode", "plan_label", "daily_limit", "used_today", "remaining", "quota_day"}.issubset(st)


def test_admin_list_users_payload_includes_quota(db, monkeypatch):
    """Endpoint /admin/users: setiap user membawa kuota harian nyata."""
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 12})
    _user(db, "budi")
    u2 = _user(db, "siti", unlimited=True)

    from backend.api import users as users_api

    monkeypatch.setattr(users_api, "DatabaseService", db)
    rows = users_api.admin_list_users(admin="admin")

    by_name = {r["username"]: r for r in rows}
    assert by_name["budi"]["quota"]["mode"] == "daily"
    assert by_name["budi"]["quota"]["daily_limit"] == 12
    assert by_name["budi"]["quota"]["remaining"] == 12
    assert by_name["budi"]["quota"]["plan_label"] == "Kuota Default"
    assert by_name["siti"]["quota"]["mode"] == "unlimited"
    assert by_name["siti"]["quota"]["daily_limit"] is None
    # password_hash tidak boleh bocor
    assert "password_hash" not in by_name["budi"]
