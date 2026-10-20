"""
Dynamic, provider-agnostic orchestrator.
- Any OpenAI-compatible base_url + any model ID via settings / DB config / per-request override.
- No hardcoded Gemini/OpenRouter model IDs. Fallback chain is fully configurable.
"""

import contextlib
import json
import os
import re
import time
from collections.abc import AsyncGenerator
from typing import Any

from openai import OpenAI

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_THINK_PROCESS_RE = re.compile(r"Here's a thinking process:.*?(?=\n\n|\Z)", re.DOTALL | re.IGNORECASE)


_TAIL_HOLD = 24
_CLOSING_RE = re.compile(r"(?:^|\n)[ \t]*(?:Done|Selesai)\.?[ \t]*$", re.IGNORECASE)


def _clean_chunk(text: str) -> str:
    if not text:
        return ""
    text = _THINK_RE.sub("", text)
    text = _THINK_PROCESS_RE.sub("", text)
    # Drop common reasoning preamble lines that leak raw trace
    if "Analyze User Input:" in text or "Formulate Response" in text:
        return ""
    # Aturan gaya: em dash (-) dan en dash (-) diganti tanda hubung biasa.
    # Tanda hubung Unicode (U+2010, U+2011, U+2012, U+2212) juga dinormalisasi.
    for ch in ("\u2010", "\u2011", "\u2012", "\u2212"):
        text = text.replace(ch, "-")
    return text.replace("\u2014", ", ").replace("\u2013", "-")


# --- SSE (Server-Sent Events) helpers ----------------------------------------


_CLIENT_HEADERS = {"HTTP-Referer": "http://localhost:3000", "X-Title": "ITZ AI"}


def _emit(payload: dict[str, Any]) -> str:
    """Serialisasi satu event SSE."""
    return f"data: {json.dumps(payload)}\n\n"


async def _emit_words(text: str) -> AsyncGenerator[str, None]:
    """Stream teks kata-per-kata (dipakai mock & ultimate-fallback)."""
    for chunk in text.split(" "):
        yield _emit({"content": chunk + " "})


async def _emit_closing(
    tail: str,
    usage: dict[str, Any] | None,
    ttft_ms: int | None,
    start: float,
    *,
    current_model: str = "",
    max_tokens: int | None = None,
    finish_reason: str | None = None,
) -> AsyncGenerator[str, None]:
    """Event penutup stream: sisa buffer, usage, timing, answered, DONE."""
    if tail:
        yield _emit({"content": tail})
    if finish_reason == "length" and max_tokens is not None:
        logger.warning(
            f"Warning: jawaban terpotong (finish_reason=length, max_tokens={max_tokens}, model={current_model})"
        )
    if usage:
        yield _emit({"usage": usage})
    total_ms = int((time.perf_counter() - start) * 1000)
    yield _emit({"timing": {"ttft_ms": ttft_ms if ttft_ms is not None else total_ms, "total_ms": total_ms}})
    yield _emit({"answered": True})
    yield "data: [DONE]\n\n"


async def _emit_buffered(
    text: str,
    start: float,
    ttft_holder: list[int | None],
    usage: dict[str, Any] | None = None,
) -> AsyncGenerator[str, None]:
    """Stream `text` dalam buffer 12 char (smooth, tanpa sleep), lalu event penutup."""
    if ttft_holder[0] is None:
        ttft_holder[0] = int((time.perf_counter() - start) * 1000)
    buffer = ""
    for char in text:
        buffer += char
        if len(buffer) >= 12:
            yield _emit({"content": buffer})
            buffer = ""
    # Sisa buffer dikirim sekali oleh _emit_closing sebagai tail.
    async for event in _emit_closing(buffer, usage, ttft_holder[0], start):
        yield event


def _parse_bool(v: Any) -> bool:
    """Parse konfigurasi boolean yang bisa datang sebagai str atau bool."""
    if isinstance(v, str):
        return v.lower() in ("1", "true", "yes", "on")
    return bool(v)


def _merge_models(primary: str, fallback_raw: Any) -> list[str]:
    """Primary -> fallbacks, tanpa duplikat, tanpa hardcoded default."""
    models = [primary]
    for fm in [str(m or "").strip() for m in (fallback_raw or []) if str(m or "").strip()]:
        if fm not in models:
            models.append(fm)
    return models


def _build_openai_messages(
    query: str, session_history: list[dict[str, str]], system_prompt: str
) -> list[dict[str, str]]:
    """Susun daftar pesan OpenAI: system + 10 history terakhir + query."""
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for msg in session_history[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if isinstance(content, list):
            content = " ".join([str(c.get("text", "")) if isinstance(c, dict) else str(c) for c in content])

        # Map roles properly
        if role in ["user", "assistant", "system"]:
            messages.append({"role": role, "content": str(content)})
        else:
            messages.append({"role": "user", "content": str(content)})

    messages.append({"role": "user", "content": query})
    return messages


def _create_client(provider: str, api_key: str, base_url: str, nvidia_api_key: str) -> tuple[Any | None, str | None]:
    """Buat client sesuai provider. Return (client, client_type)."""
    if provider.lower() == "nvidia" and nvidia_api_key:
        try:
            from langchain_nvidia_ai_endpoints import ChatNVIDIA

            return (
                ChatNVIDIA(
                    model=settings.NVIDIA_MODEL,
                    api_key=nvidia_api_key,
                    temperature=1,
                    top_p=0.95,
                    max_tokens=8192,
                ),
                "langchain_nvidia",
            )
        except ImportError:
            logger.warning("Warning: langchain_nvidia_ai_endpoints not installed. Falling back to OpenAI client.")
            return None, None
    # Default to OpenAI-compatible client
    try:
        return (
            OpenAI(base_url=base_url, api_key=api_key, default_headers=_CLIENT_HEADERS),
            "openai",
        )
    except Exception:
        return None, None


try:
    from backend.config.config import settings
    from backend.core.logging_config import get_logger
    from backend.database.db import DatabaseService
    from backend.knowledge.context_builder import build_system_prompt
except ImportError:
    from config.config import settings
    from core.logging_config import get_logger  # type: ignore
    from database.db import DatabaseService
    from knowledge.context_builder import build_system_prompt

logger = get_logger(__name__)


def _strip_key(v: str) -> str:
    return (v or "").strip().strip('"').strip("'").strip()


def _resolve_api_key(provider: str = "") -> str:
    p = (provider or "").lower()
    groq = _strip_key(getattr(settings, "GROQ_API_KEY", "") or "") or _strip_key(os.getenv("GROQ_API_KEY", "") or "")
    openrouter = _strip_key(getattr(settings, "OPENROUTER_API_KEY", "") or "") or _strip_key(
        os.getenv("OPENROUTER_API_KEY", "") or ""
    )
    # also accept OPENROUTER_API_KEY from 9router alias if user uses that naming
    nine = _strip_key(os.getenv("OPENROUTER_API_KEY", "") or "") or _strip_key(
        os.getenv("NINE_ROUTER_API_KEY", "") or ""
    )
    gemini = _strip_key(getattr(settings, "GEMINI_API_KEY", "") or "") or _strip_key(
        os.getenv("GEMINI_API_KEY", "") or ""
    )
    if p == "groq":
        return groq or openrouter or nine or gemini
    return openrouter or nine or groq or gemini


def _resolve_nvidia_api_key() -> str:
    return (getattr(settings, "NVIDIA_API_KEY", "") or "").strip() or os.getenv("NVIDIA_API_KEY", "").strip()


def _resolve_provider() -> str:
    return (
        (getattr(settings, "MODEL_PROVIDER", "") or "").strip()
        or os.getenv("MODEL_PROVIDER", "").strip()
        or "openrouter"
    )


def _resolve_base_url(provider: str = "") -> str:
    # Priority: DB/ai_model_config.api_base_url > settings.API_BASE_URL > provider default
    explicit = (getattr(settings, "API_BASE_URL", "") or "").strip() or os.getenv("API_BASE_URL", "").strip()
    if explicit:
        return explicit
    if (provider or "").lower() == "groq":
        return os.getenv("API_BASE_URL_GROQ", "").strip() or "https://api.groq.com/openai/v1"
    return (os.getenv("OPENROUTER_BASE_URL", "") or "").strip() or "https://openrouter.ai/api/v1"


def _resolve_default_model(provider: str = "") -> str:
    if (provider or "").lower() == "groq":
        return (
            (getattr(settings, "GROQ_MODEL", "") or "").strip()
            or os.getenv("GROQ_MODEL", "").strip()
            or (getattr(settings, "ACTIVE_MODEL", "") or "").strip()
        )
    return (getattr(settings, "ACTIVE_MODEL", "") or "").strip() or (
        getattr(settings, "GEMINI_MODEL", "") or ""
    ).strip()


class AgentOrchestrator:
    def __init__(self):
        self.provider = _resolve_provider()
        self.api_key = _resolve_api_key(self.provider)
        self.nvidia_api_key = _resolve_nvidia_api_key()
        self.model = _resolve_default_model(self.provider)
        self.base_url = _resolve_base_url(self.provider)
        self.client, self.client_type = _create_client(self.provider, self.api_key, self.base_url, self.nvidia_api_key)

    async def stream_chat_response(
        self,
        query: str,
        session_history: list[dict[str, str]],
        model_override: str | None = None,
        user_profile: dict[str, Any] | None = None,
        command_names: list[str] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Orkestrasi utama: bangun prompt, resolve runtime config, stream per model (fallback chain)."""
        start = time.perf_counter()
        ttft_holder: list[int | None] = [None]
        system_prompt = build_system_prompt(
            query, session_history, user_profile=user_profile, command_names=command_names
        )
        openai_messages = _build_openai_messages(query, session_history, system_prompt)

        # Check client availability based on provider
        if not self.client:
            if self.client_type == "langchain_nvidia" and not self.nvidia_api_key:
                mock_text = f"Hello! I am ITZ AI. (Note: NVIDIA_API_KEY is not set).\n\nYou asked: '{query}'."
            else:
                mock_text = f"Hello! I am ITZ AI. (Note: OPENROUTER_API_KEY is not set).\n\nYou asked: '{query}'."
            async for event in _emit_words(mock_text):
                yield event
            yield "data: [DONE]\n\n"
            return

        runtime = self._resolve_runtime_config(model_override)
        model_config: dict[str, Any] = runtime["config"]
        provider: str = runtime["provider"]
        temperature: float = runtime["temperature"]
        reasoning_enabled: bool = runtime["reasoning_enabled"]

        success = False
        last_error = None

        for current_model in runtime["models_to_try"]:
            try:
                # Handle different client types
                if self.client_type == "langchain_nvidia":
                    async for event in self._stream_langchain_nvidia(openai_messages, start, ttft_holder):
                        yield event
                else:
                    async for event in self._stream_openai_compat(
                        current_model,
                        openai_messages,
                        model_config,
                        provider,
                        temperature,
                        reasoning_enabled,
                        start,
                        ttft_holder,
                    ):
                        yield event
                success = True
                break  # Exit loop if stream completed successfully

            except Exception as e:
                last_error = str(e)
                logger.warning(f"Model '{current_model}' failed with error: {last_error}. Trying next fallback...")
                continue

        if not success:
            error_str = last_error or "Unknown API error"
            logger.warning(f"All models failed. Last error: {error_str}")
            total_ms = int((time.perf_counter() - start) * 1000)
            fallback_response = f"Halo! Berdasarkan knowledge base ITZ AI dan riwayat percakapan Anda, saya memahami pertanyaan Anda mengenai '{query}'. (Catatan: Terjadi kendala saat memanggil model AI. Coba lagi beberapa saat.)"
            async for event in _emit_words(fallback_response):
                yield event
            yield _emit({"timing": {"ttft_ms": total_ms, "total_ms": total_ms}})
            yield "data: [DONE]\n\n"

    def _resolve_runtime_config(self, model_override: str | None) -> dict[str, Any]:
        """Config runtime dari DB (cached) + override per-request; rebuild client bila berubah."""
        # Fetch dynamic model configuration from database (cached)
        model_config: dict[str, Any] = {}
        with contextlib.suppress(Exception):
            model_config = DatabaseService.get_config_table("ai_model_config")

        primary_model = (model_override or "").strip() or (model_config.get("active_model") or "").strip() or self.model
        provider = (model_config.get("provider") or "").strip() or self.provider or _resolve_provider()
        base_url = (model_config.get("api_base_url") or "").strip() or self.base_url or _resolve_base_url(provider)

        # Rebuild client if provider or base_url changed via admin config
        api_key = _resolve_api_key(provider)
        nvidia_api_key = _resolve_nvidia_api_key()

        needs_rebuild = (
            base_url != getattr(self, "base_url", "")
            or api_key != getattr(self, "api_key", "")
            or provider != getattr(self, "provider", "")
            or nvidia_api_key != getattr(self, "nvidia_api_key", "")
        )

        if needs_rebuild:
            self.base_url = base_url
            self.api_key = api_key
            self.nvidia_api_key = nvidia_api_key
            self.provider = provider
            self.client, self.client_type = _create_client(provider, api_key, base_url, nvidia_api_key)

        return {
            "config": model_config,
            "primary_model": primary_model,
            "provider": provider,
            "base_url": base_url,
            "api_key": api_key,
            "nvidia_api_key": nvidia_api_key,
            "temperature": float(model_config.get("temperature", 0.4)),
            "reasoning_enabled": _parse_bool(model_config.get("reasoning_enabled", False)),
            "models_to_try": _merge_models(primary_model, model_config.get("fallback_models")),
        }

    async def _stream_langchain_nvidia(
        self,
        openai_messages: list[dict[str, str]],
        start: float,
        ttft_holder: list[int | None],
    ) -> AsyncGenerator[str, None]:
        """Stream via LangChain ChatNVIDIA (non-token streaming; konten di-chunk manual)."""
        # Konversi pesan OpenAI ke format LangChain; system disederhanakan jadi user + note
        langchain_messages = []
        for msg in openai_messages:
            if msg["role"] == "system":
                langchain_messages.append({"role": "user", "content": f"[System]: {msg['content']}"})
            else:
                langchain_messages.append({"role": msg["role"], "content": msg["content"]})

        response = self.client.invoke(langchain_messages)

        # Extract content dari LangChain response
        if hasattr(response, "content"):
            content_text = response.content
        elif isinstance(response, dict) and "content" in response:
            content_text = response["content"]
        else:
            content_text = str(response)

        # Token usage (usage_metadata) untuk analitik admin
        usage: dict[str, Any] | None = None
        _um = getattr(response, "usage_metadata", None)
        if isinstance(_um, dict):
            usage = {
                "prompt_tokens": int(_um.get("input_tokens", 0) or 0),
                "completion_tokens": int(_um.get("output_tokens", 0) or 0),
                "total_tokens": int(_um.get("total_tokens", 0) or 0),
            }

        # Stream konten dalam buffer 12 char (smooth, tanpa sleep)
        content_text = _CLOSING_RE.sub("", _clean_chunk(content_text))
        async for event in _emit_buffered(content_text, start, ttft_holder, usage):
            yield event

    async def _stream_openai_compat(
        self,
        current_model: str,
        openai_messages: list[dict[str, str]],
        model_config: dict[str, Any],
        provider: str,
        temperature: float,
        reasoning_enabled: bool,
        start: float,
        ttft_holder: list[int | None],
    ) -> AsyncGenerator[str, None]:
        """Stream via OpenAI-compatible client (Groq / OpenRouter)."""
        # Reasoning dimatikan agar output bersih terstruktur.
        extra_body_params = {}
        if reasoning_enabled and provider.lower() != "groq":
            extra_body_params["reasoning"] = {"enabled": True}

        # Reasoning models (gpt-oss dkk) bakal token utk berpikir dari budget ini,
        # jadi 800 kekecilan -> jawaban kepotong di tengah (finish_reason=length).
        try:
            max_tokens = int(model_config.get("max_tokens") or 8192)
        except (TypeError, ValueError):
            max_tokens = 8192
        if max_tokens < 1024:
            max_tokens = 1024

        response = self.client.chat.completions.create(
            model=current_model,
            messages=openai_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            stream_options={"include_usage": True},
            extra_body=extra_body_params if extra_body_params else None,
        )

        # Buffer 12 chars = 2-3 kata per flush, smooth tanpa flicker. Tanpa sleep.
        buffer = ""
        finish_reason = None
        usage: dict[str, Any] | None = None
        tail = ""

        for chunk in response:
            _u = getattr(chunk, "usage", None)
            if _u is not None:
                usage = {
                    "prompt_tokens": int(getattr(_u, "prompt_tokens", 0) or 0),
                    "completion_tokens": int(getattr(_u, "completion_tokens", 0) or 0),
                    "total_tokens": int(getattr(_u, "total_tokens", 0) or 0),
                }
            if chunk.choices and chunk.choices[0].delta:
                if getattr(chunk.choices[0], "finish_reason", None):
                    finish_reason = chunk.choices[0].finish_reason
                delta = chunk.choices[0].delta
                # Abaikan reasoning trace agar tidak bocor ke UI
                if getattr(delta, "reasoning", None):
                    continue
                content = _clean_chunk(getattr(delta, "content", None) or "")
                if not content:
                    continue
                if ttft_holder[0] is None:
                    ttft_holder[0] = int((time.perf_counter() - start) * 1000)
                buffer += content
                # Flush buffer ke tail; _TAIL_HOLD menahan akhir jawaban agar
                # garis closing ("Done./Selesai.") bisa dibersihkan sebelum kirim.
                if len(buffer) >= 12:
                    tail += buffer
                    buffer = ""
                    if len(tail) > _TAIL_HOLD:
                        emit, tail = tail[:-_TAIL_HOLD], tail[-_TAIL_HOLD:]
                        yield _emit({"content": emit})

        final_tail = _CLOSING_RE.sub("", tail + buffer)
        async for event in _emit_closing(
            final_tail,
            usage,
            ttft_holder[0],
            start,
            current_model=current_model,
            max_tokens=max_tokens,
            finish_reason=finish_reason,
        ):
            yield event
