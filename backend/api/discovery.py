"""API alur discovery publik: konfigurasi, perbandingan RAG, dan brief proyek.

Halaman /chat memakai endpoint `POST /api/chat` dengan `mode="discovery"` untuk
percakapan utama. Modul ini melayani fitur pendukungnya:

- GET  /api/discovery/config          -> ambang RAG, batas turn, sisa turn
- POST /api/discovery/compare         -> jawaban ambang rendah vs tinggi
- POST /api/discovery/brief           -> rangkum sesi jadi brief + simpan lead
- GET/PATCH /api/admin/discovery/...  -> tab Prospek di admin panel

Semua endpoint publik dibatasi `enforce_discovery_limits` (per IP + per sesi).
"""

import json
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

try:
    from backend.agent.agent import AgentOrchestrator
    from backend.api.admin import get_current_admin
    from backend.core.logging_config import get_logger
    from backend.database.db import DatabaseService
    from backend.security.discovery_guard import (
        discovery_limits,
        enforce_discovery_limits,
        is_authenticated,
        normalize_session_id,
    )
    from backend.security.rate_limiter import enforce_rate_limit, get_client_ip
except ImportError:
    from agent.agent import AgentOrchestrator  # type: ignore
    from core.logging_config import get_logger  # type: ignore
    from database.db import DatabaseService  # type: ignore
    from security.discovery_guard import (  # type: ignore
        discovery_limits,
        enforce_discovery_limits,
        is_authenticated,
        normalize_session_id,
    )
    from security.rate_limiter import enforce_rate_limit, get_client_ip  # type: ignore

    from api.admin import get_current_admin  # type: ignore

router = APIRouter(prefix="/api/discovery", tags=["Discovery"])
admin_router = APIRouter(prefix="/api/admin", tags=["Admin Discovery"])
logger = get_logger(__name__)
agent_orchestrator = AgentOrchestrator()

BRIEF_STATUSES = ("new", "contacted", "quoted", "won", "lost")


# ── Model request ─────────────────────────────────────────────────────────


class HistoryMessage(BaseModel):
    # Sama seperti chat: hanya user/assistant, content dibatasi.
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str = Field(min_length=1, max_length=8000)

    @field_validator("content")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class BriefRequest(BaseModel):
    session_id: str | None = Field(default=None, max_length=64)
    name: str = Field(min_length=2, max_length=120)
    contact_channel: str = Field(default="whatsapp", pattern=r"^(whatsapp|email|other)$")
    contact_value: str = Field(min_length=3, max_length=200)
    history: list[HistoryMessage] | None = Field(default=None, max_length=40)
    last_message: str | None = Field(default=None, max_length=4000)


class BriefPatch(BaseModel):
    status: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=2000)


class ContextRequest(BaseModel):
    """Transkrip untuk ekstraksi konteks bisnis (state disimpan di client)."""

    session_id: str | None = Field(default=None, max_length=64)
    history: list[HistoryMessage] = Field(min_length=1, max_length=40)
    # State sebelumnya dari client; dipakai agar field yang sudah diketahui tidak
    # hilang saat model tidak mengulanginya di transkrip berikutnya.
    previous: dict[str, Any] | None = None


# ── Util teks & brief ─────────────────────────────────────────────────────


def _clean(value: Any, limit: int = 600) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit]


def _clean_list(value: Any, *, max_items: int = 8, item_limit: int = 220) -> list[str]:
    if isinstance(value, str):
        parts = re.split(r"[\n;]", value)
    elif isinstance(value, list):
        parts = value
    else:
        parts = []
    out: list[str] = []
    for part in parts:
        text = _clean(part, item_limit)
        if text and text not in out:
            out.append(text)
        if len(out) >= max_items:
            break
    return out


def _normalize_brief(raw: dict[str, Any]) -> dict[str, Any]:
    """Paksa bentuk brief sesuai skema; LLM kadang mengembalikan tipe lain."""
    estimate = raw.get("estimate") if isinstance(raw.get("estimate"), dict) else {}
    integrations = []
    for item in raw.get("integrations") or []:
        if isinstance(item, dict):
            name = _clean(item.get("name"), 80)
            if name:
                integrations.append({"name": name, "why": _clean(item.get("why"), 240)})
        elif isinstance(item, str):
            text = _clean(item, 120)
            if text:
                integrations.append({"name": text, "why": ""})
        if len(integrations) >= 8:
            break

    return {
        "project_title": _clean(raw.get("project_title"), 120) or "Proyek baru",
        "problem": _clean(raw.get("problem"), 900),
        "goals": _clean_list(raw.get("goals")),
        "current_stack": _clean_list(raw.get("current_stack")),
        "data_available": _clean_list(raw.get("data_available")),
        "recommended_solution": _clean(raw.get("recommended_solution"), 1200),
        "integrations": integrations,
        "suggested_scope": _clean_list(raw.get("suggested_scope")),
        "estimate": {
            "range": _clean(estimate.get("range"), 160),
            "timeline": _clean(estimate.get("timeline"), 120),
            "note": _clean(estimate.get("note"), 300),
        },
        "risks": _clean_list(raw.get("risks")),
        "next_steps": _clean_list(raw.get("next_steps")),
    }


def _extract_json(text: str) -> dict[str, Any] | None:
    """Ambil objek JSON pertama dari output model (tahan code fence/preamble)."""
    body = (text or "").strip()
    if body.startswith("```"):
        body = re.sub(r"^```[a-zA-Z]*\s*", "", body)
        body = re.sub(r"\s*```$", "", body)
    start = body.find("{")
    end = body.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(body[start : end + 1])
    except (ValueError, TypeError):
        return None
    return parsed if isinstance(parsed, dict) else None


# ── State discovery terstruktur (diekstrak per giliran, disimpan di client) ─

DISCOVERY_STATUSES = ("confirmed", "inferred", "unknown", "needs_validation")

PROFILE_TEXT_FIELDS = ("business_name", "industry", "business_model", "business_scale")
PROFILE_LIST_FIELDS = ("products_services", "target_customers")
LIST_SECTIONS = (
    "business_challenges",
    "business_objectives",
    "current_workflows",
    "existing_systems",
    "technology_opportunities",
)
STAGE_ORDER = (
    "not_started",
    "information_gathering",
    "business_understanding",
    "problem_identified",
    "solution_exploration",
    "assessment_ready",
)


def _status(raw: Any, default: str = "unknown") -> str:
    value = re.sub(r"[\s-]+", "_", str(raw or "").strip().lower())
    return value if value in DISCOVERY_STATUSES else default


def _field(raw: Any, *, list_value: bool = False) -> dict[str, Any]:
    """Satu field profile: {value, status, evidence}. Toleran terhadap tipe LLM."""
    if isinstance(raw, dict):
        value = raw.get("value")
        status = _status(raw.get("status"), "unknown")
        evidence = _clean(raw.get("evidence"), 180)
    else:
        value = raw
        # Model kadang mengembalikan nilai mentah tanpa status. Nilai yang ada
        # tetap bukan fakta terkonfirmasi: tandai inferred.
        status = "inferred" if value else "unknown"
        evidence = ""
    if list_value:
        items = _clean_list(value)
        if items and status == "unknown":
            status = "inferred"
        return {"value": items, "status": status if items else "unknown", "evidence": evidence}
    text = _clean(value, 200)
    if text and status == "unknown":
        status = "inferred"
    return {"value": text, "status": status if text else "unknown", "evidence": evidence}


def _section(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in raw or []:
        if isinstance(entry, dict):
            value = _clean(entry.get("value") or entry.get("name"), 300)
            status = _status(entry.get("status"), "inferred" if value else "unknown")
            evidence = _clean(entry.get("evidence"), 180)
        else:
            value = _clean(entry, 300)
            status = "inferred" if value else "unknown"
            evidence = ""
        if value and value not in seen:
            seen.add(value)
            out.append({"value": value, "status": status, "evidence": evidence})
        if len(out) >= 12:
            break
    return out


def _recommendations(raw: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for entry in raw or []:
        if not isinstance(entry, dict):
            text = _clean(entry, 160)
            if text:
                out.append(
                    {
                        "name": text,
                        "problem": "",
                        "approach": "",
                        "benefits": "",
                        "technologies": [],
                        "complexity": "",
                        "cost_category": "",
                        "priority": "",
                    }
                )
        else:
            name = _clean(entry.get("name") or entry.get("solution_name"), 160)
            if not name:
                continue
            out.append(
                {
                    "name": name,
                    "problem": _clean(entry.get("problem") or entry.get("problem_addressed"), 400),
                    "approach": _clean(entry.get("approach") or entry.get("proposed_approach"), 400),
                    "benefits": _clean(entry.get("benefits") or entry.get("business_benefits"), 400),
                    "technologies": _clean_list(
                        entry.get("technologies") or entry.get("required_technologies")
                    ),
                    "complexity": _clean(entry.get("complexity") or entry.get("implementation_complexity"), 60),
                    "cost_category": _clean(entry.get("cost_category") or entry.get("cost"), 40),
                    "priority": _clean(entry.get("priority") or entry.get("recommended_priority"), 40),
                }
            )
        if len(out) >= 5:
            break
    return out


def _merge_section(previous: Any, current: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Gabung item lama + baru per nilai; item baru menimpa status/evidence lama."""
    by_value: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for entry in previous or []:
        if not isinstance(entry, dict):
            continue
        value = _clean(entry.get("value"), 300)
        if not value:
            continue
        by_value[value] = {
            "value": value,
            "status": _status(entry.get("status"), "inferred"),
            "evidence": _clean(entry.get("evidence"), 180),
        }
        order.append(value)
    for entry in current:
        value = entry["value"]
        if value not in by_value:
            order.append(value)
        by_value[value] = entry
    return [by_value[v] for v in order][:16]


def _has_profile(state: dict[str, Any]) -> bool:
    profile = state["business_profile"]
    return any(profile[key]["status"] != "unknown" for key in ("industry", "business_model"))


def _compute_stage(state: dict[str, Any]) -> str:
    """Progress dari kelengkapan informasi, bukan jumlah pesan."""
    if not _has_profile(state) and not state["business_challenges"]:
        return "not_started"
    if not _has_profile(state):
        return "information_gathering"
    if not state["business_challenges"]:
        return "business_understanding"
    if not state["business_objectives"]:
        return "problem_identified"
    if not state["technology_opportunities"] and not state["recommendations"]:
        return "solution_exploration"
    return "assessment_ready"


def _normalize_discovery_state(raw: Any, previous: Any = None) -> dict[str, Any]:
    """Paksa output model jadi state valid; gabung dengan state sebelumnya."""
    raw = raw if isinstance(raw, dict) else {}
    prev = previous if isinstance(previous, dict) else {}
    raw_profile = raw.get("business_profile") if isinstance(raw.get("business_profile"), dict) else {}
    prev_profile = prev.get("business_profile") if isinstance(prev.get("business_profile"), dict) else {}

    profile: dict[str, Any] = {}
    for key in PROFILE_TEXT_FIELDS:
        field = _field(raw_profile.get(key))
        if field["status"] == "unknown" and prev_profile.get(key) is not None:
            field = _field(prev_profile.get(key))
        profile[key] = field
    for key in PROFILE_LIST_FIELDS:
        field = _field(raw_profile.get(key), list_value=True)
        if field["status"] == "unknown" and prev_profile.get(key) is not None:
            field = _field(prev_profile.get(key), list_value=True)
        profile[key] = field

    state: dict[str, Any] = {"business_profile": profile}
    for section in LIST_SECTIONS:
        merged = _merge_section(prev.get(section), _section(raw.get(section)))
        state[section] = merged

    state["recommendations"] = _recommendations(raw.get("recommendations"))
    if not state["recommendations"]:
        state["recommendations"] = _recommendations(prev.get("recommendations"))
    questions = _clean_list(raw.get("open_questions"), max_items=8, item_limit=220)
    if not questions and isinstance(prev.get("open_questions"), list):
        questions = _clean_list(prev.get("open_questions"), max_items=8, item_limit=220)
    state["open_questions"] = questions
    state["discovery_stage"] = _compute_stage(state)
    return state


_DISCOVERY_STATE_SYSTEM_PROMPT = (
    "Kamu adalah mesin ekstraksi konteks discovery bisnis. Baca transkrip antara Klien dan "
    "Konsultan, lalu kembalikan SATU objek JSON valid tanpa markdown/penjelasan. Bahasa Indonesia. "
    "Tugasmu HANYA merangkum apa yang benar-benar dikatakan klien, bukan menebak. "
    "Aturan status: 'confirmed' = klien menyebut eksplisit; 'inferred' = kesimpulan wajar dari ucapan "
    "klien; 'unknown' = belum ada info; 'needs_validation' = perlu dikonfirmasi. "
    "Jangan mengarang nama bisnis, angka, anggaran, atau sistem yang tidak disebut. "
    "Jangan memaksakan solusi AI: technology_opportunities/recommendations boleh berupa perbaikan proses, "
    "website, aplikasi, CRM, ERP, otomasi, integrasi, analitik, atau AI. "
    "Skema: "
    '{"business_profile": {"business_name": {"value": str, "status": str, "evidence": str}, '
    '"industry": {...}, "business_model": {...}, '
    '"products_services": {"value": [str], "status": str, "evidence": str}, '
    '"target_customers": {"value": [str], "status": str, "evidence": str}, "business_scale": {...}}, '
    '"business_challenges": [{"value": str, "status": str, "evidence": str}], '
    '"business_objectives": [{"value": str, "status": str, "evidence": str}], '
    '"current_workflows": [{"value": str, "status": str, "evidence": str}], '
    '"existing_systems": [{"value": str, "status": str, "evidence": str}], '
    '"technology_opportunities": [{"value": str, "status": str, "evidence": str}], '
    '"recommendations": [{"name": str, "problem": str, "approach": str, "benefits": str, '
    '"technologies": [str], "complexity": "Low|Medium|High", "cost_category": "Low|Medium|High", '
    '"priority": str}], '
    '"open_questions": [str]}'
)


async def _extract_discovery_state(history: list[dict[str, str]]) -> dict[str, Any] | None:
    transcript = _transcript_text(history, None)
    if not transcript:
        return None
    messages = [
        {"role": "system", "content": _DISCOVERY_STATE_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Transkrip:\n\n{transcript[:12000]}\n\nKembalikan JSON state discovery.",
        },
    ]
    text = await agent_orchestrator.complete(messages, temperature=0.1, max_tokens=1600)
    return _extract_json(text)


def _transcript_text(history: list[dict[str, str]], last_message: str | None) -> str:
    lines = []
    for msg in history[-24:]:
        role = "Klien" if str(msg.get("role")) == "user" else "Konsultan"
        lines.append(f"{role}: {_clean(msg.get('content'), 900)}")
    if last_message:
        lines.append(f"Klien: {_clean(last_message, 900)}")
    return "\n".join(lines)


def _brief_to_markdown(brief: dict[str, Any], name: str, contact_channel: str, contact_value: str) -> str:
    def bullets(items: list[str]) -> str:
        return "\n".join(f"- {x}" for x in items) if items else "- (belum diisi)"

    integrations = (
        "\n".join(f"- **{i['name']}** - {i['why']}" if i.get("why") else f"- **{i['name']}**" for i in brief["integrations"])
        or "- (belum diisi)"
    )
    estimate = brief["estimate"]
    estimate_bits = [x for x in (estimate.get("range"), estimate.get("timeline")) if x]
    estimate_line = " · ".join(estimate_bits) if estimate_bits else "Akan dikonfirmasi tim"

    next_steps = "\n".join(f"{i + 1}. {x}" for i, x in enumerate(brief["next_steps"])) or "1. Konfirmasi lingkup dan jadwal."

    return (
        f"# Brief Proyek - {brief['project_title']}\n\n"
        f"**Disiapkan untuk:** {name}  \n"
        f"**Kontak:** {contact_channel} · {contact_value}\n\n"
        "## Masalah\n"
        f"{brief['problem'] or '(belum diisi)'}\n\n"
        "## Tujuan\n"
        f"{bullets(brief['goals'])}\n\n"
        "## Kondisi saat ini\n"
        f"{bullets(brief['current_stack'])}\n\n"
        "## Data yang tersedia\n"
        f"{bullets(brief['data_available'])}\n\n"
        "## Solusi yang disarankan\n"
        f"{brief['recommended_solution'] or '(belum diisi)'}\n\n"
        "## Integrasi\n"
        f"{integrations}\n\n"
        "## Lingkup awal\n"
        f"{bullets(brief['suggested_scope'])}\n\n"
        "## Estimasi\n"
        f"{estimate_line}\n"
        f"{estimate.get('note') or ''}\n\n"
        "## Risiko & catatan\n"
        f"{bullets(brief['risks'])}\n\n"
        "## Langkah berikutnya\n"
        f"{next_steps}\n\n"
        "> Estimasi di atas bersifat kasar, bukan penawaran resmi. Tim akan mengonfirmasi setelah lingkup disepakati.\n"
    )


_BRIEF_SYSTEM_PROMPT = (
    "Kamu adalah analis proyek dari agensi pengembangan aplikasi web/mobile dan integrasi AI. "
    "Tugasmu merangkum transkrip sesi discovery menjadi brief proyek. "
    "Balas HANYA dengan satu objek JSON valid, tanpa markdown, tanpa penjelasan. "
    "Gunakan Bahasa Indonesia. Jangan mengarang angka atau komitmen yang tidak disebut klien; "
    "untuk estimasi, tulis rentang kasar dan tandai bahwa itu perlu konfirmasi. "
    "Skema JSON yang wajib dipakai: "
    '{"project_title": str, "problem": str, "goals": [str], "current_stack": [str], '
    '"data_available": [str], "recommended_solution": str, '
    '"integrations": [{"name": str, "why": str}], "suggested_scope": [str], '
    '"estimate": {"range": str, "timeline": str, "note": str}, "risks": [str], "next_steps": [str]}'
)


async def _generate_brief(history: list[dict[str, str]], last_message: str | None) -> dict[str, Any]:
    transcript = _transcript_text(history, last_message)
    if not transcript:
        raise HTTPException(status_code=400, detail="Belum ada percakapan untuk dirangkum")

    messages = [
        {"role": "system", "content": _BRIEF_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Transkrip discovery:\n\n{transcript[:12000]}\n\nBuat brief proyeknya sekarang (JSON saja).",
        },
    ]
    text = await agent_orchestrator.complete(messages, temperature=0.2, max_tokens=1600)
    parsed = _extract_json(text)
    if not parsed:
        # Fallback heuristik: jangan gagalkan klien yang sudah mengisi kontak.
        logger.warning("[discovery] ringkasan brief bukan JSON valid; memakai fallback heuristik")
        parsed = {
            "project_title": "Proyek baru",
            "problem": _clean(transcript, 900),
            "goals": [],
            "current_stack": [],
            "data_available": [],
            "recommended_solution": "",
            "integrations": [],
            "suggested_scope": [],
            "estimate": {},
            "risks": ["Brief ini dibuat otomatis tanpa ringkasan model - perlu ditinjau tim."],
            "next_steps": ["Tinjau brief bersama tim", "Konfirmasi lingkup dan jadwal"],
        }
    return _normalize_brief(parsed)


# ── Endpoint publik ───────────────────────────────────────────────────────


@router.get("/config")
def discovery_config(request: Request, session_id: str | None = None):
    """Parameter aktif untuk UI: ambang RAG, batas turn, sisa turn sesi."""
    limits = discovery_limits()
    max_turns = limits["max_turns"]
    remaining = None
    sid = normalize_session_id(session_id)
    if sid:
        used = DatabaseService.peek_rate_limit(f"disc:turn:{sid}")
        if used is not None:
            remaining = max(0, max_turns - int(used))
    settings = DatabaseService.get_app_settings()
    return {
        "max_turns": max_turns,
        "authenticated": is_authenticated(request),
        "remaining_turns": remaining,
        "threshold_low": float(settings.get("rag_threshold_low") or 0.55),
        "threshold_high": float(settings.get("rag_threshold_high") or 0.67),
        "compare_enabled": True,
    }


@router.post("/brief")
async def save_brief(payload: BriefRequest, request: Request):
    """Rangkum sesi jadi brief terstruktur, simpan lead, kembalikan markdown."""
    session_id = normalize_session_id(payload.session_id) or "unknown"
    ip = get_client_ip(request)
    enforce_rate_limit(
        f"disc:brief:{ip}",
        5,
        86400,
        durable=True,
        detail="Batas pembuatan brief harian tercapai. Hubungi kami langsung.",
    )

    history = [m.model_dump() for m in payload.history] if payload.history else []
    brief = await _generate_brief(history, payload.last_message)
    markdown = _brief_to_markdown(brief, payload.name.strip(), payload.contact_channel, payload.contact_value.strip())

    transcript = ([*history, {"role": "user", "content": payload.last_message}] if payload.last_message else history)[-40:]
    try:
        row = DatabaseService.create_discovery_brief(
            {
                "session_key": session_id,
                "name": payload.name.strip(),
                "contact_channel": payload.contact_channel,
                "contact_value": payload.contact_value.strip(),
                "summary": brief.get("problem") or brief.get("recommended_solution"),
                "brief": brief,
                "transcript": transcript,
                "turn_count": len(history),
            }
        )
    except Exception as e:
        logger.warning(f"[discovery] gagal menyimpan brief: {e}")
        row = {"id": None}

    logger.info(
        "[discovery] brief disimpan id=%s channel=%s turns=%s",
        row.get("id"),
        payload.contact_channel,
        len(history),
    )
    return {
        "id": row.get("id"),
        "brief": brief,
        "markdown": markdown,
        "created_at": row.get("created_at"),
    }


@router.post("/context")
async def extract_context(payload: ContextRequest, request: Request):
    """Ekstrak konteks bisnis terstruktur dari transkrip (state disimpan client).

    Satu panggilan model per request; dipanggil client secara berkala, bukan tiap
    frame stream. Bila model gagal/mengembalikan non-JSON, state sebelumnya
    dipertahankan agar panel tidak kosong.
    """
    session_id = normalize_session_id(payload.session_id)
    ip = get_client_ip(request)
    enforce_rate_limit(
        f"disc:ctx:{ip}",
        30,
        3600,
        durable=True,
        detail="Batas pembaruan insight tercapai. Coba lagi beberapa saat lagi.",
    )
    history = [m.model_dump() for m in payload.history]
    raw = await _extract_discovery_state(history)
    state = _normalize_discovery_state(raw or {}, payload.previous)
    logger.info(
        "[discovery] context stage=%s challenges=%s session=%s",
        state["discovery_stage"],
        len(state["business_challenges"]),
        session_id,
    )
    return {"state": state, "session_id": session_id}


# ── Endpoint admin: prospek ───────────────────────────────────────────────


@admin_router.get("/discovery/briefs")
def admin_list_briefs(
    limit: int = 100,
    status: str | None = None,
    admin: str = Depends(get_current_admin),
):
    return {
        "briefs": DatabaseService.list_discovery_briefs(limit=limit, status=status),
        "statuses": list(BRIEF_STATUSES),
    }


@admin_router.get("/discovery/briefs/{brief_id}")
def admin_get_brief(brief_id: str, admin: str = Depends(get_current_admin)):
    row = DatabaseService.get_discovery_brief(brief_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Brief tidak ditemukan")
    return {"brief": row}


@admin_router.patch("/discovery/briefs/{brief_id}")
def admin_update_brief(
    brief_id: str,
    payload: BriefPatch,
    request: Request,
    admin: str = Depends(get_current_admin),
):
    if payload.status and payload.status not in BRIEF_STATUSES:
        raise HTTPException(status_code=400, detail="Status tidak dikenal")
    row = DatabaseService.update_discovery_brief(brief_id, {"status": payload.status, "notes": payload.notes})
    if row is None:
        raise HTTPException(status_code=404, detail="Brief tidak ditemukan atau status tidak valid")
    logger.info("[discovery] prospek %s diperbarui oleh %s -> %s", brief_id, admin, row.get("status"))
    return {"brief": row}
