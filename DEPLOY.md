# Deploy ke Vercel

Arsitektur: Next.js frontend + FastAPI sebagai file-based Python function
(`api/[...path].py`) — satu project, satu domain.

## Alur request di Vercel

```
Browser → /api/python/* → rewrite → /api/* → api/[...path].py → FastAPI
Embedding query → HuggingFace Inference API (multilingual MiniLM, 384d)
Chat LLM → Groq API
Storage → Supabase (pgvector)
```

## checklist deploy

### 1. Supabase — jalankan `supabase_migration.sql`

SQL Editor → paste seluruh isi `supabase_migration.sql` → Run.
Membuat tabel yang sebelumnya cuma ada di file lokal (tidak awet di serverless):
`ai_model_config`, `app_settings`, `app_users` (+ seed user febry/sasha),
`trial_usage`, `request_events`, `model_latency`. Idempoten — boleh di-run ulang.

### 2. Buat HF token (gratis)

1. Login di https://huggingface.co
2. https://huggingface.co/settings/tokens → Create token → role **Read**
3. Copy token (`hf_...`)

### 3. Import project ke Vercel

Git repo → Vercel → Add New Project → import repo ini. Framework auto-detect:
Next.js. Tanpa konfigurasi tambahan (sudah ada `vercel.json`).

### 4. Environment Variables (Project Settings → Environment Variables)

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://xxwyhcdlifthahkvatka.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | dari `.env` lokal |
| `SUPABASE_ANON_KEY` | dari `.env` lokal |
| `GROQ_API_KEY` | dari `.env` lokal |
| `HF_TOKEN` | token dari langkah 2 |
| `EMBEDDING_PROVIDER` | `hf` |
| `MATCH_THRESHOLD` | `0.22` |
| `JWT_SECRET_KEY` | **string acak kuat, min 32 karakter** (yang di `.env` lokal masih default — wajib diganti di Vercel) |
| `ADMIN_USERNAME` | username admin |
| `ADMIN_PASSWORD_HASH` | bcrypt hash dari `.env` lokal |
| `NODE_ENV` | `production` |
| `VERCEL_FORCE_PYTHON_STREAMING` | `1` |

Catatan: `data/storage/*.json` TIDAK dibawa ke Vercel (gitignored + FS ephemeral).
Semua state hidup di Supabase setelah langkah 1.

### 5. Deploy

Push ke branch utama (auto-deploy) atau `vercel deploy`. Setelah live:

1. `https://<domain>/api/cron/warmup` → `{"status":"ok"}` = embedding HF jalan
   (cron harian 03:00 UTC jaga model tetap hangat).
2. Login `/admin` → tab AI Models → pastikan `openai/gpt-oss-20b` / Groq tampil.
3. Chat `/` → tanya "Berapa anggaran proyek Kalkara-7?" → harus
   "Rp 9.417.500.000" (bukti retrieval hidup di Vercel).

## Catatan teknis

- **Endpoint embedding**: HF lama (`api-inference.huggingface.co`) sudah
  dimatikan. Kode memakai `router.huggingface.co/hf-inference/...` + token.
- **Model embedding**: `paraphrase-multilingual-MiniLM-L12-v2` (384 dimensi).
  Vektor di Supabase sudah di-reindex dengan model ini — kompatibel HF API.
  Ganti model = wajib reindex (`python -m backend.test_rag --reindex`).
- **Indexing knowledge**: sinkron (BackgroundTasks dibuang — serverless mati
  setelah response terkirim).
- **Rate limit in-memory** (`middleware.ts`, `security/middleware.py`):
  per-instance di serverless — pelonggaran teknis, bukan kebocoran.
- **Local dev tidak berubah**: `uvicorn backend.api.main:app` + `npm run dev`
  (rewrite dev tetap arah `localhost:8000`).
- **Offline fallback**: `.env` lokal sengaja dibiarkan `EMBEDDING_PROVIDER=local`
  (model multilingual yang sama jalan di CPU, tanpa HF token). Nilai `hf` untuk
  produksi di-set di Environment Variables Vercel, bukan di `.env` (yang tidak
  ikut ter-deploy). Ganti ke `hf` lokal butuh `HF_TOKEN` di `.env` + tidak perlu
  reindex (satu model, vektor kompatibel).
