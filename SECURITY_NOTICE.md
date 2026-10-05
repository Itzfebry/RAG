# 🔒 SECURITY NOTICE

## ⚠️ CRITICAL: Exposed Credentials

**Status:** Live credentials were committed to git history in `.env` file.

### Immediate Actions Required

1. **Rotate all credentials NOW:**
   - [ ] OpenRouter API key (https://openrouter.ai/keys)
   - [ ] Supabase Service Role Key (Supabase Dashboard → Settings → API)
   - [ ] Supabase Anon Key (same location)
   - [ ] JWT Secret Key (generate new random string)
   - [ ] Admin password hash (run: `python -c "import bcrypt; print(bcrypt.hashpw(b'your_new_password', bcrypt.gensalt()).decode())"`)

2. **Clean git history:**
   ```bash
   # Remove .env from all commits (WARNING: rewrites history)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (only if repo is private or you're sole contributor)
   git push --force --all
   git push --force --tags
   ```

3. **Verify `.env` is gitignored:**
   ```bash
   git check-ignore .env  # Should output: .env
   ```

4. **Update `.env` with new credentials** (use `.env.example` as template)

### Bugs Fixed

- **CRITICAL:** Removed hardcoded backdoor password `itz-ai-admin-2026` from `backend/api/admin.py`
- **HIGH:** Fixed CORS regex from `.*\.vercel\.app` (any subdomain) to `itzfebry\.vercel\.app` (exact)

### Still Requires Attention

- **HIGH PRIORITY:** Embedding system returns dummy zeros → semantic search broken
  - File: `backend/knowledge/knowledge_service.py:18`
  - Fix: Integrate real embedding API (OpenAI, Cohere, Sentence-Transformers)

---

**Never commit `.env` files.** Always use `.env.example` with placeholders.
