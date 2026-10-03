from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import json

try:
    from backend.agent.agent import AgentOrchestrator
except ImportError:
    from agent.agent import AgentOrchestrator # type: ignore

router = APIRouter(prefix="/api", tags=["Chat"])
agent_orchestrator = AgentOrchestrator()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

@router.post("/chat")
async def stream_chat(payload: ChatRequest):
    """
    Streams ITZ AI response using Server-Sent Events (SSE).
    Response format: text/event-stream
    Each chunk is: data: {"content": "token"}
    Terminal chunk: data: [DONE]
    """
    history_dicts = [m.dict() for m in payload.history] if payload.history else []

    async def generate():
        async for chunk in agent_orchestrator.stream_chat_response(payload.message, history_dicts):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "ITZ AI Python Backend"}
