import json
from typing import AsyncGenerator, List, Dict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

try:
    from backend.config.config import settings
    from backend.knowledge.context_builder import build_system_prompt
except ImportError:
    from config.config import settings
    from knowledge.context_builder import build_system_prompt

class AgentOrchestrator:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL
        self.llm = ChatGoogleGenerativeAI(
            model=self.model,
            google_api_key=self.api_key,
            temperature=0.4,
            streaming=True
        ) if self.api_key else None

    async def stream_chat_response(
        self,
        query: str,
        session_history: List[Dict[str, str]]
    ) -> AsyncGenerator[str, None]:
        system_prompt = build_system_prompt(query, session_history)

        langchain_messages = [SystemMessage(content=system_prompt)]
        for msg in session_history[-10:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join([str(c.get("text", "")) if isinstance(c, dict) else str(c) for c in content])
            if role == "user":
                langchain_messages.append(HumanMessage(content=str(content)))
            else:
                langchain_messages.append(AIMessage(content=str(content)))
        
        langchain_messages.append(HumanMessage(content=query))

        if not self.llm:
            mock_text = f"Hello! I am ITZ AI. (Note: GEMINI_API_KEY is not set).\n\nYou asked: '{query}'."
            for chunk in mock_text.split(" "):
                yield f"data: {json.dumps({'content': chunk + ' '})}\n\n"
            yield "data: [DONE]\n\n"
            return

        try:
            async for chunk in self.llm.astream(langchain_messages):
                if chunk and chunk.content:
                    raw_content = chunk.content
                    if isinstance(raw_content, list):
                        token = "".join([str(c.get("text", "")) if isinstance(c, dict) else str(c) for c in raw_content])
                    else:
                        token = str(raw_content)
                    
                    if token:
                        yield f"data: {json.dumps({'content': token})}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            error_msg = f"Error during Gemini generation: {str(e)}"
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
            yield "data: [DONE]\n\n"
