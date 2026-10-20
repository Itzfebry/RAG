"""Test unit untuk QA fixes (double-quota race, event dispatch, text splitter).

Tidak butuh Supabase / provider LLM / embedding eksternal. Jalankan:
  python -m pytest backend/tests/test_qa_fixes.py -q
"""

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")


# ------------------------------------------------ chat.py event key dispatch


def test_parse_sse_event_dispatches_on_top_level_keys():
    from backend.api.chat import _parse_sse_event

    # Event usage/answered asli tetap dikenali lewat top-level key
    ev = _parse_sse_event('data: {"usage": {"prompt_tokens": 3, "total_tokens": 5}}')
    assert ev is not None and ev["usage"]["total_tokens"] == 5
    ev = _parse_sse_event('data: {"answered": true}')
    assert ev is not None and "answered" in ev

    # Konten chat yang mengandung teks "usage"/"answered" TIDAK salah rute
    tricky = "cara pakai field usage dan token answered di API ini"
    ev = _parse_sse_event("data: " + json.dumps({"content": tricky}))
    assert ev is not None and "usage" not in ev and "answered" not in ev

    # Bukan data JSON (mis. [DONE]) -> None
    assert _parse_sse_event("data: [DONE]\n\n") is None
    assert _parse_sse_event("data: bukan json") is None
    assert _parse_sse_event("chunk tanpa prefix") is None


# ---------------------------------------- set_order_status_paid conditional


class _PendingSupa:
    """Fake Supabase: transisi pending->paid hanya menang sekali."""

    def __init__(self):
        self.pending = True
        self.filters: list[tuple[str, str]] = []

    def table(self, _t):
        return self

    def update(self, _p):
        return self

    def eq(self, col, val):
        self.filters.append((col, val))
        return self

    def execute(self):
        if self.pending:
            self.pending = False
            return type("R", (), {"data": [{"id": "o1", "status": "paid"}]})()
        return type("R", (), {"data": []})()


def test_set_order_status_paid_true_once_then_false(monkeypatch):
    from backend.database.db import DatabaseService

    fake = _PendingSupa()
    monkeypatch.setattr("backend.database.db.supabase_client", fake)
    monkeypatch.setattr(
        "backend.database.db._read_local_json", lambda *a, **k: __import__("pytest").fail("fallback tak boleh jalan")
    )

    assert DatabaseService.set_order_status_paid("o1", confirmed_by="duitku") is True
    # Transisi kedua (race/callback ganda) tidak menang
    assert DatabaseService.set_order_status_paid("o1", confirmed_by="duitku") is False
    # Guard harus mensyaratkan masih pending
    assert ("status", "pending") in fake.filters


# -------------------------------------------- trial consume berbasis RPC atomik


class _AtomicTrialSupa:
    """Fake Supabase RPC consume_trial_prompt dengan counter nyata (atomik)."""

    def __init__(self, limit: int):
        self.used = 0
        self.limit = limit

    def rpc(self, _name, params):
        self.used += 1
        won = self.used <= self.limit

        class _R:
            data = bool(won)

        return type("R", (), {"execute": lambda self: _R()})()


def test_try_consume_trial_prompt_atomic_rpc(monkeypatch):
    from backend.database.db import DatabaseService

    fake = _AtomicTrialSupa(limit=2)
    monkeypatch.setattr("backend.database.db.supabase_client", fake)
    monkeypatch.setattr(
        "backend.database.db._read_local_json",
        lambda *a, **k: __import__("pytest").fail("fallback tak boleh jalan saat RPC ok"),
    )

    assert DatabaseService.try_consume_trial_prompt("1.2.3.4", 2) is True
    assert DatabaseService.try_consume_trial_prompt("1.2.3.4", 2) is True
    # Permintaan ke-3 melewati limit: RPC menyatakan false
    assert DatabaseService.try_consume_trial_prompt("1.2.3.4", 2) is False
    assert fake.used == 3


def _write_local_json_stub(path, data):
    import pathlib

    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(__import__("json").dumps(data), encoding="utf-8")


def test_trial_fallback_local_json_respects_limit(monkeypatch, tmp_path):
    """Tanpa Supabase: gate trial tetap bekerja lewat file JSON lokal."""
    import json

    from backend.database.db import DatabaseService

    monkeypatch.setattr("backend.database.db.supabase_client", None)
    monkeypatch.setattr(
        DatabaseService,
        "_trial_file",
        staticmethod(lambda: str(tmp_path / "trial_usage.json")),
        raising=False,
    )
    monkeypatch.setattr("backend.database.db._write_local_json", _write_local_json_stub)

    assert DatabaseService.try_consume_trial_prompt("5.6.7.8", 1) is True
    assert DatabaseService.try_consume_trial_prompt("5.6.7.8", 1) is False
    data = json.loads((tmp_path / "trial_usage.json").read_text(encoding="utf-8"))
    assert data["5.6.7.8"] == 1


# ------------------------------------- daily quota: expired plan must gate chat


def test_expired_daily_plan_is_rejected_before_quota_consume(monkeypatch):
    """Paket harian kadaluarsa (expired: True) harus ditolak 403 dan TIDAK
    meng-konsumsi kuota harian (bug: expired user bisa chat gratis)."""
    from fastapi.testclient import TestClient

    from backend.api import chat as chat_api
    from backend.api.main import app
    from backend.database.db import DatabaseService

    user = {"id": "u-exp", "display_name": "Tester"}
    calls: list[str] = []

    monkeypatch.setattr(chat_api, "get_current_chat_user_optional", lambda r: user)
    monkeypatch.setattr(chat_api, "enforce_rate_limit", lambda *a, **k: calls.append("rate"))
    monkeypatch.setattr(DatabaseService, "get_user_by_id", staticmethod(lambda _id: user))
    monkeypatch.setattr(
        DatabaseService,
        "resolve_daily_plan",
        staticmethod(
            lambda _uid: {
                "plan_id": "p1",
                "plan_label": "Harian",
                "daily_limit": 10,
                "expired": True,
                "expires_at": "2025-01-01T00:00:00+07:00",
                "days_left": 0,
            }
        ),
    )

    def fail_consume(_uid, _limit):
        calls.append("consume")
        raise AssertionError("try_consume_daily_prompt tidak boleh dipanggil untuk paket expired")

    monkeypatch.setattr(DatabaseService, "try_consume_daily_prompt", staticmethod(fail_consume))

    client = TestClient(app)
    res = client.post("/api/chat", json={"message": "halo", "history": []})
    assert res.status_code == 403
    assert "Masa aktif" in res.json().get("detail", "")
    assert "consume" not in calls


# ------------------------------- RecursiveCharacterTextSplitter hard-splits


def test_recursive_splitter_hard_splits_paragraphless_text():
    """Teks 2000 char tanpa newline harus tree-mah berpotongan <= ~550 char."""
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    text = "a" * 2000
    chunks = splitter.split_text(text)
    assert chunks, "teks tanpa paragraf harus tetap menghasilkan chunk"
    assert all(len(c) <= 550 for c in chunks)
