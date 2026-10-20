import os
import sys
from datetime import datetime, timedelta

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


@pytest.fixture
def db(tmp_path, monkeypatch):
    from backend.database import db as m

    monkeypatch.setattr(m, "supabase_client", None)
    monkeypatch.setattr(m, "LOCAL_DATA_DIR", str(tmp_path))
    return m.DatabaseService


def test_create_list_and_owner_isolation(db):
    a = db.create_chat_session("user-a", "Chat A")
    db.create_chat_session("user-b", "Chat B")
    rows = db.list_chat_sessions("user-a")
    assert [r["id"] for r in rows] == [a["id"]]
    assert db.get_chat_session("user-b", a["id"]) is None


def test_limit_three_is_counted_per_user(db):
    for i in range(3):
        db.create_chat_session("user-a", f"c{i}")
    assert db.count_chat_sessions("user-a") == 3
    assert db.count_chat_sessions("user-b") == 0


def test_append_and_rename_first_title(db):
    s = db.create_chat_session("user-a", "Chat baru")
    db.append_chat_messages(s["id"], [{"role": "user", "content": "halo"}, {"role": "assistant", "content": "hai"}])
    db.rename_chat_session(s["id"], "halo")
    msgs = db.list_chat_messages(s["id"])
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert db.get_chat_session("user-a", s["id"])["title"] == "halo"


def test_truncate_last_turn_keeps_earlier_turns(db):
    s = db.create_chat_session("user-a", "x")
    db.append_chat_messages(s["id"], [{"role": "user", "content": "q1"}, {"role": "assistant", "content": "a1"}])
    db.append_chat_messages(s["id"], [{"role": "user", "content": "q2"}, {"role": "assistant", "content": "a2"}])
    db.truncate_last_chat_turn(s["id"])
    assert [m["content"] for m in db.list_chat_messages(s["id"])] == ["q1", "a1"]


def test_delete_removes_messages(db):
    s = db.create_chat_session("user-a", "x")
    db.append_chat_messages(s["id"], [{"role": "user", "content": "q"}])
    assert db.delete_chat_session("user-a", s["id"]) is True
    assert db.list_chat_messages(s["id"]) == []
    assert db.delete_chat_session("user-a", s["id"]) is False


def test_delete_other_users_chat_is_refused(db):
    s = db.create_chat_session("user-a", "x")
    assert db.delete_chat_session("user-b", s["id"]) is False
    assert db.get_chat_session("user-a", s["id"]) is not None


def test_seven_day_retention_purges_old_chats(db):
    from backend.database import db as m

    old = (datetime.now() - timedelta(days=8)).isoformat()
    fresh = datetime.now().isoformat()
    sessions = [
        {"id": "old-1", "user_id": "user-a", "title": "lama", "created_at": old, "updated_at": old},
        {"id": "new-1", "user_id": "user-a", "title": "baru", "created_at": fresh, "updated_at": fresh},
    ]
    m._write_local_json(db._chats_file(), sessions)
    m._write_local_json(
        db._chat_msgs_file(),
        [
            {"id": "m1", "session_id": "old-1", "role": "user", "content": "x", "created_at": old},
            {"id": "m2", "session_id": "new-1", "role": "user", "content": "y", "created_at": fresh},
        ],
    )
    rows = db.list_chat_sessions("user-a")
    assert [r["id"] for r in rows] == ["new-1"]
    assert db.list_chat_messages("old-1") == []
    assert len(db.list_chat_messages("new-1")) == 1
