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
│   ├── tools/            # Script dev/ops (reindex, test pipeline manual)
│   └── config/           # Pydantic settings loader
├── components/           # Chat UI components
├── docs/                 # Architecture, deployment, security, schema
├── migrations/           # Skema Supabase (jalankan manual di SQL Editor)
├── public/               # Aset statis (favicon, logo, template JSON admin)
├── data/                 # Local fallback storage (gitignored)
└── requirements.txt      # Python dependencies
```

## 4. Document Attachment Flow (`/doc`)

1. `POST /api/user/documents/extract` (login + `doc_upload`) validates magic
   bytes, extracts text off the event loop, splits it into chunks, and stores
   the document server-side (`user_documents`, with local JSON fallback).
   Response contains metadata + `doc_id` only - never the text.
2. Client attaches up to 5 `doc_id`s and sends `document_ids` with `/api/chat`.
3. Backend verifies ownership, retrieves only the top-k relevant chunks per
   document (lexical scoring), wraps them as untrusted data, and injects them
   into the final user turn. A `sources` SSE event carries title/page/excerpt
   for citation chips.
4. Chat history binds `document_ids` to the session so reopening a chat restores
   its attachments; documents and bindings expire after `DOC_RETENTION_DAYS`.
5. Each saved message also carries its own `document_ids`, so the user-message
   file chip is restored per message when a chat is reopened (see
   `supabase_migration_chat_message_documents.sql`).
6. After the answer stream, a best-effort non-streaming model call produces 3
   suggested follow-up questions, emitted as a `suggestions` SSE event held
   before `[DONE]`. Suggestions are shown only on the latest assistant message
   and are not persisted.
7. `migrations/supabase_migration_documents.sql` and
   `migrations/supabase_migration_chat_message_documents.sql` must be run
   manually in the Supabase SQL Editor for server-side persistence (otherwise
   the local JSON fallback is used).
