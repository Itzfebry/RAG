"""Test unit untuk refactor Tahap 2 (clean-code).

Meliputi: enforce_rate_limit, limiter durable, DatabaseService.probe_database,
get_trial_usage_total, dan helper streaming di agent.py.
Tidak butuh Supabase / provider LLM / embedding eksternal. Jalankan:
  python -m pytest backend/tests/test_phase2_refactors.py -q
"""

import json
import os
import sys

import pytest
from fastapi import HTTPException

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")


# ---------------------------------------------------------------- rate limiter


class _FakeDB:
    """Fake DatabaseService untuk limiter durable (hitungan sederhana)."""

    def __init__(self, counts):
        self.counts = counts  # key -> (count, reset_in)
        self.reset_keys = set()

    def bump_rate_limit(self, key, window_seconds):
        if key in self.counts:
            return self.counts[key]
        return None

    def peek_rate_limit(self, key):
        return self.counts.get(key, (0, 0))[0]

    def reset_rate_limit(self, key):
        return key in self.reset_keys


class _FakeSupa:
    """Fake Supabase client: builder chain table().select().limit().execute()."""

    def __init__(self, ok=True):
        self.ok = ok

    def table(self, _t):
        return self

    def select(self, _c):
        return self

    def eq(self, *a, **k):
        return self

    def limit(self, _n):
        return self

    def execute(self):
        if not self.ok:
            raise RuntimeError("supabase down")
        return type("R", (), {"data": [{"id": 1}]})()


class _SupaData:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return type("R", (), {"data": self.data})()


def test_enforce_rate_limit_allows_under_limit(monkeypatch):
    from backend.security.rate_limiter import enforce_rate_limit

    # key unik per test agar bucket in-memory bersih
    monkeypatch.setattr("backend.security.rate_limiter.check_rate_limit", lambda k, m, w: (True, 0))
    enforce_rate_limit("t-enforce-ok", 5, 60)  # tidak raise


def test_enforce_rate_limit_raises_429_with_retry_header(monkeypatch):
    from backend.security.rate_limiter import enforce_rate_limit

    monkeypatch.setattr("backend.security.rate_limiter.check_rate_limit", lambda k, m, w: (False, 17))
    with pytest.raises(HTTPException) as ei:
        enforce_rate_limit("t-enforce-429", 5, 60)
    assert ei.value.status_code == 429
    assert ei.value.headers["Retry-After"] == "17"
    assert ei.value.detail == "Too many requests. Retry after 17s"


def test_enforce_rate_limit_custom_detail_and_durable(monkeypatch):
    from backend.security.rate_limiter import enforce_rate_limit

    called = {}

    def fake_durable(key, max_requests, window_seconds):
        called["key"] = key
        return False, 5

    monkeypatch.setattr("backend.security.rate_limiter.check_rate_limit_durable", fake_durable)
    with pytest.raises(HTTPException) as ei:
        enforce_rate_limit("t-durable", 3, 300, durable=True, detail="Terlalu sering. Coba lagi {retry}s")
    assert ei.value.status_code == 429
    assert ei.value.detail == "Terlalu sering. Coba lagi 5s"
    assert called["key"] == "t-durable"


def test_check_rate_limit_durable_falls_back_when_db_errors(monkeypatch):
    import backend.security.rate_limiter as rl

    def boom():
        raise RuntimeError("no db")

    monkeypatch.setattr(rl, "_db", boom)
    # fallback ke in-memory: key unik, di bawah limit -> allowed
    allowed, retry = rl.check_rate_limit_durable("t-durb-fallback", 100, 60)
    assert allowed is True and retry == 0


def test_check_rate_limit_durable_counts_db(monkeypatch):
    import backend.security.rate_limiter as rl

    fake = _FakeDB({"t-durb-db": (10, 30)})
    monkeypatch.setattr(rl, "_db", lambda: fake)
    allowed, retry = rl.check_rate_limit_durable("t-durb-db", 5, 60)
    assert allowed is False
    assert retry == 30

    fake2 = _FakeDB({"t-durb-db-ok": (1, 30)})
    monkeypatch.setattr(rl, "_db", lambda: fake2)
    allowed, retry = rl.check_rate_limit_durable("t-durb-db-ok", 5, 60)
    assert allowed is True and retry == 0


# ------------------------------------------------------- DatabaseService probes


def test_probe_database_no_supabase(monkeypatch):
    from backend.database.db import DatabaseService

    monkeypatch.setattr("backend.database.db.supabase_client", None)
    assert DatabaseService.probe_database() == (False, "lokal")


def test_probe_database_ok(monkeypatch):
    from backend.database.db import DatabaseService

    monkeypatch.setattr("backend.database.db.supabase_client", _FakeSupa(ok=True))
    assert DatabaseService.probe_database() == (True, "supabase")


def test_probe_database_failure(monkeypatch):
    from backend.database.db import DatabaseService

    monkeypatch.setattr("backend.database.db.supabase_client", _FakeSupa(ok=False))
    ok, mode = DatabaseService.probe_database()
    assert ok is False
    assert "gagal" in mode


def test_get_trial_usage_total_from_supabase(monkeypatch):
    from backend.database.db import DatabaseService

    class _Supa:
        def table(self, _t):
            return self

        def select(self, _c):
            return self

        def execute(self):
            return _SupaData([{"used": 4}, {"used": 6}, {}])

    monkeypatch.setattr("backend.database.db.supabase_client", _Supa())
    monkeypatch.setattr("backend.database.db._read_local_json", lambda *a, **k: pytest.fail("fallback tak boleh jalan"))
    assert DatabaseService.get_trial_usage_total() == 10


def test_get_trial_usage_total_local_fallback(monkeypatch):
    from backend.database.db import DatabaseService

    monkeypatch.setattr("backend.database.db.supabase_client", None)
    monkeypatch.setattr("backend.database.db._read_local_json", lambda *a, **k: {"ip1": 3, "ip2": 5, "bad": None})
    assert DatabaseService.get_trial_usage_total() == 8


def test_get_trial_usage_total_supabase_error_falls_back(monkeypatch):
    from backend.database.db import DatabaseService

    class _SupaBad:
        def table(self, _t):
            raise RuntimeError("down")

    monkeypatch.setattr("backend.database.db.supabase_client", _SupaBad())
    monkeypatch.setattr("backend.database.db._read_local_json", lambda *a, **k: {"ip": 2})
    assert DatabaseService.get_trial_usage_total() == 2


# ---------------------------------------------------------------- agent helpers


def test_parse_bool_variants():
    from backend.agent.agent import _parse_bool

    assert _parse_bool(True) is True
    assert _parse_bool("true") is True
    assert _parse_bool("YES") is True
    assert _parse_bool("1") is True
    assert _parse_bool("0") is False
    assert _parse_bool("false") is False
    assert _parse_bool(None) is False
    assert _parse_bool("") is False


def test_merge_models_dedup_and_trim():
    from backend.agent.agent import _merge_models

    assert _merge_models("a", ["b", " a ", "", "	b", None]) == ["a", "b"]
    assert _merge_models("a", None) == ["a"]


def test_build_openai_messages_caps_history_and_maps_roles():
    from backend.agent.agent import _build_openai_messages

    hist = [{"role": f"role{i}" if i < 12 else "user", "content": f"c{i}"} for i in range(14)]
    # role non-standar dikonversi ke user
    msgs = _build_openai_messages("Q", hist, "SYS")
    assert msgs[0] == {"role": "system", "content": "SYS"}
    assert len(msgs) == 12  # 10 history + query (system di luar)
    assert msgs[-1] == {"role": "user", "content": "Q"}
    assert all(m["role"] in ("user", "assistant", "system") for m in msgs)


def test_build_openai_messages_flattens_list_content():
    from backend.agent.agent import _build_openai_messages

    hist = [{"role": "user", "content": [{"text": "halo "}, "dunia"]}]
    # Verbatim parity: join menghasilkan spasi ganda jika token diakhiri spasi
    msgs = _build_openai_messages("Q", hist, "SYS")
    assert msgs[1]["content"] == "halo  dunia"


def test_clean_chunk_strips_think_and_normalizes_dashes():
    from backend.agent.agent import _clean_chunk

    # em dash -> ", ", en dash & U+2212 -> "-"
    assert _clean_chunk("a\u2014b") == "a, b"
    assert _clean_chunk("a\u2013b") == "a-b"
    assert _clean_chunk("a\u2212 3") == "a- 3"
    # preamble reasoning dibuang
    assert _clean_chunk("Analyze User Input: x") == ""
    assert _clean_chunk("Formulate Response y") == ""
    assert _clean_chunk("") == ""


def test_emit_sse_format():
    from backend.agent.agent import _emit

    assert _emit({"content": "hi"}) == 'data: {"content": "hi"}\n\n'
    out = json.loads(_emit({"usage": {"total_tokens": 7}}).removeprefix("data: ").removesuffix("\n\n"))
    assert out["usage"]["total_tokens"] == 7


def test_create_client_openai_type():
    from backend.agent.agent import _create_client

    client, client_type = _create_client("openrouter", "sk-test-123", "https://example.com/v1", "")
    assert client_type == "openai"
    assert client is not None
    assert client.api_key == "sk-test-123"
