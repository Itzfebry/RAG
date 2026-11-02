"""Test endpoint ekstraksi dokumen (fitur lampiran file premium, sekali-pakai).

Tanpa Supabase / provider LLM. Jalankan:
  python -m pytest backend/tests/test_documents.py -q
"""

import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
os.environ.setdefault("ADMIN_PASSWORD_HASH", "$2b$12$abcdefghijklmnopqrstuuS4pU0CxAAKx4tVhKq8yjLaQG9m7kyK6")

URL = "/api/user/documents/extract"
MAX_BYTES = 2 * 1024 * 1024
MAX_CHARS = 120_000


@pytest.fixture
def make_client(monkeypatch):
    """Factory TestClient dengan status langganan yang bisa diatur per test."""
    from fastapi.testclient import TestClient

    from backend.api.main import app
    from backend.api.users import get_current_user
    from backend.database.db import DatabaseService

    clients = []

    def _make(allowed: bool = True) -> TestClient:
        app.dependency_overrides[get_current_user] = lambda: {"id": "u-test", "username": "tester"}
        monkeypatch.setattr(
            DatabaseService,
            "can_use_document_feature",
            staticmethod(lambda user: allowed),
        )
        c = TestClient(app)
        clients.append(c)
        return c

    yield _make
    app.dependency_overrides.pop(get_current_user, None)


def test_extract_txt(make_client):
    c = make_client()
    res = c.post(URL, files={"file": ("catatan.txt", b"halo dunia", "text/plain")})
    assert res.status_code == 200
    doc = res.json()["document"]
    assert doc["title"] == "catatan.txt"
    assert doc["content"] == "halo dunia"
    assert doc["char_count"] == len("halo dunia")
    assert doc["truncated"] is False


def test_extract_markdown(make_client):
    c = make_client()
    res = c.post(URL, files={"file": ("rahasia.md", b"# Judul\n\nisi", "text/markdown")})
    assert res.status_code == 200
    assert res.json()["document"]["content"].startswith("# Judul")


def test_rejects_unsupported_extension(make_client):
    c = make_client()
    res = c.post(URL, files={"file": ("program.exe", b"MZ", "application/octet-stream")})
    assert res.status_code == 400
    assert "Format" in res.json()["detail"]


def test_rejects_empty_file(make_client):
    c = make_client()
    res = c.post(URL, files={"file": ("kosong.txt", b"", "text/plain")})
    assert res.status_code == 400


def test_rejects_oversized_file(make_client):
    c = make_client()
    res = c.post(URL, files={"file": ("besar.txt", b"x" * (MAX_BYTES + 1), "text/plain")})
    assert res.status_code == 413


def test_truncates_long_content(make_client):
    c = make_client()
    res = c.post(URL, files={"file": ("panjang.txt", b"a" * (MAX_CHARS + 50), "text/plain")})
    assert res.status_code == 200
    doc = res.json()["document"]
    assert doc["truncated"] is True
    assert len(doc["content"]) == MAX_CHARS


def test_blocks_user_without_doc_access(make_client):
    c = make_client(allowed=False)
    res = c.post(URL, files={"file": ("catatan.txt", b"halo", "text/plain")})
    assert res.status_code == 403
    assert "dokumen" in res.json()["detail"].lower()
