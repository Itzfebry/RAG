import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.agent.commands import (  # noqa: E402
    COMMANDS,
    build_command_block,
    list_commands,
    parse_command,
    sort_by_priority,
)


def test_single_command_strips_prefix():
    assert parse_command("/explain REST API") == (["explain"], "REST API", None)


def test_command_is_case_insensitive():
    assert parse_command("/EXPLAIN Test") == (["explain"], "Test", None)


def test_plain_message_has_no_command():
    assert parse_command("halo apa kabar") == ([], "halo apa kabar", None)


def test_slash_inside_message_is_not_command():
    assert parse_command("hari ini /explain") == ([], "hari ini /explain", None)


def test_bare_unknown_command_is_reported_not_executed():
    active, rest, unknown = parse_command("/foo")
    assert active == []
    assert unknown == "/foo"
    assert rest == "/foo"


def test_unknown_token_with_text_is_plain_message():
    assert parse_command("/home lagi error") == ([], "/home lagi error", None)


def test_empty_after_command_returns_no_query():
    assert parse_command("/explain") == (["explain"], "", None)


def test_multiple_commands_in_order():
    active, rest, unknown = parse_command("/debug /plan a b c")
    assert active == ["debug", "plan"]
    assert rest == "a b c"
    assert unknown is None


def test_duplicate_and_over_limit_are_dropped():
    assert parse_command("/explain /explain x") == (["explain"], "x", None)
    active, rest, _ = parse_command("/explain /compare /plan /debug q")
    assert active == ["explain", "compare"]
    assert rest == "/plan /debug q"


def test_unknown_after_valid_command_is_plain_text():
    active, rest, unknown = parse_command("/explain /foo x")
    assert active == ["explain"]
    assert rest == "/foo x"
    assert unknown is None


def test_empty_and_whitespace_input():
    assert parse_command("") == ([], "", None)
    assert parse_command("   ") == ([], "", None)
    assert parse_command(None) == ([], "", None)


def test_slash_without_name_is_plain_text():
    assert parse_command("/  x") == ([], "/  x", None)


def test_conflict_resolved_by_priority_not_input_order():
    assert sort_by_priority(["explain", "debug"]) == ["debug", "explain"]
    assert sort_by_priority(["debug", "explain"]) == ["debug", "explain"]


def test_block_empty_without_commands():
    assert build_command_block([]) == ""


def test_block_contains_instruction_and_format_of_each_command():
    block = build_command_block(["summarize"])
    spec = COMMANDS["summarize"]
    assert "/summarize" in block
    assert spec.instruction in block
    assert spec.output_format in block
    for rule in spec.rules:
        assert rule in block


def test_block_orders_by_priority_and_states_conflict_rule():
    block = build_command_block(["explain", "debug"])
    assert block.index("## Mode /debug") < block.index("## Mode /explain")
    assert "format dari mode pertama" in block


def test_every_command_has_full_definition():
    for name, spec in COMMANDS.items():
        assert spec.name == name
        assert spec.purpose and spec.instruction and spec.output_format
        assert spec.rules, name
        assert spec.example.startswith("/" + name), name


def test_list_commands_matches_registry():
    names = [c["name"] for c in list_commands()]
    assert set(names) == set(COMMANDS)
    assert len(names) == 13


def test_research_block_forbids_fake_browsing():
    block = build_command_block(["research"])
    assert "belum memiliki akses web search" in block


def test_prompt_builder_injects_active_command_block(monkeypatch):
    from backend.knowledge import context_builder as cb

    monkeypatch.setattr(cb, "_get_cached_configs", lambda: {
        "identity": {}, "personal": {}, "personality": {}, "comm": {}, "sys_instr": {},
    })
    monkeypatch.setattr(cb.DatabaseService, "get_app_settings", staticmethod(lambda: {}))
    monkeypatch.setattr(cb.KnowledgeService, "semantic_search", staticmethod(lambda *a, **k: []))
    monkeypatch.setattr(cb.rag_cache, "get", lambda k: None)
    monkeypatch.setattr(cb.rag_cache, "set", lambda k, v: None)

    with_cmd = cb.build_system_prompt("q", [], command_names=["explain"])
    without = cb.build_system_prompt("q", [], command_names=None)
    assert "# Active Command Mode" in with_cmd
    assert "## Mode /explain" in with_cmd
    assert "# Active Command Mode" not in without

def test_command_details_endpoint_lists_all_commands():
    from backend.agent.commands import list_command_details
    details = list_command_details()
    assert {d["name"] for d in details} == set(COMMANDS)
    for d in details:
        assert d["rules"] and d["output_format"] and d["example"].startswith("/" + d["name"])


def test_help_response_is_static_and_skips_quota(monkeypatch):
    from fastapi.testclient import TestClient
    from backend.api import chat as chat_api
    from backend.api.main import app

    def boom(*a, **k):
        raise AssertionError("model/quota path must not run for help")

    monkeypatch.setattr(chat_api, "get_client_ip", lambda r: "127.0.0.1")
    monkeypatch.setattr(chat_api.DatabaseService, "get_trial_used", boom)
    monkeypatch.setattr(chat_api.agent_orchestrator, "stream_chat_response", boom)

    client = TestClient(app)
    res = client.post("/api/chat", json={"message": "/foo", "history": []})
    assert res.status_code == 200
    assert res.headers.get("X-Command-Mode") == "static"
    assert "/docs" in res.text
    assert "[DONE]" in res.text


def test_commands_endpoint_returns_registry():
    from fastapi.testclient import TestClient
    from backend.api.main import app

    res = TestClient(app).get("/api/commands")
    assert res.status_code == 200
    names = {c["name"] for c in res.json()["commands"]}
    assert names == set(COMMANDS)
