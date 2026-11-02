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


def test_no_paid_order_uses_global_default_total_quota(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 7})
    u = _user(db, "budi")

    st = db.status_map([u])[str(u["id"])]

    # Non-subscriber: kuota gratis kumulatif, tanpa reset harian.
    assert st["mode"] == "total"
    assert st["period"] == "total"
    assert st["daily_limit"] == 7
    assert st["plan_label"] == "Kuota Gratis"
    assert st["used_today"] == 0
    assert st["remaining"] == 7
    assert st["next_reset_wib"] is None


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

    from backend.database.quota_repo import TOTAL_USAGE_KEY

    for _ in range(3):
        assert db.try_consume_daily_prompt(str(u["id"]), 5, TOTAL_USAGE_KEY) is True

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
    assert by_name["budi"]["quota"]["mode"] == "total"
    assert by_name["budi"]["quota"]["daily_limit"] == 12
    assert by_name["budi"]["quota"]["remaining"] == 12
    assert by_name["budi"]["quota"]["plan_label"] == "Kuota Gratis"
    assert by_name["siti"]["quota"]["mode"] == "unlimited"
    assert by_name["siti"]["quota"]["daily_limit"] is None
    # password_hash tidak boleh bocor
    assert "password_hash" not in by_name["budi"]


def test_free_quota_accumulates_without_daily_reset(db):
    """Non-subscriber: pemakaian tersimpan di kunci `free-total`, bukan tanggal."""
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 10})
    u = _user(db, "budi")

    from backend.database.quota_repo import TOTAL_USAGE_KEY

    assert db.try_consume_daily_prompt(str(u["id"]), 10, TOTAL_USAGE_KEY) is True
    assert db.get_daily_usage(str(u["id"]), TOTAL_USAGE_KEY) == 1
    st = db.get_quota_status(db.get_user_by_id(str(u["id"])))
    assert st["mode"] == "total"
    assert st["used_today"] == 1
    assert st["remaining"] == 9


def test_doc_access_default_denied(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 10})
    u = _user(db, "budi")
    assert db.can_use_document_feature(u) is False
    assert db.status_map([u])[str(u["id"])]["doc_access"] is False


def test_doc_access_plan_requires_doc_upload_flag(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 10})
    u = _user(db, "budi")
    order = db.create_order(str(u["id"]), PLAN)
    db.set_order_status_paid(str(order["id"]), confirmed_by="admin")
    assert db.can_use_document_feature(db.get_user_by_id(str(u["id"]))) is False

    db.update_pricing({"plans": [{**PLAN, "doc_upload": True}], "default_daily_prompts": 10})
    assert db.can_use_document_feature(db.get_user_by_id(str(u["id"]))) is True


def test_doc_access_manual_and_unlimited_allowed(db):
    db.update_pricing({"plans": [PLAN], "default_daily_prompts": 10})
    manual = _user(db, "siti")
    db.update_user(str(manual["id"]), {"manual_daily_limit": 5, "manual_plan_label": "Manual"})
    assert db.can_use_document_feature(db.get_user_by_id(str(manual["id"]))) is True

    unlimited = _user(db, "joko", unlimited=True)
    assert db.can_use_document_feature(unlimited) is True
