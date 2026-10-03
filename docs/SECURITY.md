# ITZ AI Security Review

## 1. Admin Protection
- Admin Panel `/admin` verified via server JWT cookies (httpOnly, samesite=lax, secure in prod).
- All `/api/python/admin/*` routes protected with `get_current_admin` guard (Bearer or Cookie).
- No client-side only guards allowed — all checks are server-side auth.

## 2. Secret Management
- `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET_KEY`, `ADMIN_PASSWORD_HASH` stored in `.env` server-side only.
- Client bundle never exposes secrets — API keys injected only at Vercel env dashboard.
- `.env.example` provided but no real secrets committed to git.

## 3. Password Hashing
- Uses `passlib` + `bcrypt` with salted hashes.
- Hash stored in `ADMIN_PASSWORD_HASH`; never stored in plaintext.

## 4. Database Security
- `SUPABASE_SERVICE_ROLE_KEY` only used server-side; `ANON_KEY` is safe to expose but not needed on client.
- Access is always proxied via Python API, not direct client Supabase queries.

## 5. Error Handling
- API error messages never leak internal paths, keys, or stack traces to user.
- Chat API stream ends with `data: [DONE]`; internal exceptions wrapped as JSON `{"error": "..."}`.
