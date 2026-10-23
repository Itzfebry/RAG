"""Regresi: update_user() tidak boleh mengembalikan None saat update Supabase
tidak mengembalikan row (mis. kolom `unlimited` belum ada → error di-log lalu
fallback lokal kosong), karena endpoint /admin/users/{id} langsung memanggil
updated.get(...) dan crash: AttributeError: 'NoneType' object has no attribute 'get'.

Jalankan:
  python -m pytest backend/tests/test_users_update_regression.py -q
"""

import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
os.environ.setdefault("ADMIN_PASSWORD_HASH", "$2b$12$abcdefghijklmnopqrstuuS4pU0CxAAKx4tVhKq8yjLaQG9m7kyK6")

ROW = {
    "id": "u-1",
    "username": "budi",
    "display_name": "Budi",
    "max_prompts": 0,
    "prompts_used": 0,
    "is_active": True,
    "unlimited": False,
}


class _Resp:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    """Mock PostgREST: update() mengembalikan data sesuai skenario, select() selalu ada."""

    def __init__(self, update_data, select_data):
        self._update_data = update_data
        self._select_data = select_data
        self._op = "select"

    def update(self, _patch):
        self._op = "update"
        return self

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def eq(self, *_a, **_k):
        return self

    def execute(self):
        if self._op == "update":
            return _Resp(self._update_data)
        return _Resp(self._select_data)


class _FakeSupabase:
    def __init__(self, update_data, select_data):
        self._update_data = update_data
        self._select_data = select_data

    def table(self, _name):
        return _FakeTable(self._update_data, self._select_data)


@pytest.fixture
def db(tmp_path, monkeypatch):
    from backend.database import db as m

    monkeypatch.setattr(m, "LOCAL_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(m, "supabase_client", None)
    m.config_cache.clear()
    return m


def test_update_user_returns_row_when_supabase_update_yields_nothing(db, monkeypatch):
    """Update 0-row (mis. kolom belum ada) → tetap kembalikan row dari re-fetch."""
    monkeypatch.setattr(db, "supabase_client", _FakeSupabase([], [dict(ROW)]))

    updated = db.DatabaseService.update_user("u-1", {"unlimited": True})

    assert updated is not None
    assert updated["id"] == "u-1"
    assert updated["username"] == "budi"


def test_update_user_returns_row_from_supabase_update(db, monkeypatch):
    monkeypatch.setattr(db, "supabase_client", _FakeSupabase([{**ROW, "unlimited": True}], []))

    updated = db.DatabaseService.update_user("u-1", {"unlimited": True})

    assert updated is not None
    assert updated["unlimited"] is True


def test_update_user_falls_back_to_local_json_when_supabase_empty(db):
    """Tanpa Supabase: patch diterapkan ke JSON lokal dan dikembalikan."""
    from backend.database.db import _read_local_json, _write_local_json

    users_file = db.DatabaseService._users_file()
    _write_local_json(users_file, [dict(ROW)])

    updated = db.DatabaseService.update_user("u-1", {"unlimited": True})

    assert updated is not None
    assert updated["unlimited"] is True
    assert _read_local_json(users_file, [])[0]["unlimited"] is True


def test_update_user_none_only_when_row_truly_absent(db, monkeypatch):
    """User tidak ada di Supabase maupun JSON lokal → None (endpoint yang 404)."""
    monkeypatch.setattr(db, "supabase_client", _FakeSupabase([], []))

    assert db.DatabaseService.update_user("missing", {"unlimited": True}) is None
