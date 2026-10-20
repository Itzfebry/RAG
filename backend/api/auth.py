"""Google OAuth2 login (authorization-code flow).

Flow:
  GET /api/auth/google-login  -> {"url": "https://accounts.google.com/..."}
  Browser -> Google consent -> redirect ke /api/auth/google-callback?code=...&state=...
  Backend tukar code -> ambil profil -> sync user -> set cookie -> redirect ke /chat.

CSRF dilindungi lewat cookie `google_oauth_state` (dicek di callback).
"""

import os
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

try:
    from backend.config.config import settings
    from backend.core.logging_config import get_logger
    from backend.database.db import DatabaseService
    from backend.security.auth import USER_COOKIE_NAME, create_user_jwt
except ImportError:
    from config.config import settings  # type: ignore
    from core.logging_config import get_logger  # type: ignore
    from database.db import DatabaseService
    from security.auth import USER_COOKIE_NAME, create_user_jwt

logger = get_logger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
# Lewat proxy Next.js: /api/python/* -> FastAPI. URL ini HARUS sama persis
# dengan yang didaftarkan di Google Cloud Console > Authorized redirect URIs.
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:3000/api/python/auth/google-callback",
).strip()

STATE_COOKIE = "google_oauth_state"
_SCOPES = "openid email profile"


def _username_from_email(email: str) -> str:
    """Username awal dari email (regex: ^[a-zA-Z0-9._-]{3,32}$). Hanya saran, cek unik di pemanggil."""
    import re

    base = re.sub(r"[^a-zA-Z0-9._-]", "_", (email or "").split("@")[0].strip().lower())[:24]
    if len(base) < 3:
        base = (base + "_user")[:24]
    return f"{base}_{secrets.token_hex(3)}"


def _new_username() -> str:
    return f"u{secrets.token_hex(6)}"


@router.get("/google-status")
async def google_status():
    """Beritahu frontend apakah login Google sudah dikonfigurasi (tanpa membocorkan secret)."""
    return {"enabled": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)}


@router.get("/google-login")
async def google_login(response: Response):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Login Google belum dikonfigurasi - isi GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di .env lalu restart backend.",
        )

    state = secrets.token_urlsafe(32)
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(
        {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": _SCOPES,
            "state": state,
            "prompt": "select_account",
        }
    )
    response.set_cookie(
        key=STATE_COOKIE,
        value=state,
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="lax",
        max_age=600,
        path="/",
    )
    return {"url": auth_url}


@router.get("/google-callback")
async def google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    if error:
        return _redirect_with_error(f"Login Google dibatalkan ({error[:80]})")
    if not code:
        return _redirect_with_error("Login Google gagal: kode otorisasi tidak ada")

    # Validasi state (anti-CSRF)
    saved_state = request.cookies.get(STATE_COOKIE, "")
    if not saved_state or state != saved_state:
        return _redirect_with_error("Login Google gagal: state tidak cocok (coba lagi)")

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            tok = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            token_data = tok.json()
            if tok.status_code != 200 or "access_token" not in token_data:
                logger.warning(f"[google-oauth] token exchange gagal: {tok.status_code} {tok.text[:300]}")
                return _redirect_with_error("Login Google gagal: verifikasi token ditolak")

            info = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
            profile = info.json()
    except Exception as e:
        logger.warning(f"[google-oauth] network error: {e}")
        return _redirect_with_error("Login Google gagal: koneksi ke Google error")

    email = str(profile.get("email") or "").strip().lower()
    if not email or profile.get("verified_email") is False:
        return _redirect_with_error("Login Google gagal: email tidak terverifikasi")

    display_name = str(profile.get("name") or email.split("@")[0])[:100]

    try:
        user = DatabaseService.get_user_by_email(email)
        if not user:
            username = _username_from_email(email)
            while DatabaseService.get_user_by_username(username):
                username = _new_username()
            # Kuota awal = trial_prompts dari app_settings (bukan unlimited)
            app_s = DatabaseService.get_app_settings()
            trial = max(0, int(app_s.get("trial_prompts", 3)))
            user = DatabaseService.create_user(
                {
                    "username": username,
                    "display_name": display_name,
                    "email": email,
                    "email_verified": True,
                    "provider": "google",
                    "password_hash": "",
                    "max_prompts": trial,
                    "prompts_used": 0,
                }
            )
        elif user.get("is_active") is False:
            return _redirect_with_error("Akun Anda dinonaktifkan - hubungi admin")
        else:
            # Akun lama: Google sudah memverifikasi email ini. Lengkapi profil
            # seperlunya agar user tidak tertahan gate verifikasi email.
            patch = {}
            if not bool(user.get("email_verified", False)):
                patch["email_verified"] = True
            if not str(user.get("display_name") or "").strip():
                patch["display_name"] = display_name
            if patch:
                updated = DatabaseService.update_user(str(user["id"]), patch)
                if updated:
                    user = updated
    except Exception as e:
        logger.warning(f"[google-oauth] db error: {e}")
        return _redirect_with_error("Login Google gagal: gagal menyimpan akun")

    token = create_user_jwt(str(user["username"]), session_version=int(user.get("session_version") or 0))
    redirect = RedirectResponse(url="/chat?welcome=1", status_code=302)
    redirect.set_cookie(
        key=USER_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="lax",
        max_age=24 * 3600,
        path="/",
    )
    redirect.delete_cookie(STATE_COOKIE, path="/")
    return redirect


def _redirect_with_error(msg: str) -> RedirectResponse:
    """Balik ke halaman login dengan pesan error (tanpa query body panjang)."""
    from urllib.parse import quote

    return RedirectResponse(url=f"/login?auth_error={quote(msg[:120])}", status_code=302)
