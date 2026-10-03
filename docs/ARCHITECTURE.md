# ITZ AI Architecture Documentation

## 1. Overview
ITZ AI follows a modular, clean multi-layer architecture separating the presentation layer (Next.js), application & API layer (FastAPI / Vercel Python Functions), AI orchestration layer (LangChain + OpenAI), knowledge layer (Supabase PostgreSQL + pgvector), and security layer.

## 2. Layered Architecture

```
Presentation Layer (Next.js 14+ App Router, TypeScript, Tailwind CSS)
    ↓ (HTTP / SSE Stream)
API Layer (FastAPI Python Backend / Vercel Functions)
    ↓
Application & Domain Layer (Agent Orchestrator, Context Builder)
    ↓
AI Orchestration Layer (LangChain + OpenAI API / Provider Abstraction)
    ↓
Knowledge Layer (Supabase PostgreSQL + pgvector HNSW search)
```

## 3. Directory Structure
```
project/
├── app/                  # Next.js frontend (Chat UI & Admin Panel)
├── backend/              # Python backend core
│   ├── api/              # FastAPI routes (chat.py, admin.py)
│   ├── agent/            # LangChain orchestrator & prompt generator
│   ├── knowledge/        # Vector search, embeddings, context builder
│   ├── database/         # Supabase client & local fallback storage
│   ├── security/         # JWT auth, password hashing, cookies
│   └── config/           # Pydantic settings loader
├── docs/                 # PRD, Architecture, AI System, Security, Schema
├── data/                 # Local backup storage
└── requirements.txt      # Python dependencies
```
