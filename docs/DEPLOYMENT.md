# ITZ AI Deployment Guide (Vercel + Supabase)

## 1. Supabase Setup
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in Supabase dashboard.
3. Paste and run the contents of `docs/supabase_schema.sql`.
4. Copy `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` from Project Settings > API.

## 2. Environment Variables
In Vercel Project Settings > Environment Variables, add:
- `OPENROUTER_API_KEY`: Your OpenRouter API key (any OpenAI-compatible provider key)
- `ACTIVE_MODEL`: `qwen/qwen3.8-27b:free` (any model ID accepted — not locked to one provider)
- `API_BASE_URL`: `https://openrouter.ai/api/v1`
- `MODEL_PROVIDER`: `openrouter`
- `SUPABASE_URL`: `https://your-project.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: `your-service-role-key`
- `SUPABASE_ANON_KEY`: `your-anon-key`
- `ADMIN_USERNAME`: `admin`
- `ADMIN_PASSWORD_HASH`: `$2b$12$...` (Generated via `bcrypt.hashpw`)
- `JWT_SECRET_KEY`: `your-unique-long-random-jwt-secret`

## 3. Vercel Deployment
1. Connect GitHub repository `Itzfebry/RAG` to Vercel.
2. Set Build Command: `npm run build`
3. Output Directory: `.next`
4. Trigger deploy.
