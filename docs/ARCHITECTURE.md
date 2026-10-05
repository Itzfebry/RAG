# ITZ AI Architecture Documentation

## 1. Overview
ITZ AI follows a modular, clean multi-layer architecture separating the presentation layer (Next.js), application & API layer (FastAPI / Vercel Python Functions), AI orchestration layer (OpenAI-compatible provider via OpenAI SDK), knowledge layer (Supabase PostgreSQL + pgvector + local JSON fallback), and security layer.

## 2. Layered Architecture

```
Presentation Layer (Next.js 14+ App Router, TypeScript, Tailwind CSS)
    ↓ (HTTP / SSE Stream)
API Layer (FastAPI Python Backend / Vercel Functions)
    ↓
Application & Domain Layer (Agent Orchestrator, Context Builder)
    ↓
AI Orchestration Layer (OpenAI SDK + provider-agnostic base_url / model routing + fallback chain)
    ↓
Knowledge Layer (Supabase PostgreSQL + pgvector HNSW search, local JSON fallback in data/storage/)
```

## 3. Directory Structure
```
project/
├── app/                  # Next.js frontend (Chat UI & Admin Panel)
├── backend/              # Python backend core
│   ├── api/              # FastAPI routes (chat.py, admin.py, main.py)
│   ├── agent/            # Provider-agnostic orchestrator (OpenAI SDK)
│   ├── knowledge/        # Semantic search, context builder
│   ├── database/         # Supabase client & local fallback storage
│   ├── security/         # JWT auth, password hashing, cookies
│   └── config/           # Pydantic settings loader
├── components/           # Chat UI components
├── docs/                 # Architecture, deployment, security, schema
├── data/                 # admin_bulk_example.json + local fallback (storage/ gitignored)
└── requirements.txt      # Python dependencies
```
