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


# ------------------------------- RecursiveCharacterTextSplitter hard-splits


def test_recursive_splitter_hard_splits_paragraphless_text():
    """Teks 2000 char tanpa newline harus tree-mah berpotongan <= ~550 char."""
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    text = "a" * 2000
    chunks = splitter.split_text(text)
    assert chunks, "teks tanpa paragraf harus tetap menghasilkan chunk"
    assert all(len(c) <= 550 for c in chunks)
