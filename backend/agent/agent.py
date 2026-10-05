"""
Dynamic, provider-agnostic orchestrator.
- Any OpenAI-compatible base_url + any model ID via settings / DB config / per-request override.
- No hardcoded Gemini/OpenRouter model IDs. Fallback chain is fully configurable.
"""
import json
import os
from typing import AsyncGenerator, List, Dict, Optional
from openai import OpenAI

try:
    from backend.config.config import settings
    from backend.knowledge.context_builder import build_system_prompt
    from backend.database.db import DatabaseService
except ImportError:
    from config.config import settings
    from knowledge.context_builder import build_system_prompt
    from database.db import DatabaseService


def _resolve_api_key() -> str:
    return (getattr(settings, "OPENROUTER_API_KEY", "") or "").strip() \
        or (getattr(settings, "GEMINI_API_KEY", "") or "").strip() \
        or os.getenv("OPENROUTER_API_KEY", "").strip() \
        or os.getenv("GEMINI_API_KEY", "").strip()


def _resolve_base_url() -> str:
    # Priority: DB/ai_model_config.api_base_url > settings.API_BASE_URL > default
    return (getattr(settings, "API_BASE_URL", "") or "").strip() or "https://openrouter.ai/api/v1"


def _resolve_default_model() -> str:
    return (getattr(settings, "ACTIVE_MODEL", "") or "").strip() \
        or (getattr(settings, "GEMINI_MODEL", "") or "").strip() \
        or "qwen/qwen3.8-27b:free"


class AgentOrchestrator:
    def __init__(self):
        self.api_key = _resolve_api_key()
        self.model = _resolve_default_model()
        self.base_url = _resolve_base_url()
        try:
            self.client = OpenAI(
                base_url=self.base_url,
                api_key=self.api_key,
                default_headers={
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "ITZ AI",
                },
            )
        except Exception:
            self.client = None

    async def stream_chat_response(
        self,
        query: str,
        session_history: List[Dict[str, str]],
        model_override: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        system_prompt = build_system_prompt(query, session_history)

        openai_messages = [{"role": "system", "content": system_prompt}]
        for msg in session_history[-10:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join([str(c.get("text", "")) if isinstance(c, dict) else str(c) for c in content])
            
            # Map roles properly
            if role in ["user", "assistant", "system"]:
                openai_messages.append({"role": role, "content": str(content)})
            else:
                openai_messages.append({"role": "user", "content": str(content)})
        
        openai_messages.append({"role": "user", "content": query})

        if not self.client or not self.api_key:
            mock_text = f"Hello! I am ITZ AI. (Note: OPENROUTER_API_KEY is not set).\n\nYou asked: '{query}'."
            for chunk in mock_text.split(" "):
                yield f"data: {json.dumps({'content': chunk + ' '})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Fetch dynamic model configuration from database (cached)
        model_config = {}
        try:
            model_config = DatabaseService.get_config_table("ai_model_config")
        except Exception:
            pass

        primary_model = (model_override or "").strip() \
            or (model_config.get("active_model") or "").strip() \
            or self.model
        base_url = (model_config.get("api_base_url") or "").strip() or self.base_url or _resolve_base_url()
        # Rebuild client if base_url changed via admin config (dynamic provider support)
        api_key = _resolve_api_key()
        if base_url != getattr(self, "base_url", "") or api_key != getattr(self, "api_key", ""):
            self.base_url = base_url
            self.api_key = api_key
            try:
                self.client = OpenAI(
                    base_url=base_url,
                    api_key=api_key,
                    default_headers={"HTTP-Referer": "http://localhost:3000", "X-Title": "ITZ AI"},
                )
            except Exception:
                self.client = None
        temperature = float(model_config.get("temperature", 0.4))
        reasoning_raw = model_config.get("reasoning_enabled", False)
        if isinstance(reasoning_raw, str):
            reasoning_enabled = reasoning_raw.lower() in ("1", "true", "yes", "on")
        else:
            reasoning_enabled = bool(reasoning_raw)
        fallback_models = [str(m).strip() for m in (model_config.get("fallback_models") or []) if str(m).strip()]

        # Build list of models to try (Primary -> Fallbacks). Fully dynamic, no hardcoded defaults.
        models_to_try = [primary_model]
        for fm in fallback_models:
            if fm not in models_to_try:
                models_to_try.append(fm)

        success = False
        last_error = None

        for current_model in models_to_try:
            try:
                extra_body_params = {}
                if reasoning_enabled:
                    extra_body_params["reasoning"] = {"enabled": True}

                response = self.client.chat.completions.create(
                    model=current_model,
                    messages=openai_messages,
                    temperature=temperature,
                    max_tokens=800,  # Consistent response length constraint
                    stream=True,
                    extra_body=extra_body_params if extra_body_params else None
                )

                for chunk in response:
                    if chunk.choices and chunk.choices[0].delta:
                        delta = chunk.choices[0].delta
                        content = getattr(delta, "content", None)
                        if content:
                            yield f"data: {json.dumps({'content': content})}\n\n"

                yield "data: [DONE]\n\n"
                success = True
                break  # Exit loop if stream completed successfully

            except Exception as e:
                last_error = str(e)
                print(f"Model '{current_model}' failed with error: {last_error}. Trying next fallback...")
                continue

        if not success:
            error_str = last_error or "Unknown API error"
            print(f"All models failed. Last error: {error_str}")
            fallback_response = f"Halo! Berdasarkan knowledge base ITZ AI dan riwayat percakapan Anda, saya memahami pertanyaan Anda mengenai '{query}'. (Catatan: Terjadi kendala saat memanggil OpenRouter API: {error_str})."
            for chunk in fallback_response.split(" "):
                yield f"data: {json.dumps({'content': chunk + ' '})}\n\n"
            yield "data: [DONE]\n\n"
