"""Regresi performa panel Users.

Kontrak:
- `status_map` untuk N user hanya memakai 2 query bulk (orders + user_daily_quota)
  dan membaca tabel pricing SEKALI (bukan per user / per order).
- Query orders TIDAK menarik kolom berat seperti `proof` (base64 bukti bayar).

Jalankan:
  python -m pytest backend/tests/test_quota_perf.py -q
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
    m.config_cache.clear()
    return m.DatabaseService


class _Resp:
    def __init__(self, data):
        self.data = data


class _Table:
    def __init__(self, client, name):
        self._c = client
        self._name = name
        self._cols = None
        self._eq_day = None

    def select(self, cols="*"):
        self._cols = cols
        return self

    def eq(self, col, val):
        if col == "quota_day":
            self._eq_day = val
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        self._c.selects.append((self._name, self._cols, self._eq_day))
        if self._name == "orders":
            return _Resp(self._c.orders)
        if self._name == "user_daily_quota":
            return _Resp(self._c.usage)
        return _Resp([])


class _Client:
    """Supabase palsu: hitung tiap select, tanpa update/rpc."""

    def __init__(self, orders=None, usage=None):
        self.orders = orders or []
        self.usage = usage or []
        self.selects: list[tuple[str, str | None, str | None]] = []

    def table(self, name):
        return _Table(self, name)

    def orders_select(self):
        return [s for s in self.selects if s[0] == "orders"]


def _users(n):
    return [{"id": f"u{i}", "username": f"user{i}", "max_prompts": 0, "prompts_used": 0} for i in range(n)]


def test_status_map_uses_two_bulk_queries(db, monkeypatch):
    client = _Client(orders=[], usage=[{"user_id": "u0", "prompts_used": 3}])
    from backend.database import db as m

    monkeypatch.setattr(m, "supabase_client", client)

    out = db.status_map(_users(12))

    assert len(out) == 12
    names = [s[0] for s in client.selects]
    # Orders + pemakaian harian = bulk; pricing_config dibaca sekali (bukan per user).
    assert names.count("orders") == 1
    assert names.count("user_daily_quota") == 1
    assert names.count("pricing_config") <= 1
    assert len(client.selects) <= 3, client.selects


def test_orders_query_excludes_heavy_proof_blob(db, monkeypatch):
    client = _Client(
        orders=[
            {
                "user_id": "u0",
                "plan_id": "100",
                "status": "paid",
                "paid_at": None,
                "days": 0,
            }
        ]
    )
    from backend.database import db as m

    monkeypatch.setattr(m, "supabase_client", client)

    db.status_map(_users(3))

    cols = client.orders_select()[0][1]
    assert cols is not None
    assert "proof" not in cols
    assert "note" not in cols
    assert "user_id" in cols and "plan_id" in cols and "status" in cols


def test_pricing_read_once_per_status_map(db, monkeypatch):
    """Pricing tidak boleh dibaca per user (N user = tetap 1 baca)."""
    db.update_pricing(
        {"plans": [{"id": "100", "label": "P", "prompts": 100, "amount": 1}], "default_daily_prompts": 20}
    )
    calls = {"n": 0}
    original = db.get_pricing

    def counting_get_pricing():
        calls["n"] += 1
        return original()

    monkeypatch.setattr(db, "get_pricing", staticmethod(counting_get_pricing))

    db.status_map(_users(25))

    assert calls["n"] == 1, calls


def test_list_orders_columns_projection():
    """Projection lokal juga menghormati `columns` (payload kecil)."""
    row = {"id": "o1", "user_id": "u1", "plan_id": "p", "status": "paid", "proof": "x" * 5000}
    from backend.database.billing_repo import _project_order

    out = _project_order(row, "id,user_id,plan_id,status")
    assert set(out) == {"id", "user_id", "plan_id", "status"}
    assert _project_order(row, None) is row
