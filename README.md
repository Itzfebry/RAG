# ITZ AI — Personal AI Assistant & Agent

Personal AI Agent powered by LangChain, OpenAI, Supabase PostgreSQL with `pgvector`, Next.js 14+ UI, and secure Python backend API.

---

## 🌟 Core Features

- **Personal AI Chat (`/`)**: Minimalist chat interface with streaming responses, markdown support, syntax highlighting, and temporary session memory.
- **Admin Panel (`/admin`)**: Secure control center for managing AI Identity, Personal Information, Knowledge Base, Personality, Communication Style, and System Instructions.
- **Semantic Knowledge Retrieval**: Embeddings stored in Supabase PostgreSQL (`pgvector` with HNSW index) for high-relevance owner knowledge retrieval.
- **Secure Architecture**: Server-side authentication, HTTPOnly cookies, API key protection, and modular Python backend.

---

## 🚀 Quick Start (Local Development)

1. Clone repository & install dependencies:
   ```bash
   npm install
   pip install -r requirements.txt
   ```
2. Configure environment variables (`.env` based on `.env.example`).
3. Run Python FastAPI Backend:
   ```bash
   python backend/api/main.py
   ```
4. Run Next.js Frontend:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000` for chat and `http://localhost:3000/admin` for the admin panel.
