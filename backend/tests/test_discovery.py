"""Unit test alur discovery publik: trace retrieval, brief, dan pembatas sesi."""

import pytest
from fastapi import HTTPException

import backend.knowledge.knowledge_service as ks
from backend.api.discovery import (
    _brief_to_markdown,
    _extract_json,
    _normalize_brief,
    _normalize_discovery_state,
)
from backend.database.settings_repo import (
    KONSULTAN_STYLE,
    PERSONA_DEFAULTS,
)
from backend.knowledge.context_builder import (
    BUSINESS_CONSULTING_RULES,
    _build_discovery_prompt,
)
from backend.security.discovery_guard import (
    enforce_discovery_limits,
    normalize_session_id,
)

# ── Persona konsultan ───────────────────────────────────────────────────


def test_discovery_prompt_uses_consultant_rules_and_hides_internal_jargon():
    prompt = _build_discovery_prompt({"name": "ITZ AI"}, "KB contoh")

    assert "Fakta yang boleh disebut" in prompt
    assert "Layanan resmi ITZ AI" in prompt
    assert "Pengetahuan" not in prompt, "nama bagian internal tidak boleh bocor ke prompt"
    assert "Nominal rupiah" in prompt
    assert "HANYA boleh disebut bila tertulis" in prompt
    assert "KB contoh" in prompt
    assert "{brand}" not in prompt


def test_business_rules_inject_brand_without_leftover_placeholder():
    rules = BUSINESS_CONSULTING_RULES.format(brand="ITZ AI")

    assert "anggota tim ITZ AI" in rules
    assert "{brand}" not in rules
    assert "emoji" in rules
    assert "Aturan keras" not in rules  # aturan keras khusus mode discovery


def test_persona_defaults_cover_all_config_tables_and_konsultan_style():
    assert set(PERSONA_DEFAULTS) == {
        "ai_identity",
        "personal_information",
        "ai_personality",
        "communication_settings",
        "system_instructions",
    }
    for table, values in PERSONA_DEFAULTS.items():
        assert values, f"{table} tidak boleh kosong"
        assert all(str(v).strip() for v in values.values()), f"{table} punya nilai kosong"
    assert KONSULTAN_STYLE["id"] == "konsultan"
    assert "tanpa emoji" in KONSULTAN_STYLE["prompt"]


# ── Trace retrieval & ambang eksplisit ────────────────────────────────────


def test_explicit_threshold_does_not_fall_back_to_keyword(monkeypatch):
    """Ambang eksplisit = uji presisi: jangan diam-diam pakai kata kunci."""
    monkeypatch.setattr(
        ks.KnowledgeService, "_vector_candidates", staticmethod(lambda *_a, **_k: [])
    )
    called = {"keyword": False}

    def _fake_keyword(*_a, **_k):
        called["keyword"] = True
        return [(3, "potongan", "e1")]

    monkeypatch.setattr(ks, "_keyword_search_scored", _fake_keyword)

    out = ks.KnowledgeService.semantic_search_detailed("apa itu RAG?", match_count=4, threshold=0.67)

    assert out["method"] == "none"
    assert out["chunks"] == []
    assert out["threshold"] == 0.67
    assert called["keyword"] is False


def test_without_threshold_keyword_fallback_still_used(monkeypatch):
    monkeypatch.setattr(
        ks.KnowledgeService, "_vector_candidates", staticmethod(lambda *_a, **_k: [])
    )
    monkeypatch.setattr(ks, "_current_match_threshold", lambda: 0.64)
    monkeypatch.setattr(ks, "_keyword_search_scored", lambda *_a, **_k: [(2, "potongan", "e1")])
    monkeypatch.setattr(ks, "_entry_title_map", lambda: {"e1": "Judul"})

    out = ks.KnowledgeService.semantic_search_detailed("apa itu RAG?", match_count=4)

    assert out["method"] == "keyword"
    assert out["chunks"][0]["title"] == "Judul"
    assert out["chunks"][0]["score"] == 2.0


def test_vector_scores_are_rounded_and_titled(monkeypatch):
    rows = [
        {"content_chunk": "isi", "similarity": 0.712345, "entry_id": "e1"},
        {"content_chunk": "isi 2", "similarity": 0.600001, "entry_id": "e2"},
    ]
    monkeypatch.setattr(
        ks.KnowledgeService, "_vector_candidates", staticmethod(lambda *_a, **_k: rows)
    )
    monkeypatch.setattr(ks, "_entry_title_map", lambda: {"e1": "Satu", "e2": "Dua"})

    out = ks.KnowledgeService.semantic_search_detailed("tanya", match_count=4, threshold=0.55)

    assert out["method"] == "vector"
    assert [c["score"] for c in out["chunks"]] == [0.7123, 0.6]
    assert [c["title"] for c in out["chunks"]] == ["Satu", "Dua"]


# ── Brief ────────────────────────────────────────────────────────────────


def test_normalize_brief_coerces_llm_shapes():
    raw = {
        "project_title": "  Chatbot SOP  ",
        "problem": "Banyak pertanyaan berulang.",
        "goals": "Balas cepat; Kurangi beban admin",
        "integrations": ["WhatsApp Business API", {"name": "Google Sheets", "why": "stok"}, {"why": "tanpa nama"}],
        "estimate": {"range": "Rp10-20jt", "timeline": "4 minggu"},
        "risks": None,
        "next_steps": ["Konfirmasi lingkup"],
    }

    out = _normalize_brief(raw)

    assert out["project_title"] == "Chatbot SOP"
    assert out["goals"] == ["Balas cepat", "Kurangi beban admin"]
    assert out["integrations"] == [
        {"name": "WhatsApp Business API", "why": ""},
        {"name": "Google Sheets", "why": "stok"},
    ]
    assert out["estimate"]["range"] == "Rp10-20jt"
    assert out["risks"] == []


def test_brief_markdown_has_sections_and_disclaimer():
    brief = _normalize_brief(
        {
            "project_title": "Otomasi WA",
            "problem": "Balasan manual.",
            "recommended_solution": "Chatbot WhatsApp.",
            "integrations": [{"name": "WhatsApp API", "why": "balas otomatis"}],
            "estimate": {"range": "Rp10-20jt", "timeline": "3-4 minggu"},
            "next_steps": ["Diskusi teknis"],
        }
    )

    md = _brief_to_markdown(brief, "Toko Melati", "whatsapp", "+62812")

    assert "# Brief Proyek - Otomasi WA" in md
    assert "Toko Melati" in md
    assert "**WhatsApp API** - balas otomatis" in md
    assert "Rp10-20jt · 3-4 minggu" in md
    assert "1. Diskusi teknis" in md
    assert "bukan penawaran resmi" in md


def test_extract_json_tolerates_code_fence_and_preamble():
    assert _extract_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert _extract_json('Berikut briefnya: {"a": 2} semoga cocok') == {"a": 2}
    assert _extract_json("bukan json") is None
    assert _extract_json("[1,2,3]") is None


# ── State discovery terstruktur ──────────────────────────────────────────


def test_discovery_state_empty_is_not_started():
    state = _normalize_discovery_state({})

    assert state["discovery_stage"] == "not_started"
    assert state["business_profile"]["industry"]["status"] == "unknown"
    assert state["business_profile"]["products_services"]["value"] == []
    assert state["business_challenges"] == []
    assert state["open_questions"] == []


def test_discovery_state_stage_follows_completeness_not_message_count():
    raw = {
        "business_profile": {
            "industry": {"value": "Laundry", "status": "confirmed", "evidence": "klien menyebut laundry"},
            "products_services": {"value": ["Cuci kiloan", "Setrika"], "status": "confirmed"},
        },
        "business_challenges": [{"value": "Admin kewalahan membalas chat", "status": "confirmed"}],
        "business_objectives": [],
    }

    state = _normalize_discovery_state(raw)

    assert state["business_profile"]["products_services"]["value"] == ["Cuci kiloan", "Setrika"]
    assert state["business_challenges"][0]["evidence"] == ""
    assert state["discovery_stage"] == "problem_identified"


def test_discovery_state_keeps_previous_field_when_new_is_unknown():
    previous = {
        "business_profile": {
            "industry": {"value": "Laundry", "status": "confirmed", "evidence": "awal"},
            "business_model": {"value": "Jasa", "status": "confirmed"},
        },
        "business_challenges": [{"value": "Balas chat manual", "status": "confirmed"}],
    }
    raw = {
        "business_profile": {"industry": {"value": "", "status": "unknown"}},
        "business_challenges": [{"value": "Rekap laporan manual", "status": "inferred"}],
    }

    state = _normalize_discovery_state(raw, previous)

    assert state["business_profile"]["industry"]["value"] == "Laundry"
    assert state["business_profile"]["business_model"]["value"] == "Jasa"
    # Union: item lama tidak hilang, item baru ikut masuk.
    assert [c["value"] for c in state["business_challenges"]] == [
        "Balas chat manual",
        "Rekap laporan manual",
    ]


def test_discovery_state_coerces_unknown_status_and_keeps_evidence():
    raw = {
        "business_profile": {
            "industry": {"value": "Katering", "status": "pasti", "evidence": "ucapan klien"},
        },
        "technology_opportunities": ["Dashboard pesanan", {"value": "CRM", "status": "needs_validation"}],
    }

    state = _normalize_discovery_state(raw)

    assert state["business_profile"]["industry"]["status"] == "inferred"
    assert state["business_profile"]["industry"]["evidence"] == "ucapan klien"
    assert state["technology_opportunities"][1]["status"] == "needs_validation"


# ── Session id & pembatas ────────────────────────────────────────────────


@pytest.mark.parametrize("value", ["", "   ", None])
def test_normalize_session_id_allows_empty(value):
    assert normalize_session_id(value) is None


def test_normalize_session_id_accepts_uuid_and_rejects_short_or_symbols():
    assert normalize_session_id("3f1a9c2e-8b77-4f2d-9c1a-0b5e6d7c8a91")
    with pytest.raises(HTTPException) as exc:
        normalize_session_id("pendek")
    assert exc.value.status_code == 400
    with pytest.raises(HTTPException):
        normalize_session_id("tidak/valid?x=1")


def test_enforce_discovery_limits_charges_two_turns_for_compare(monkeypatch):
    from backend.security import discovery_guard as dg

    monkeypatch.setattr(
        dg,
        "discovery_limits",
        lambda: {"max_turns": 20, "per_min": 12, "per_day": 60},
    )
    monkeypatch.setattr(dg, "get_client_ip", lambda _req: "1.2.3.4")
    calls = []
    monkeypatch.setattr(dg, "enforce_rate_limit", lambda key, limit, window, **kw: calls.append(key))

    dg.enforce_discovery_limits(object(), "sesi-valid-123", turns=2)

    assert calls.count("disc:turn:sesi-valid-123") == 2
    assert "disc:min:1.2.3.4" in calls
    assert "disc:day:1.2.3.4" in calls


def test_enforce_discovery_limits_propagates_429(monkeypatch):
    from backend.security import discovery_guard as dg

    monkeypatch.setattr(
        dg, "discovery_limits", lambda: {"max_turns": 1, "per_min": 12, "per_day": 60}
    )
    monkeypatch.setattr(dg, "get_client_ip", lambda _req: "1.2.3.4")

    def _boom(*_a, **_k):
        raise HTTPException(status_code=429, detail="Sesi discovery ini sudah mencapai batas pesan.")

    monkeypatch.setattr(dg, "enforce_rate_limit", _boom)

    with pytest.raises(HTTPException) as exc:
        enforce_discovery_limits(object(), "sesi-valid-123")
    assert exc.value.status_code == 429
