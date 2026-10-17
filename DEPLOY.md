# Deploy ke Vercel

Arsitektur: Next.js frontend + FastAPI sebagai file-based Python function
(`api/[...path].py`) — satu project, satu domain.

## Alur request di Vercel

```
Browser → /api/python/* → rewrite → /api/* → api/[...path].py → FastAPI
Embedding query → Gemini API (gemini-embedding-2, 768 dim)
Chat LLM → Groq API
Storage → Supabase (pgvector)
```

## checklist deploy

### 1. Supabase — jalankan `supabase_migration.sql`

SQL Editor → paste seluruh isi `supabase_migration.sql` → Run.
Membuat tabel yang sebelumnya cuma ada di file lokal (tidak awet di serverless):
`ai_model_config`, `app_settings`, `app_users` (+ seed user febry/sasha),
`trial_usage`, `request_events`, `model_latency`. Idempoten — boleh di-run ulang.

Jalankan juga migrasi fitur setelahnya (idempoten, urutan bebas):
`supabase_migration_auth_hardening.sql`, `supabase_migration_email_otp.sql`,
`supabase_migration_session_version.sql`, `supabase_migration_admin_session.sql`,
`supabase_migration_profiles_tokens.sql`, `supabase_migration_pricing.sql`,
`supabase_migration_audit.sql`, `supabase_migration_chat_history.sql`,
`supabase_migration_rag_settings.sql`, `supabase_migration_response_styles.sql`,
`supabase_migration_768.sql` (384 → 768), `supabase_migration_knowledge.sql`
(tabel knowledge + RPC `match_knowledge_entries`), `supabase_migration_rate_limits.sql`.

### 2. Siapkan API key embedding (Gemini)

Vektor di Supabase sudah diindex dengan **gemini-embedding-2, 768 dimensi**.
Maka provider embedding di produksi harus `gemini` — jangan diganti ke `hf`
(model MiniLM 384 dimensi → query vector tidak cocok dengan kolom `vector(768)`
dan retrieval gagal `dimension mismatch`).

1. Buka https://aistudio.google.com/apikey → Create API key
2. Copy key (`AIza...`) → dipakai sebagai `GEMINI_API_KEY`

(HF_TOKEN tidak lagi dipakai kecuali `EMBEDDING_PROVIDER=hf` + reindex ulang.)

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
| `GEMINI_API_KEY` | **wajib untuk RAG**; dari langkah 2 (embedding `gemini`) |
| `EMBEDDING_PROVIDER` | **`gemini`** — jangan `hf`; vektor di DB 768 dimensi |
| `GEMINI_EMBEDDING_MODEL` | opsional; default kode `gemini-embedding-2` |
| `EMBEDDING_DIM` | opsional; default kode `768` (harus sama dengan kolom vector) |
| `MATCH_THRESHOLD` | opsional; default kode `0.64` untuk provider `gemini` (0.25 untuk non-gemini) |
| `CRON_SECRET` | string acak; Vercel mengirim `Authorization: Bearer <CRON_SECRET>` ke `/api/cron/warmup` |
| `CORS_ORIGIN_REGEX` | opsional, default `https://itzfebry\.vercel\.app` |
| `ADMIN_PASSWORD_HASH` | **wajib** bcrypt hash dari `.env` lokal; tidak ada default |
| `JWT_SECRET_KEY` | **string acak kuat, min 32 karakter, berbeda dari `.env` lokal** (semua cookie lama tidak berlaku setelah ganti) |
| `ADMIN_USERNAME` | username admin |
| `NODE_ENV` | `production` |
| `VERCEL_FORCE_PYTHON_STREAMING` | `1` |
| `GOOGLE_CLIENT_ID` | opsional; dari Google Cloud Console (OAuth client) |
| `GOOGLE_CLIENT_SECRET` | opsional; pasangan client id |
| `GOOGLE_REDIRECT_URI` | `https://<domain>/api/python/auth/google-callback` (harus sama persis dengan Authorized redirect URIs di Google Console) |
| `SMTP_USER` | opsional; email Gmail pengirim OTP (mis. `bot@gmail.com`) |
| `SMTP_PASSWORD` | App Password Gmail (tanpa spasi) |
| `SMTP_HOST` / `SMTP_PORT` | opsional; default `smtp.gmail.com` / `587` |
| `MAIL_FROM` | opsional; nama+email pengirim (mis. `ITZ AI <bot@gmail.com>`) |
| `RESEND_API_KEY` | opsional; alternatif SMTP (`SMTP_*` diprioritaskan) |
| `OTP_TTL_MINUTES` / `OTP_MAX_ATTEMPTS` | opsional; default `10` / `5` |
| `DUITKU_MERCHANT_CODE` / `DUITKU_API_KEY` | opsional; credential proyek Duitku (passport.duitku.com/Project). Diisi = pembayaran otomatis: order dapat paymentUrl, kuota aktif sendiri lewat callback `/api/payment/duitku/callback`. Kosongkan = QRIS manual + konfirmasi admin |
| `DUITKU_ENV` | opsional; `sandbox` untuk uji coba, default `production` |
| `PUBLIC_BASE_URL` | wajib kalau pakai Duitku; origin publik `https://<domain>` (callback Duitku harus bisa mengakses `/api/payment/duitku/callback` dari internet) |

Catatan: verifikasi email & reset kata sandi **wajib** salah satu provider email (`SMTP_*` atau `RESEND_API_KEY`). Tanpa itu, di produksi kirim OTP gagal dan user baru tidak bisa lolos gate verifikasi. Login Google hanya muncul kalau `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` terisi.

Catatan tambahan: `data/storage/*.json` TIDAK dibawa ke Vercel (gitignored + FS ephemeral).
Semua state hidup di Supabase setelah langkah 1.

### 5. Deploy

Push ke branch utama (auto-deploy) atau `vercel deploy`. Setelah live:

1. `https://<domain>/api/cron/warmup` dengan header
   `Authorization: Bearer <CRON_SECRET>` → `{"status":"ok"}` = embedding Gemini
   jalan (cron harian 03:00 UTC juga membuang baris `rate_limits` kedaluwarsa).
2. Login `/admin` → tab AI Models → pastikan `openai/gpt-oss-120b` / Groq tampil.
3. Chat `/` → tanya "Berapa anggaran proyek Kalkara-7?" → harus
   "Rp 9.417.500.000" (bukti retrieval hidup di Vercel).
4. Akun ber-email yang `email_verified=false` akan kena gate `403` di chat.
   User bisa verifikasi sendiri lewat login → layar kode OTP.
5. Klik **MASUK DENGAN GOOGLE** di `/login` → pastikan `redirect_uri` di
   Google Console persis `https://<domain>/api/python/auth/google-callback`.

## Catatan teknis

- **Endpoint embedding**: `gemini` → `GEMINI_EMBEDDING_MODEL`
  (`gemini-embedding-2`), dimensi `EMBEDDING_DIM` = **768**. Fallback lain
  (`hf` = MiniLM 384 dimensi, `local` = on-CPU) hanya cocok kalau DB ikut
  di-reindex; kalau tidak, query vector tidak cocok dengan kolom `vector(768)`.
- **Model embedding**: vektor di Supabase sudah diindex dengan
  `gemini-embedding-2` (768 dim). Ganti model = wajib reindex
  (`python -m backend.test_rag --reindex`) + sesuaikan `EMBEDDING_DIM`.
- **Indexing knowledge**: sinkron (BackgroundTasks dibuang — serverless mati
  setelah response terkirim).
- **Rate limit in-memory** (`proxy.ts`, `security/middleware.py`): per-instance
  di serverless — pelonggaran teknis, bukan kebocoran. Login, register, OTP,
  dan reset kata sandi sudah memakai `rate_limits` (Supabase, atomik).
- **Local dev tidak berubah**: `uvicorn backend.api.main:app` + `npm run dev`
  (rewrite dev tetap arah `localhost:8000`).
- **`.env` lokal**: memakai `EMBEDDING_PROVIDER=gemini` + `GEMINI_API_KEY`
  (butuh koneksi internet). Nilai produksi di-set di Environment Variables
  Vercel, bukan di `.env` (yang tidak ikut ter-deploy).
