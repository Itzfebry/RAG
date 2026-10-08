"""
Dynamic, provider-agnostic orchestrator.
- Any OpenAI-compatible base_url + any model ID via settings / DB config / per-request override.
- No hardcoded Gemini/OpenRouter model IDs. Fallback chain is fully configurable.
"""
import json
import os
import re
import time
import asyncio
from typing import AsyncGenerator, List, Dict, Optional, Any, Union
from openai import OpenAI

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_THINK_PROCESS_RE = re.compile(r"Here's a thinking process:.*?(?=\n\n|\Z)", re.DOTALL | re.IGNORECASE)


def _clean_chunk(text: str) -> str:
    if not text:
        return ""
    text = _THINK_RE.sub("", text)
    text = _THINK_PROCESS_RE.sub("", text)
    # Drop common reasoning preamble lines that leak raw trace
    if "Analyze User Input:" in text or "Formulate Response" in text:
        return ""
    return text

try:
    from backend.config.config import settings
    from backend.knowledge.context_builder import build_system_prompt
    from backend.database.db import DatabaseService
except ImportError:
    from config.config import settings
    from knowledge.context_builder import build_system_prompt
    from database.db import DatabaseService


def _resolve_api_key(provider: str = "") -> str:
    p = (provider or "").lower()
    groq = (getattr(settings, "GROQ_API_KEY", "") or "").strip() or os.getenv("GROQ_API_KEY", "").strip()
    openrouter = (getattr(settings, "OPENROUTER_API_KEY", "") or "").strip() or os.getenv("OPENROUTER_API_KEY", "").strip()
    gemini = (getattr(settings, "GEMINI_API_KEY", "") or "").strip() or os.getenv("GEMINI_API_KEY", "").strip()
    if p == "groq":
        return groq or openrouter or gemini
    return openrouter or groq or gemini

def _resolve_nvidia_api_key() -> str:
    return (getattr(settings, "NVIDIA_API_KEY", "") or "").strip() \
        or os.getenv("NVIDIA_API_KEY", "").strip()

def _resolve_provider() -> str:
    return (getattr(settings, "MODEL_PROVIDER", "") or "").strip() \
        or os.getenv("MODEL_PROVIDER", "").strip() \
        or "openrouter"


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
        return (getattr(settings, "GROQ_MODEL", "") or "").strip() \
            or os.getenv("GROQ_MODEL", "").strip() \
            or (getattr(settings, "ACTIVE_MODEL", "") or "").strip() \
            or "llama-3.1-8b-instant"
    return (getattr(settings, "ACTIVE_MODEL", "") or "").strip() \
        or (getattr(settings, "GEMINI_MODEL", "") or "").strip() \
        or "qwen/qwen3.8-27b:free"


class AgentOrchestrator:
    def __init__(self):
        self.provider = _resolve_provider()
        self.api_key = _resolve_api_key(self.provider)
        self.nvidia_api_key = _resolve_nvidia_api_key()
        self.model = _resolve_default_model(self.provider)
        self.base_url = _resolve_base_url(self.provider)
        self.client: Union[OpenAI, Any] = None
        
        # Initialize client based on provider
        if self.provider.lower() == "nvidia" and self.nvidia_api_key:
            try:
                from langchain_nvidia_ai_endpoints import ChatNVIDIA
                self.client = ChatNVIDIA(
                    model="poolside/laguna-xs-2.1",
                    api_key=self.nvidia_api_key,
                    temperature=1,
                    top_p=0.95,
                    max_tokens=8192,
                )
                self.client_type = "langchain_nvidia"
            except ImportError:
                print("Warning: langchain_nvidia_ai_endpoints not installed. Falling back to OpenAI client.")
                self.client = None
        else:
            # Default to OpenAI-compatible client
            try:
                self.client = OpenAI(
                    base_url=self.base_url,
                    api_key=self.api_key,
                    default_headers={
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "ITZ AI",
                    },
                )
                self.client_type = "openai"
            except Exception:
                self.client = None
                self.client_type = None

    async def stream_chat_response(
        self,
        query: str,
        session_history: List[Dict[str, str]],
        model_override: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        start = time.perf_counter()
        ttft_ms: Optional[int] = None
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

        # Check client availability based on provider
        if not self.client:
            if self.client_type == "langchain_nvidia" and not self.nvidia_api_key:
                mock_text = f"Hello! I am ITZ AI. (Note: NVIDIA_API_KEY is not set).\n\nYou asked: '{query}'."
            else:
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
        provider = (model_config.get("provider") or "").strip() or self.provider or _resolve_provider()
        base_url = (model_config.get("api_base_url") or "").strip() or self.base_url or _resolve_base_url(provider)
        
        # Rebuild client if provider or base_url changed via admin config
        api_key = _resolve_api_key(provider)
        nvidia_api_key = _resolve_nvidia_api_key()
        
        needs_rebuild = (
            base_url != getattr(self, "base_url", "") or 
            api_key != getattr(self, "api_key", "") or
            provider != getattr(self, "provider", "") or
            nvidia_api_key != getattr(self, "nvidia_api_key", "")
        )
        
        if needs_rebuild:
            self.base_url = base_url
            self.api_key = api_key
            self.nvidia_api_key = nvidia_api_key
            self.provider = provider
            
            if provider.lower() == "nvidia" and nvidia_api_key:
                try:
                    from langchain_nvidia_ai_endpoints import ChatNVIDIA
                    self.client = ChatNVIDIA(
                        model="poolside/laguna-xs-2.1",
                        api_key=nvidia_api_key,
                        temperature=1,
                        top_p=0.95,
                        max_tokens=8192,
                    )
                    self.client_type = "langchain_nvidia"
                except ImportError:
                    print("Warning: langchain_nvidia_ai_endpoints not installed. Falling back to OpenAI client.")
                    self.client = None
            else:
                # Default to OpenAI-compatible client
                try:
                    self.client = OpenAI(
                        base_url=base_url,
                        api_key=api_key,
                        default_headers={"HTTP-Referer": "http://localhost:3000", "X-Title": "ITZ AI"},
                    )
                    self.client_type = "openai"
                except Exception:
                    self.client = None
                    self.client_type = None
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
                # Handle different client types
                if self.client_type == "langchain_nvidia":
                    # LangChain Nvidia client - invoke with messages (including system prompt and history)
                    # Convert OpenAI format messages to LangChain format
                    langchain_messages = []
                    for msg in openai_messages:
                        if msg["role"] == "system":
                            # LangChain uses HumanMessage/AIMessage/SystemMessage
                            # For simplicity, include system as user message with note
                            langchain_messages.append({"role": "user", "content": f"[System]: {msg['content']}"})
                        else:
                            langchain_messages.append({"role": msg["role"], "content": msg["content"]})
                    
                    response = self.client.invoke(langchain_messages)
                    
                    # Extract content from LangChain response
                    if hasattr(response, 'content'):
                        content_text = response.content
                    elif isinstance(response, dict) and 'content' in response:
                        content_text = response['content']
                    else:
                        content_text = str(response)
                    
                    # Stream content in chunks - 12 chars smooth, tanpa sleep
                    content_text = _clean_chunk(content_text)
                    if ttft_ms is None:
                        ttft_ms = int((time.perf_counter() - start) * 1000)
                    buffer = ""
                    buffer_size = 12
                    for char in content_text:
                        buffer += char
                        if len(buffer) >= buffer_size:
                            yield f"data: {json.dumps({'content': buffer})}\n\n"
                            buffer = ""
                    
                    # Flush remaining
                    if buffer:
                        yield f"data: {json.dumps({'content': buffer})}\n\n"
                    
                    total_ms = int((time.perf_counter() - start) * 1000)
                    yield f"data: {json.dumps({'timing': {'ttft_ms': ttft_ms if ttft_ms is not None else total_ms, 'total_ms': total_ms}})}\n\n"
                    yield "data: [DONE]\n\n"
                    success = True
                    break
                
                else:
                    # OpenAI-compatible client (Groq / OpenRouter). reasoning dimatikan agar output bersih terstruktur.
                    extra_body_params = {}
                    if reasoning_enabled and provider.lower() != "groq":
                        extra_body_params["reasoning"] = {"enabled": True}

                    response = self.client.chat.completions.create(
                        model=current_model,
                        messages=openai_messages,
                        temperature=temperature,
                        max_tokens=800,  # Consistent response length constraint
                        stream=True,
                        extra_body=extra_body_params if extra_body_params else None
                    )

                    # Buffer 12 chars = 2-3 kata per flush, smooth tanpa flicker. Tanpa sleep.
                    buffer = ""
                    buffer_size = 12

                    for chunk in response:
                        if chunk.choices and chunk.choices[0].delta:
                            delta = chunk.choices[0].delta
                            # Abaikan reasoning trace agar tidak bocor ke UI
                            if getattr(delta, "reasoning", None):
                                continue
                            content = _clean_chunk(getattr(delta, "content", None) or "")
                            if not content:
                                continue
                            if ttft_ms is None:
                                ttft_ms = int((time.perf_counter() - start) * 1000)
                            buffer += content
                            # Flush buffer when threshold reached
                            if len(buffer) >= buffer_size:
                                yield f"data: {json.dumps({'content': buffer})}\n\n"
                                buffer = ""
                    
                    # Flush remaining buffer
                    if buffer:
                        yield f"data: {json.dumps({'content': buffer})}\n\n"

                    total_ms = int((time.perf_counter() - start) * 1000)
                    yield f"data: {json.dumps({'timing': {'ttft_ms': ttft_ms if ttft_ms is not None else total_ms, 'total_ms': total_ms}})}\n\n"
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
            total_ms = int((time.perf_counter() - start) * 1000)
            fallback_response = f"Halo! Berdasarkan knowledge base ITZ AI dan riwayat percakapan Anda, saya memahami pertanyaan Anda mengenai '{query}'. (Catatan: Terjadi kendala saat memanggil OpenRouter API: {error_str})."
            for chunk in fallback_response.split(" "):
                yield f"data: {json.dumps({'content': chunk + ' '})}\n\n"
            yield f"data: {json.dumps({'timing': {'ttft_ms': total_ms, 'total_ms': total_ms}})}\n\n"
            yield "data: [DONE]\n\n"
