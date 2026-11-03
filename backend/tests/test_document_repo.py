"""Test penyimpanan dokumen server-side + pengikatan ke sesi chat."""

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


def _save(db, user_id="u1", title="catatan.txt", content="isi dokumen rahasia"):
    return db.save_user_document(
        user_id,
        title=title,
        content=content,
        file_type="txt",
        truncated=False,
        page_count=None,
    )


def test_save_and_get_document_keeps_content_server_side(db):
    row = _save(db)
    assert row["id"]
    loaded = db.get_user_document("u1", row["id"])
    assert loaded is not None
    assert loaded["content"] == "isi dokumen rahasia"
    meta = db.public_document_metadata(loaded)
    assert "content" not in meta
    assert meta["title"] == "catatan.txt"
    assert meta["char_count"] == len("isi dokumen rahasia")


def test_document_ownership_is_enforced(db):
    row = _save(db, user_id="u1")
    assert db.get_user_document("u2", row["id"]) is None
    assert db.list_user_documents("u2", [row["id"]]) == []
    assert db.delete_user_document("u2", row["id"]) is False


def test_list_user_documents_preserves_requested_order(db):
    a = _save(db, title="a.txt", content="aaa")
    b = _save(db, title="b.txt", content="bbb")
    rows = db.list_user_documents("u1", [b["id"], a["id"]])
    assert [r["id"] for r in rows] == [b["id"], a["id"]]


def test_bind_documents_to_session_and_read_back(db):
    user = db.create_user({"username": "budi", "password_hash": "x", "max_prompts": 0, "prompts_used": 0})
    uid = str(user["id"])
    session = db.create_chat_session(uid, "Chat dokumen")
    doc = _save(db, user_id=uid)

    merged = db.bind_documents_to_session(uid, session["id"], [doc["id"]])
    assert merged == [doc["id"]]
    # Union: mengikat ulang tidak menghapus dokumen lama.
    doc2 = _save(db, user_id=uid, title="kedua.txt", content="dua")
    merged2 = db.bind_documents_to_session(uid, session["id"], [doc2["id"]])
    assert merged2 == [doc["id"], doc2["id"]]

    meta = db.session_documents(uid, session["id"])
    assert [m["id"] for m in meta] == [doc["id"], doc2["id"]]
    assert "content" not in meta[0]


def test_bind_ignores_documents_not_owned_by_user(db):
    user = db.create_user({"username": "budi", "password_hash": "x", "max_prompts": 0, "prompts_used": 0})
    uid = str(user["id"])
    session = db.create_chat_session(uid, "Chat")
    foreign = _save(db, user_id="someone-else")
    assert db.bind_documents_to_session(uid, session["id"], [foreign["id"]]) == []
