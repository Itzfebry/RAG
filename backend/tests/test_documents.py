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


def test_chat_passes_document_to_orchestrator(monkeypatch):
    """Regresi: `document` dari client harus sampai ke stream_chat_response.

    Bug lama: field dokumen tidak diteruskan, sehingga model menjawab tanpa
    konteks file yang dilampirkan.
    """
    import json

    from fastapi.testclient import TestClient

    from backend.api import chat as chat_api
    from backend.api.main import app
    from backend.database.db import DatabaseService

    captured: dict = {}

    async def fake_stream(*args, **kwargs):
        captured["query"] = args[0] if args else kwargs.get("query")
        captured["user_document"] = kwargs.get("user_document")
        yield f"data: {json.dumps({'content': 'ok'})}\n\n"
        yield "data: [DONE]\n\n"

    monkeypatch.setattr(chat_api.agent_orchestrator, "stream_chat_response", fake_stream)
    monkeypatch.setattr(
        chat_api,
        "get_current_chat_user_optional",
        lambda request: {"id": "u1", "display_name": "Budi"},
    )
    monkeypatch.setattr(DatabaseService, "can_use_document_feature", staticmethod(lambda user: True))
    monkeypatch.setattr(
        DatabaseService,
        "get_user_by_id",
        staticmethod(lambda uid: {"id": "u1", "display_name": "Budi"}),
    )
    monkeypatch.setattr(DatabaseService, "get_user_profile", staticmethod(lambda uid: {}))
    monkeypatch.setattr(chat_api, "_active_daily_plan", lambda user: None)
    monkeypatch.setattr(DatabaseService, "is_prompt_quota_exhausted", staticmethod(lambda user: False))
    monkeypatch.setattr(DatabaseService, "get_token_stats", staticmethod(lambda days: {"budget": 0, "remaining": 0}))
    monkeypatch.setattr(DatabaseService, "get_app_settings", staticmethod(lambda: {}))
    monkeypatch.setattr(DatabaseService, "get_config_table", staticmethod(lambda table: {}))

    c = TestClient(app)
    res = c.post(
        "/api/chat",
        json={
            "message": "ringkas dokumen ini",
            "document": {"title": "catatan.txt", "content": "RAHASIA-123 isi dokumen"},
        },
    )

    assert res.status_code == 200
    assert captured["query"] == "ringkas dokumen ini"
    assert captured["user_document"] == {
        "title": "catatan.txt",
        "content": "RAHASIA-123 isi dokumen",
    }


def test_openai_messages_embed_document_before_query():
    """Isi dokumen harus muncul di pesan user terakhir, tepat sebelum pertanyaan.

    Model kecil sering mengabaikan dokumen yang hanya ada di system prompt, jadi
    isi dokumen ditempel ke pesan user agar benar-benar dipakai.
    """
    from backend.agent.agent import _build_openai_messages

    msgs = _build_openai_messages(
        "jelaskan",
        [],
        "SYSTEM",
        user_document={"title": "cv.pdf", "content": "SKILL-PYTHON-RAG"},
    )
    assert msgs[0] == {"role": "system", "content": "SYSTEM"}
    last = msgs[-1]
    assert last["role"] == "user"
    assert "SKILL-PYTHON-RAG" in last["content"]
    assert "cv.pdf" in last["content"]
    assert "jelaskan" in last["content"]


def test_openai_messages_without_document_is_plain_query():
    from backend.agent.agent import _build_openai_messages

    msgs = _build_openai_messages("jelaskan", [], "SYSTEM")
    assert msgs[-1] == {"role": "user", "content": "jelaskan"}
