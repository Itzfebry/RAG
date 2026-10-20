"""Test unit untuk perbaikan keamanan, kuota, dan RAG.

Tidak butuh Supabase / provider LLM / embedding eksternal. Jalankan:
  python -m pytest backend/tests -q
"""

import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
os.environ.setdefault("ADMIN_PASSWORD_HASH", "$2b$12$abcdefghijklmnopqrstuuS4pU0CxAAKx4tVhKq8yjLaQG9m7kyK6")


class _Req:
    def __init__(self, headers=None, host="10.0.0.5"):
        self.headers = headers or {}
        self.client = type("C", (), {"host": host})()


def test_client_ip_ignores_spoofed_xff_on_vercel(monkeypatch):
    from backend.security.rate_limiter import get_client_ip

    monkeypatch.setenv("VERCEL", "1")
    req = _Req({"x-forwarded-for": "1.1.1.1, 2.2.2.2"})
    assert get_client_ip(req) == "2.2.2.2"


def test_client_ip_uses_socket_when_not_behind_proxy(monkeypatch):
    from backend.security.rate_limiter import get_client_ip

    monkeypatch.delenv("VERCEL", raising=False)
    req = _Req({"x-forwarded-for": "1.1.1.1"}, host="127.0.0.1")
    assert get_client_ip(req) == "127.0.0.1"


def test_jwt_secret_rejects_default_and_short(monkeypatch):
    from backend.config.config import Settings

    monkeypatch.setenv("JWT_SECRET_KEY", "super-secret-jwt-key-itz-ai-2026")
    with pytest.raises(ValueError):
        Settings(JWT_SECRET_KEY="super-secret-jwt-key-itz-ai-2026")
    with pytest.raises(ValueError):
        Settings(JWT_SECRET_KEY="short")


def test_cron_warmup_requires_secret(monkeypatch):
    from fastapi.testclient import TestClient

    import backend.api.main as m

    monkeypatch.setenv("CRON_SECRET", "s3cret")
    c = TestClient(m.app)
    assert c.get("/api/cron/warmup").status_code == 401
    assert c.get("/api/cron/warmup", headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_upload_requires_admin():
    from fastapi.testclient import TestClient

    import backend.api.main as m

    c = TestClient(m.app)
    r = c.post(
        "/api/admin/knowledge/upload?category_id=c1",
        files={"file": ("a.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 401


def test_body_limit_blocks_chunked_oversize():
    from fastapi import FastAPI, Request
    from fastapi.testclient import TestClient

    from backend.security.middleware import BodySizeLimitMiddleware

    app = FastAPI()
    app.add_middleware(BodySizeLimitMiddleware)

    @app.post("/x")
    async def x(r: Request):
        return {"n": len(await r.body())}

    c = TestClient(app)
    assert c.post("/x", content=b"hi").status_code == 200

    def gen():
        for _ in range(3):
            yield b"a" * 600_000

    assert c.post("/x", content=gen()).status_code == 413


def test_index_entry_never_stores_zero_vector(monkeypatch):
    import backend.knowledge.knowledge_service as ks

    class _Table:
        def __init__(self):
            self.inserted = []

        def delete(self):
            return self

        def eq(self, *_):
            return self

        def insert(self, rows):
            self.inserted.append(rows)
            return self

        def execute(self):
            return None

    table = _Table()

    class _Client:
        def table(self, _name):
            return table

    monkeypatch.setattr(ks, "supabase_client", _Client())
    monkeypatch.setattr(ks.KnowledgeService, "get_embedding", staticmethod(lambda *_a, **_k: [0.0] * ks.EMBEDDING_DIM))

    with pytest.raises(RuntimeError):
        ks.KnowledgeService.index_entry("e1", "isi knowledge yang cukup panjang")
    assert table.inserted == []


def test_keyword_fallback_skips_inactive_entries(monkeypatch):
    import backend.knowledge.knowledge_service as ks

    entries = [
        {"content": "harga servis laptop 100rb", "is_active": False},
        {"content": "harga servis laptop 150rb", "is_active": True},
    ]
    monkeypatch.setattr(ks.DatabaseService, "get_knowledge_entries", staticmethod(lambda *_a, **_k: entries))
    out = ks._keyword_search("berapa harga servis laptop", 5)
    assert out == ["harga servis laptop 150rb"]


def test_match_threshold_default_is_provider_aware():
    import backend.knowledge.knowledge_service as ks

    expected = 0.64 if ks.EMBEDDING_PROVIDER == "gemini" else 0.25
    if "MATCH_THRESHOLD" not in os.environ:
        assert expected == ks.MATCH_THRESHOLD
