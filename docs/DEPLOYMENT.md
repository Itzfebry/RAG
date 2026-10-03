# ITZ AI Deployment Guide (Vercel + Supabase)

## 1. Supabase Setup
1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in Supabase dashboard.
3. Paste and run the contents of `docs/supabase_schema.sql`.
4. Copy `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` from Project Settings > API.

## 2. Environment Variables
In Vercel Project Settings > Environment Variables, add:
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_MODEL`: `gpt-4o-mini`
- `OPENAI_EMBEDDING_MODEL`: `text-embedding-3-small`
- `SUPABASE_URL`: `https://your-project.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: `your-service-role-key`
- `SUPABASE_ANON_KEY`: `your-anon-key`
- `ADMIN_USERNAME`: `admin`
- `ADMIN_PASSWORD_HASH`: `$2b$12$...` (Generated via python `passlib.context.CryptContext`)
- `JWT_SECRET_KEY`: `your-unique-long-random-jwt-secret`

## 3. Vercel Deployment
1. Connect GitHub repository `Itzfebry/RAG` to Vercel.
2. Set Build Command: `npm run build`
3. Output Directory: `.next`
4. Trigger deploy.
