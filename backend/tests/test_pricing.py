"""Test unit fitur pricing: paket, order, aktivasi kuota via callback gateway.

Tanpa Supabase / provider LLM. Jalankan:
  python -m pytest backend/tests/test_pricing.py -q
"""
import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
os.environ.setdefault("ADMIN_PASSWORD_HASH", "$2b$12$abcdefghijklmnopqrstuuS4pU0CxAAKx4tVhKq8yjLaQG9m7kyK6")


@pytest.fixture
def db(tmp_path, monkeypatch):
    from backend.database import db as m

    monkeypatch.setattr(m, "supabase_client", None)
    monkeypatch.setattr(m, "LOCAL_DATA_DIR", str(tmp_path))
    # Gateway mati per default: test tidak boleh menyentuh jaringan Duitku.
    monkeypatch.delenv("DUITKU_MERCHANT_CODE", raising=False)
    monkeypatch.delenv("DUITKU_API_KEY", raising=False)
    m.config_cache.clear()
    return m.DatabaseService


DEFAULT_PLANS = [
    {"id": "100", "label": "Paket 100 Prompt", "prompts": 100, "amount": 30000, "popular": False},
    {"id": "200", "label": "Paket 200 Prompt", "prompts": 200, "amount": 50000, "popular": True},
]


def test_default_pricing_has_plans(db):
    pricing = db.get_pricing()
    ids = [p["id"] for p in pricing["plans"]]
    assert "100" in ids and "200" in ids and "1000" in ids


def test_find_plan_by_id(db):
    db.update_pricing({"plans": DEFAULT_PLANS})
    assert db.find_plan("200")["prompts"] == 200
    assert db.find_plan("nope") is None


def test_create_order_is_pending_with_snapshot(db):
    db.update_pricing({"plans": DEFAULT_PLANS})
    plan = db.find_plan("100")
    o = db.create_order("user-a", plan, note="test")
    assert o["status"] == "pending"
    assert o["prompts"] == 100
    assert o["amount"] == 30000
    assert o["plan_label"] == "Paket 100 Prompt"
    assert o["paid_at"] is None


def test_list_orders_scoped_per_user(db):
    db.update_pricing({"plans": DEFAULT_PLANS})
    db.create_order("user-a", db.find_plan("100"))
    db.create_order("user-b", db.find_plan("200"))
    rows = db.list_orders("user-a")
    assert len(rows) == 1
    assert rows[0]["user_id"] == "user-a"


def test_set_order_status_paid_stamps_fields(db):
    db.update_pricing({"plans": DEFAULT_PLANS})
    o = db.create_order("user-a", db.find_plan("100"))
    updated = db.set_order_status(o["id"], "paid", confirmed_by="admin")
    assert updated["status"] == "paid"
    assert updated["paid_at"]
    assert updated["confirmed_by"] == "admin"


def test_set_order_status_rejects_bad_value(db):
    db.update_pricing({"plans": DEFAULT_PLANS})
    o = db.create_order("user-a", db.find_plan("100"))
    with pytest.raises(ValueError):
        db.set_order_status(o["id"], "hacked")


def test_count_orders_by_status(db):
    db.update_pricing({"plans": DEFAULT_PLANS})
    o1 = db.create_order("user-a", db.find_plan("100"))
    db.create_order("user-b", db.find_plan("200"))
    db.set_order_status(o1["id"], "paid", confirmed_by="admin")
    counts = db.count_orders_by_status()
    assert counts["paid"] == 1
    assert counts["pending"] == 1


def test_confirm_endpoint_adds_prompts_and_is_idempotent(db, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api.admin import get_current_admin
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "buyer", "password_hash": "x", "max_prompts": 50, "prompts_used": 10, "is_active": True})
    order = db.create_order(str(user["id"]), db.find_plan("100"))

    app.dependency_overrides[get_current_admin] = lambda: "admin"
    try:
        client = TestClient(app)
        res = client.post(f"/api/admin/orders/{order['id']}/confirm")
        assert res.status_code == 200
        assert res.json()["max_prompts"] == 150
        assert db.get_user_by_id(str(user["id"]))["max_prompts"] == 150

        # konfirmasi kedua ditolak, kuota tidak dobel
        res2 = client.post(f"/api/admin/orders/{order['id']}/confirm")
        assert res2.status_code == 409
        assert db.get_user_by_id(str(user["id"]))["max_prompts"] == 150
    finally:
        app.dependency_overrides.clear()


def test_confirm_unlimited_user_does_not_add(db, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api.admin import get_current_admin
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "unlimited", "password_hash": "x", "max_prompts": 0, "prompts_used": 0, "is_active": True})
    order = db.create_order(str(user["id"]), db.find_plan("100"))

    app.dependency_overrides[get_current_admin] = lambda: "admin"
    try:
        client = TestClient(app)
        res = client.post(f"/api/admin/orders/{order['id']}/confirm")
        assert res.status_code == 200
        assert res.json()["max_prompts"] == 0
        assert db.get_order(order["id"])["status"] == "paid"
    finally:
        app.dependency_overrides.clear()


def test_public_pricing_filters_invalid_plans(db, monkeypatch):
    from backend.api import pricing as pricing_api

    monkeypatch.setattr(pricing_api.DatabaseService, "get_pricing", staticmethod(lambda: {
        "plans": [
            {"id": "ok", "label": "Valid", "prompts": 50, "amount": 10000},
            {"id": "zero", "label": "Bad", "prompts": 0, "amount": 10000},
            {"id": "", "label": "No id", "prompts": 10, "amount": 10000},
            "not-a-dict",
        ],
        "payment_qris": "",
        "payment_instructions": "",
        "contact": "",
        "order_note": "",
    }))
    out = pricing_api._public_pricing()
    assert [p["id"] for p in out["plans"]] == ["ok"]


def test_clean_plans_rejects_duplicates_and_bad_numbers():
    from backend.api import pricing as pricing_api
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        pricing_api._clean_plans([{"id": "a", "label": "A", "prompts": 1, "amount": 1000}, {"id": "a", "label": "B", "prompts": 1, "amount": 1000}])
    with pytest.raises(HTTPException):
        pricing_api._clean_plans([{"id": "b", "label": "B", "prompts": -5, "amount": 1000}])
    ok = pricing_api._clean_plans([{"id": "c", "label": "C", "prompts": 5, "amount": 1000}])
    assert ok[0]["id"] == "c"


def test_admin_update_accepts_large_qris_data_url(db, monkeypatch):
    """Regresi: data URL QRIS > 20000 char dulu ditolak 422 (gagal simpan)."""
    from fastapi.testclient import TestClient
    from backend.api.admin import get_current_admin
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    app.dependency_overrides[get_current_admin] = lambda: "admin"
    try:
        client = TestClient(app)
        big = "data:image/png;base64," + ("A" * 250_000)
        res = client.put("/api/admin/pricing", json={"plans": DEFAULT_PLANS, "payment_qris": big})
        assert res.status_code == 200
        assert res.json()["pricing"]["payment_qris"] == big
    finally:
        app.dependency_overrides.clear()


def test_admin_update_rejects_too_long_qris_with_field_message(db, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api.admin import get_current_admin
    from backend.api.main import app
    from backend.api.pricing import MAX_QRIS_CHARS

    db.update_pricing({"plans": DEFAULT_PLANS})
    app.dependency_overrides[get_current_admin] = lambda: "admin"
    try:
        client = TestClient(app)
        res = client.put("/api/admin/pricing", json={"plans": DEFAULT_PLANS, "payment_qris": "x" * (MAX_QRIS_CHARS + 10)})
        assert res.status_code == 422
        assert "QRIS" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_admin_update_rejects_too_many_plans_with_field_message(db, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api.admin import get_current_admin
    from backend.api.main import app
    from backend.api.pricing import MAX_PLANS

    db.update_pricing({"plans": DEFAULT_PLANS})
    app.dependency_overrides[get_current_admin] = lambda: "admin"
    try:
        client = TestClient(app)
        many = [{"id": f"p{i}", "label": f"P{i}", "prompts": 10, "amount": 1000} for i in range(MAX_PLANS + 1)]
        res = client.put("/api/admin/pricing", json={"plans": many})
        assert res.status_code == 422
        assert "paket" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


def test_validation_message_is_friendly():
    """Pesan 422 tidak boleh bocorkan struktur schema Pydantic (loc/ctx/type)."""
    from backend.api.main import _friendly_validation_error
    from fastapi.exceptions import RequestValidationError

    exc = RequestValidationError([{
        "type": "string_too_long",
        "loc": ("body", "payment_qris"),
        "msg": "String should have at most 600000 characters",
        "input": "secret-payload",
        "ctx": {"max_length": 600000},
    }])
    msg = _friendly_validation_error(exc)
    assert "QRIS" in msg
    assert "600000" in msg
    assert "loc" not in msg and "ctx" not in msg


def test_pricing_block_uses_live_config(db, monkeypatch):
    """Blok harga di system prompt harus ikut pricing_config, bukan hardcode KB."""
    from backend.knowledge import context_builder as cb

    db.update_pricing({"plans": [
        {"id": "77", "label": "Paket 77 Prompt", "prompts": 77, "amount": 77777, "popular": False},
    ], "contact": "WA 0800"})
    real = db.get_pricing
    monkeypatch.setattr(cb.DatabaseService, "get_pricing", staticmethod(lambda: real()))
    block = cb._build_pricing_block()
    assert "Paket 77 Prompt" in block
    assert "77.777" in block
    assert "WA 0800" in block
    assert "SUMBER RESMI" in block


def test_pricing_block_empty_when_no_plans(monkeypatch):
    from backend.knowledge import context_builder as cb
    monkeypatch.setattr(cb.DatabaseService, "get_pricing", staticmethod(lambda: {"plans": []}))
    assert cb._build_pricing_block() == ""


# ── alur bayar otomatis: user tidak boleh acc, callback gateway yang aktivasi ──

def _enable_gateway(monkeypatch, *, signature_ok: bool = True):
    from backend.api import pricing as pricing_api

    monkeypatch.setattr(pricing_api.duitku, "configured", lambda: True)
    monkeypatch.setattr(pricing_api.duitku, "verify_callback_signature", lambda *a, **k: signature_ok)


def _callback_payload(order, **over):
    body = {
        "merchantCode": "DTEST",
        "amount": str(order["amount"]),
        "merchantOrderId": str(order["id"]),
        "resultCode": "00",
        "reference": "REF123",
        "signature": "ab" * 32,
    }
    body.update(over)
    return body

def test_wa_link_normalizes_contact():
    from backend.api.pricing import wa_link

    assert wa_link("087776445013") == "https://wa.me/6287776445013"
    assert wa_link("62 877-7644-5013") == "https://wa.me/6287776445013"
    assert wa_link("87776445013") == "https://wa.me/6287776445013"
    assert wa_link("+62 877 7644 5013") == "https://wa.me/6287776445013"
    # Bukan nomor ID yang valid: email, teks acak, nomor terlalu pendek
    assert wa_link("admin@mail.com") == ""
    assert wa_link("WA 0800") == ""
    assert wa_link("") == ""


def test_public_pricing_exposes_contact_wa(db, monkeypatch):
    from backend.api import pricing as pricing_api

    monkeypatch.setattr(pricing_api.DatabaseService, "get_pricing", staticmethod(lambda: {
        "plans": [{"id": "ok", "label": "Valid", "prompts": 50, "amount": 10000}],
        "payment_qris": "",
        "payment_instructions": "",
        "contact": "087776445013",
        "order_note": "",
    }))
    out = pricing_api._public_pricing()
    assert out["contact_wa"] == "https://wa.me/6287776445013"


def test_user_cannot_self_mark_paid(db):
    """Endpoint 'Sudah Bayar' dihapus: user tidak boleh acc pembayarannya sendiri."""
    from fastapi.testclient import TestClient
    from backend.api.users import get_current_user
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "selfbuyer", "password_hash": "x", "max_prompts": 10, "prompts_used": 5, "is_active": True})
    order = db.create_order(str(user["id"]), db.find_plan("100"))

    app.dependency_overrides[get_current_user] = lambda: {"id": str(user["id"]), "username": "selfbuyer"}
    try:
        client = TestClient(app)
        res = client.post(f"/api/user/orders/{order['id']}/paid")
        assert res.status_code in (404, 405)
        assert db.get_order(order["id"])["status"] == "pending"
        assert db.get_user_by_id(str(user["id"]))["max_prompts"] == 10
    finally:
        app.dependency_overrides.clear()


def test_callback_auto_activates_quota_and_is_idempotent(db, monkeypatch):
    """Dana masuk -> callback gateway -> paid + kuota naik, tanpa acc user."""
    from fastapi.testclient import TestClient
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "autobuyer", "password_hash": "x", "max_prompts": 10, "prompts_used": 5, "is_active": True})
    order = db.create_order(str(user["id"]), db.find_plan("100"))
    _enable_gateway(monkeypatch)

    try:
        client = TestClient(app)
        res = client.post("/api/payment/duitku/callback", data=_callback_payload(order))
        assert res.status_code == 200
        assert res.json()["max_prompts"] == 110
        assert db.get_user_by_id(str(user["id"]))["max_prompts"] == 110
        paid = db.get_order(order["id"])
        assert paid["status"] == "paid"
        assert paid["confirmed_by"] == "duitku"

        # Callback duplikat (retry gateway): kuota tidak dobel.
        res2 = client.post("/api/payment/duitku/callback", data=_callback_payload(order))
        assert res2.status_code == 200
        assert res2.json().get("idempotent") is True
        assert db.get_user_by_id(str(user["id"]))["max_prompts"] == 110
    finally:
        app.dependency_overrides.clear()


def test_callback_bad_signature_rejected(db, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "forged", "password_hash": "x", "max_prompts": 10, "prompts_used": 0, "is_active": True})
    order = db.create_order(str(user["id"]), db.find_plan("100"))
    _enable_gateway(monkeypatch, signature_ok=False)

    client = TestClient(app)
    res = client.post("/api/payment/duitku/callback", data=_callback_payload(order))
    assert res.status_code == 403
    assert db.get_order(order["id"])["status"] == "pending"
    assert db.get_user_by_id(str(user["id"]))["max_prompts"] == 10


def test_callback_amount_mismatch_rejected(db, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "shortpay", "password_hash": "x", "max_prompts": 10, "prompts_used": 0, "is_active": True})
    order = db.create_order(str(user["id"]), db.find_plan("100"))
    _enable_gateway(monkeypatch)

    client = TestClient(app)
    res = client.post("/api/payment/duitku/callback", data=_callback_payload(order, amount="1"))
    assert res.status_code == 403
    assert db.get_order(order["id"])["status"] == "pending"
    assert db.get_user_by_id(str(user["id"]))["max_prompts"] == 10


def test_callback_unknown_order_returns_404(db, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    _enable_gateway(monkeypatch)

    client = TestClient(app)
    res = client.post("/api/payment/duitku/callback", data=_callback_payload({"id": "00000000-0000-0000-0000-000000000000", "amount": 30000}))
    assert res.status_code == 404


def test_callback_failed_payment_keeps_order_pending(db, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "failpay", "password_hash": "x", "max_prompts": 10, "prompts_used": 0, "is_active": True})
    order = db.create_order(str(user["id"]), db.find_plan("100"))
    _enable_gateway(monkeypatch)

    client = TestClient(app)
    res = client.post("/api/payment/duitku/callback", data=_callback_payload(order, resultCode="01"))
    assert res.status_code == 200
    assert res.json()["status"] == "ignored"
    assert db.get_order(order["id"])["status"] == "pending"
    assert db.get_user_by_id(str(user["id"]))["max_prompts"] == 10


def test_callback_disabled_when_gateway_unconfigured(db):
    """Tanpa credential, callback ditolak (bukan diam-diam jadi trustless)."""
    from fastapi.testclient import TestClient
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "nogw", "password_hash": "x", "max_prompts": 10, "prompts_used": 0, "is_active": True})
    order = db.create_order(str(user["id"]), db.find_plan("100"))

    client = TestClient(app)
    res = client.post("/api/payment/duitku/callback", data=_callback_payload(order))
    assert res.status_code == 400
    assert db.get_order(order["id"])["status"] == "pending"


def test_callback_paid_after_cancel_needs_admin(db, monkeypatch):
    """Order diganti saat menunggu tapi dana masuk: jangan auto-aktif, lempar admin."""
    from fastapi.testclient import TestClient
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "latepay", "password_hash": "x", "max_prompts": 10, "prompts_used": 0, "is_active": True})
    order = db.create_order(str(user["id"]), db.find_plan("100"))
    db.set_order_status(order["id"], "cancelled")
    _enable_gateway(monkeypatch)

    client = TestClient(app)
    res = client.post("/api/payment/duitku/callback", data=_callback_payload(order))
    assert res.status_code == 200
    assert res.json()["status"] == "needs_admin"
    assert db.get_order(order["id"])["status"] == "cancelled"
    assert db.get_user_by_id(str(user["id"]))["max_prompts"] == 10


def test_create_order_with_gateway_returns_payment_url(db, monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api.users import get_current_user
    from backend.api.main import app
    from backend.api import pricing as pricing_api

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "gwbuyer", "password_hash": "x", "max_prompts": 10, "prompts_used": 0, "is_active": True, "email": "gw@example.com"})
    monkeypatch.setattr(pricing_api.duitku, "configured", lambda: True)
    monkeypatch.setattr(
        pricing_api.duitku, "create_invoice",
        lambda **kw: {"reference": "REF777", "payment_url": "https://app-sandbox.duitku.com/redirect_checkout?reference=REF777"},
    )

    app.dependency_overrides[get_current_user] = lambda: {"id": str(user["id"]), "username": "gwbuyer"}
    try:
        client = TestClient(app)
        res = client.post("/api/user/orders", json={"plan_id": "100"})
        assert res.status_code == 200
        body = res.json()
        assert body["payment_url"].startswith("https://")
        assert body["order"]["status"] == "pending"
        assert body["order"]["proof"] == "duitku:REF777"
    finally:
        app.dependency_overrides.clear()


def test_create_order_clears_stale_pending_instead_of_409(db, monkeypatch):
    """Order baru menggantikan pending lama (user tutup tab sebelum bayar)."""
    from fastapi.testclient import TestClient
    from backend.api.users import get_current_user
    from backend.api.main import app

    db.update_pricing({"plans": DEFAULT_PLANS})
    user = db.create_user({"username": "replacer", "password_hash": "x", "max_prompts": 5, "prompts_used": 0, "is_active": True})

    app.dependency_overrides[get_current_user] = lambda: {"id": str(user["id"]), "username": "replacer"}
    try:
        client = TestClient(app)
        res1 = client.post("/api/user/orders", json={"plan_id": "100"})
        assert res1.status_code == 200
        res2 = client.post("/api/user/orders", json={"plan_id": "200"})
        assert res2.status_code == 200
        items = client.get("/api/user/orders").json()["items"]
        statuses = sorted(o["status"] for o in items)
        assert statuses == ["cancelled", "pending"]
    finally:
        app.dependency_overrides.clear()


# ── user list merge + local sync ──

def test_list_users_merges_local_only_users(db):
    local = db.create_user({"username": "local_only", "password_hash": "x", "max_prompts": 5, "is_active": True})
    rows = db.list_users()
    assert any(str(u["id"]) == str(local["id"]) for u in rows)


def test_create_user_mirrors_to_local(db):
    from backend.database import db as m
    u = db.create_user({"username": "mirrorme", "password_hash": "x", "max_prompts": 1, "is_active": True})
    local = m._read_local_json(db._users_file(), [])
    assert any(str(x.get("id")) == str(u["id"]) for x in local)


def test_delete_user_removes_from_local(tmp_path, monkeypatch):
    from backend.database import db as m
    monkeypatch.setattr(m, "supabase_client", None)
    monkeypatch.setattr(m, "LOCAL_DATA_DIR", str(tmp_path))
    u = m.DatabaseService.create_user({"username": "gone", "password_hash": "x", "max_prompts": 1, "is_active": True})
    assert m.DatabaseService.delete_user(str(u["id"])) is True
    assert m.DatabaseService.get_user_by_id(str(u["id"])) is None


def test_sync_local_users_to_supabase_noop_without_client(db):
    db.create_user({"username": "noclient", "password_hash": "x", "max_prompts": 1, "is_active": True})
    assert db.sync_local_users_to_supabase() == 0


def test_sync_local_users_pushes_missing(monkeypatch):
    from backend.database import db as m

    class _Q:
        def __init__(self, rows):
            self._rows = rows
            self._pending = None
        def select(self, *a, **k):
            return self
        def execute(self):
            if self._pending is not None:
                m._sync_inserts.append(self._pending)
                return type("R", (), {"data": [self._pending]})()
            return type("R", (), {"data": list(self._rows)})()
        def insert(self, row):
            self._pending = row
            return self
        def eq(self, *a, **k):
            return self

    class _Client:
        def __init__(self, existing):
            self._existing = existing
        def table(self, name):
            return _Q(self._existing)

    m._sync_inserts = []
    monkeypatch.setattr(m, "supabase_client", _Client([{"id": "already-there"}]))
    monkeypatch.setattr(m, "LOCAL_DATA_DIR", m.LOCAL_DATA_DIR)
    monkeypatch.setattr(m, "_read_local_json", lambda f, d: [
        {"id": "already-there", "username": "a"},
        {"id": "missing-1", "username": "b"},
    ] if f == m.DatabaseService._users_file() else d)
    created = m.DatabaseService.sync_local_users_to_supabase()
    assert created == 1
    assert any(r.get("id") == "missing-1" for r in m._sync_inserts)