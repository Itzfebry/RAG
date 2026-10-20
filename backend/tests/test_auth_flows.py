"""Audit alur AUTH end-to-end tanpa Supabase / layanan email / Google asli.

Jalankan:
  python -m pytest backend/tests/test_auth_flows.py -q

Menutup celah miss-logic:
  register (validasi & duplikat), login + lockout, gate verifikasi email,
  OTP kirim/verifikasi, reset password + invalidasi sesi, sesi admin
  admin_session_version, serta OAuth Google (state/CSRF & status).
"""

import os
import sys
from typing import ClassVar

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
os.environ.setdefault("ADMIN_PASSWORD_HASH", "$2b$12$abcdefghijklmnopqrstuuS4pU0CxAAKx4tVhKq8yjLaQG9m7kyK6")


# ── fake DatabaseService (in-memory) ─────────────────────────────────────────


class _FakeDB:
    users: ClassVar[dict] = {}
    profiles: ClassVar[dict] = {}
    otps: ClassVar[dict] = {}
    settings: ClassVar[dict] = {}

    @classmethod
    def reset(cls):
        cls.users = {}
        cls.profiles = {}
        cls.otps = {}
        cls.settings = {
            "user_token_expiry_hours": 24,
            "trial_prompts": 3,
            "admin_session_version": 0,
        }

    @staticmethod
    def get_user_by_username(u):
        return _FakeDB.users.get(u)

    @staticmethod
    def get_user_by_email(e):
        e = (e or "").lower()
        for u in _FakeDB.users.values():
            if (u.get("email") or "").lower() == e:
                return u
        return None

    @staticmethod
    def create_user(data):
        row = {
            "id": f"u{len(_FakeDB.users) + 1}",
            "is_active": True,
            "session_version": 0,
            "prompts_used": 0,
            "email_verified": False,
            "created_at": "",
            "updated_at": "",
        }
        row.update(data)
        _FakeDB.users[row["username"]] = row
        return row

    @staticmethod
    def update_user(uid, patch):
        for u in _FakeDB.users.values():
            if str(u["id"]) == str(uid):
                u.update(patch)
                return dict(u)
        return None

    @staticmethod
    def get_user_profile(uid):
        return _FakeDB.profiles.get(str(uid), {})

    @staticmethod
    def get_app_settings():
        return dict(_FakeDB.settings)

    @staticmethod
    def update_app_settings(patch):
        _FakeDB.settings.update(patch)
        return dict(_FakeDB.settings)

    @staticmethod
    def is_prompt_quota_exhausted(_u):
        return False

    # OTP
    @staticmethod
    def create_email_otp(email, purpose, code_hash, expires_at):
        row = {
            "id": f"otp{len(_FakeDB.otps) + 1}",
            "email": email,
            "purpose": purpose,
            "code_hash": code_hash,
            "expires_at": expires_at,
            "attempts": 0,
        }
        _FakeDB.otps[(email, purpose)] = row
        return row

    @staticmethod
    def get_latest_email_otp(email, purpose):
        return _FakeDB.otps.get((email, purpose))

    @staticmethod
    def update_email_otp_attempts(otp_id, attempts):
        for row in _FakeDB.otps.values():
            if str(row["id"]) == str(otp_id):
                row["attempts"] = attempts
                return row
        return None

    @staticmethod
    def delete_email_otps(email, purpose):
        _FakeDB.otps.pop((email, purpose), None)


_FAKE_METHODS = (
    "get_user_by_username",
    "get_user_by_email",
    "create_user",
    "update_user",
    "get_user_profile",
    "get_app_settings",
    "update_app_settings",
    "is_prompt_quota_exhausted",
    "create_email_otp",
    "get_latest_email_otp",
    "update_email_otp_attempts",
    "delete_email_otps",
)


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    """Pasang fake DB, matikan email sungguhan, paksa rate-limit in-memory."""
    import backend.security.otp as otp_mod
    import backend.security.rate_limiter as rl
    from backend.database.db import DatabaseService

    _FakeDB.reset()
    for name in _FAKE_METHODS:
        monkeypatch.setattr(DatabaseService, name, staticmethod(getattr(_FakeDB, name)))

    # jangan kirim email asli
    monkeypatch.setattr(otp_mod, "send_otp_email", lambda *a, **k: None)
    # paksa fallback rate-limit in-memory (tanpa Supabase) supaya deterministik
    monkeypatch.setattr(rl, "_db", lambda: None)
    # state rate-limit & lockout in-memory global -> harus dikosongkan antar test
    rl._buckets.clear()
    rl._failed_logins.clear()
    rl._lockouts.clear()

    from fastapi.testclient import TestClient

    import backend.api.main as m

    client = TestClient(m.app)
    yield client
    client.cookies.clear()
    rl._buckets.clear()
    rl._failed_logins.clear()
    rl._lockouts.clear()


def _register(c, username="alice", email="alice@x.com", password="Secret123"):
    return c.post(
        "/api/user/register",
        json={
            "username": username,
            "email": email,
            "password": password,
            "display_name": "Alice",
        },
    )


def _login(c, username, password):
    c.cookies.clear()
    return c.post("/api/user/login", json={"username": username, "password": password})


# ── register ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("bad", ["abcdefgh", "abcdefg1", "ABCDEFGH", "Abcdefgh", "12345678"])
def test_register_rejects_weak_password(_env, bad):
    r = _env.post(
        "/api/user/register",
        json={
            "username": "bob",
            "email": "bob@x.com",
            "password": bad,
        },
    )
    assert r.status_code == 422, f"{bad!r} seharusnya ditolak, dapat {r.status_code}"


def test_register_accepts_strong_password_and_stays_unverified(_env):
    r = _register(_env)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email_verified"] is False
    assert body["email_sent"] is True
    # cookie terpasang -> user langsung login tapi belum diverifikasi
    assert _env.cookies.get("itz_user_token")
    assert _FakeDB.users["alice"]["provider"] == "manual"
    assert _FakeDB.users["alice"]["max_prompts"] == 3


def test_register_duplicate_username_and_email(_env):
    assert _register(_env).status_code == 201
    _env.cookies.clear()
    assert _register(_env).status_code == 409  # username sama
    assert _register(_env, username="other", email="alice@x.com").status_code == 409  # email sama


def test_register_trims_and_lowercases_identity(_env):
    r = _env.post(
        "/api/user/register",
        json={
            "username": "  CaroL  ",
            "email": "  Carol@X.Com ",
            "password": "Secret123",
        },
    )
    assert r.status_code == 201, r.text
    assert "carol" in _FakeDB.users
    assert _FakeDB.users["carol"]["email"] == "carol@x.com"


def test_register_rate_limit_blocks_after_five(_env):
    for i in range(6):
        r = _register(_env, username=f"user{i}", email=f"u{i}@x.com")
        if i < 5:
            assert r.status_code == 201, r.text
        else:
            assert r.status_code == 429


# ── login ────────────────────────────────────────────────────────────────────


def test_login_ok_and_wrong_password(_env):
    assert _register(_env).status_code == 201
    assert _login(_env, "alice", "Secret123").status_code == 200
    assert _login(_env, "alice", "wrong-pass").status_code == 401


def test_login_by_email_is_case_insensitive(_env):
    assert _register(_env).status_code == 201
    assert _login(_env, "ALICE@X.com", "Secret123").status_code == 200


def test_legacy_weak_password_still_can_login(_env):
    """Password lama (tidak sesuai aturan baru) wajib tetap bisa login."""
    from backend.security.auth import hash_password

    assert _register(_env, password="Secret123").status_code == 201
    _FakeDB.users["alice"]["password_hash"] = hash_password("legacy-password")
    assert _login(_env, "alice", "legacy-password").status_code == 200


def test_lockout_after_five_failed_attempts(_env):
    assert _register(_env).status_code == 201
    for i in range(5):
        r = _login(_env, "alice", f"Wrong{i}Pass")
        assert r.status_code == 401, f"percobaan {i + 1}: {r.status_code}"
    r = _login(_env, "alice", "Secret123")
    assert r.status_code == 429, "harus terkunci setelah 5 gagal"
    assert r.headers.get("retry-after")


def test_lockout_is_per_account_not_global(_env):
    """Kunci akun alice tidak boleh mengunci akun lain pada IP sama."""
    assert _register(_env).status_code == 201
    assert _register(_env, username="dave", email="dave@x.com").status_code == 201
    for i in range(5):
        _login(_env, "alice", f"Wrong{i}Pass")
    assert _login(_env, "dave", "Secret123").status_code == 200


# ── gate verifikasi email ────────────────────────────────────────────────────


class _ChatReq:
    def __init__(self, token: str = ""):
        self.cookies = {"itz_user_token": token} if token else {}
        self.headers = {}
        self.client = None


def _gate(user):
    """Jalankan gate chat dengan token JWT asli milik `user`."""
    from fastapi import HTTPException

    import backend.api.chat as chat
    from backend.security.auth import create_user_jwt

    tok = create_user_jwt(user["username"], session_version=int(user.get("session_version") or 0))
    try:
        out = chat.get_current_chat_user_optional(_ChatReq(tok))
        return ("ALLOWED", out.get("username"))
    except HTTPException as e:
        return ("BLOCKED", e.status_code)


def test_chat_blocked_until_email_verified(_env):
    assert _register(_env).status_code == 201
    user = _FakeDB.users["alice"]
    assert user["email_verified"] is False
    assert _gate(user) == ("BLOCKED", 403)


def test_chat_allowed_after_verify(_env):
    assert _register(_env).status_code == 201
    _FakeDB.users["alice"]["email_verified"] = True
    assert _gate(_FakeDB.users["alice"]) == ("ALLOWED", "alice")


def test_chat_allowed_for_accounts_without_email(_env):
    _FakeDB.create_user(
        {"username": "root1", "provider": "admin", "password_hash": "", "email": None, "email_verified": False}
    )
    assert _gate(_FakeDB.users["root1"]) == ("ALLOWED", "root1")


def test_chat_blocked_when_account_deactivated(_env):
    assert _register(_env).status_code == 201
    _FakeDB.users["alice"]["email_verified"] = True
    _FakeDB.users["alice"]["is_active"] = False
    assert _gate(_FakeDB.users["alice"]) == ("BLOCKED", 403)


def test_chat_treats_stale_session_as_guest(_env):
    """Token sv lama tidak dianggap login (bukan 403 verifikasi)."""
    import backend.api.chat as chat
    from backend.security.auth import create_user_jwt

    assert _register(_env).status_code == 201
    _FakeDB.users["alice"]["session_version"] = 7
    tok = create_user_jwt("alice", session_version=0)
    assert chat.get_current_chat_user_optional(_ChatReq(tok)) is None


def test_chat_guest_still_allowed(_env):
    import backend.api.chat as chat

    assert chat.get_current_chat_user_optional(_ChatReq("")) is None


# ── OTP verifikasi email ─────────────────────────────────────────────────────


def test_send_verify_requires_login(_env):
    assert _env.post("/api/user/verify-email/send").status_code in (401, 403)


def test_send_verify_skips_when_already_verified(_env):
    assert _register(_env).status_code == 201
    _FakeDB.users["alice"]["email_verified"] = True
    r = _env.post("/api/user/verify-email/send")
    assert r.status_code == 200
    assert r.json()["status"] == "already_verified"


def test_send_verify_rejects_account_without_email(_env):
    from backend.security.auth import create_user_jwt

    _FakeDB.create_user(
        {"username": "noemail", "provider": "admin", "password_hash": "", "email": None, "email_verified": False}
    )
    _env.cookies.set("itz_user_token", create_user_jwt("noemail"))
    assert _env.post("/api/user/verify-email/send").status_code == 400


def test_send_verify_stores_otp_for_logged_in_email(_env):
    import backend.security.otp as otp_mod

    assert _register(_env).status_code == 201
    r = _env.post("/api/user/verify-email/send")
    assert r.status_code == 200
    assert ("alice@x.com", otp_mod.PURPOSE_VERIFY) in _FakeDB.otps


def test_verify_email_rejects_mismatched_email(_env):
    assert _register(_env).status_code == 201
    r = _env.post("/api/user/verify-email", json={"email": "other@x.com", "code": "123456"})
    assert r.status_code == 400
    assert _FakeDB.users["alice"]["email_verified"] is False


def test_verify_email_rejects_wrong_code_and_limits_attempts(_env):
    import backend.security.otp as otp_mod

    assert _register(_env).status_code == 201
    for _ in range(3):
        r = _env.post("/api/user/verify-email", json={"email": "alice@x.com", "code": "000000"})
        assert r.status_code == 400
    row = _FakeDB.otps[("alice@x.com", otp_mod.PURPOSE_VERIFY)]
    assert row["attempts"] == 3, "percobaan salah wajib tercatat"
    assert _FakeDB.users["alice"]["email_verified"] is False


def test_verify_email_success_with_known_otp(_env):
    import backend.security.otp as otp_mod

    assert _register(_env).status_code == 201
    _env.post("/api/user/verify-email/send")
    code = "654321"
    _FakeDB.create_email_otp(
        "alice@x.com",
        otp_mod.PURPOSE_VERIFY,
        otp_mod.hash_code("alice@x.com", otp_mod.PURPOSE_VERIFY, code),
        otp_mod.expires_at_iso(),
    )
    r = _env.post("/api/user/verify-email", json={"email": "alice@x.com", "code": code})
    assert r.status_code == 200, r.text
    assert _FakeDB.users["alice"]["email_verified"] is True
    # kode terpakai -> OTP dihapus
    assert ("alice@x.com", otp_mod.PURPOSE_VERIFY) not in _FakeDB.otps


def test_verify_email_otp_purposes_are_isolated(_env):
    """OTP reset password tidak boleh dipakai untuk verifikasi email."""
    import backend.security.otp as otp_mod

    assert _register(_env).status_code == 201
    code = "999888"
    _FakeDB.create_email_otp(
        "alice@x.com",
        otp_mod.PURPOSE_RESET,
        otp_mod.hash_code("alice@x.com", otp_mod.PURPOSE_RESET, code),
        otp_mod.expires_at_iso(),
    )
    r = _env.post("/api/user/verify-email", json={"email": "alice@x.com", "code": code})
    assert r.status_code == 400
    assert _FakeDB.users["alice"]["email_verified"] is False


def test_verify_email_uses_same_email_as_register(_env):
    """Email OTP dikirim ke email akun, bukan ke input bebas."""
    import backend.security.otp as otp_mod

    assert _register(_env, email="real@x.com").status_code == 201
    _env.post("/api/user/verify-email/send")
    assert ("real@x.com", otp_mod.PURPOSE_VERIFY) in _FakeDB.otps


# ── reset password ───────────────────────────────────────────────────────────


def test_reset_password_rejects_weak_password(_env):
    r = _env.post(
        "/api/user/password/reset", json={"email": "alice@x.com", "code": "123456", "new_password": "abcdefgh"}
    )
    assert r.status_code == 422


def test_reset_password_unknown_email_never_leaks(_env):
    r = _env.post("/api/user/password/forgot", json={"email": "ghost@x.com"})
    assert r.status_code == 200
    assert "sent" in r.json()["status"]
    assert _env.post("/api/user/password/forgot", json={"email": "alice@x.com"}).status_code == 200  # sama saja


def test_reset_password_wrong_code_rejected(_env):
    assert _register(_env).status_code == 201
    import backend.security.otp as otp_mod

    _FakeDB.create_email_otp(
        "alice@x.com",
        otp_mod.PURPOSE_RESET,
        otp_mod.hash_code("alice@x.com", otp_mod.PURPOSE_RESET, "112233"),
        otp_mod.expires_at_iso(),
    )
    r = _env.post(
        "/api/user/password/reset", json={"email": "alice@x.com", "code": "000000", "new_password": "Newpass99"}
    )
    assert r.status_code == 400


def test_reset_password_invalidates_old_session(_env):
    import backend.security.otp as otp_mod

    assert _register(_env).status_code == 201
    old_token = _env.cookies.get("itz_user_token")

    code = "112233"
    _FakeDB.create_email_otp(
        "alice@x.com",
        otp_mod.PURPOSE_RESET,
        otp_mod.hash_code("alice@x.com", otp_mod.PURPOSE_RESET, code),
        otp_mod.expires_at_iso(),
    )
    _env.cookies.clear()
    r = _env.post("/api/user/password/reset", json={"email": "alice@x.com", "code": code, "new_password": "Newpass99"})
    assert r.status_code == 200, r.text
    assert _FakeDB.users["alice"]["session_version"] == 1
    assert _FakeDB.users["alice"]["email_verified"] is True  # reset otomatis verify

    # sesi lama mati
    _env.cookies.set("itz_user_token", old_token)
    assert _env.get("/api/user/me").status_code == 401

    # login baru dengan password baru
    assert _login(_env, "alice", "Newpass99").status_code == 200


def test_change_password_validates_rules_and_current_password(_env):
    assert _register(_env).status_code == 201
    r = _env.put("/api/user/password", json={"current_password": "Secret123", "new_password": "weakpass"})
    assert r.status_code == 422
    r = _env.put("/api/user/password", json={"current_password": "wrong", "new_password": "Goodpass1"})
    assert r.status_code in (400, 401)
    r = _env.put("/api/user/password", json={"current_password": "Secret123", "new_password": "Goodpass1"})
    assert r.status_code == 200


# ── sesi admin (admin_session_version) ───────────────────────────────────────


def test_admin_session_version_gate(monkeypatch):
    from fastapi.testclient import TestClient

    import backend.api.admin as admin
    import backend.api.main as m
    from backend.security.auth import create_jwt

    monkeypatch.setattr(admin.DatabaseService, "get_app_settings", staticmethod(lambda: {"admin_session_version": 3}))

    c = TestClient(m.app)
    c.cookies.set("itz_admin_token", create_jwt("admin", role="admin", extra={"sv": 3}))
    assert c.get("/api/admin/verify").status_code == 200

    c.cookies.set("itz_admin_token", create_jwt("admin", role="admin", extra={"sv": 2}))
    assert c.get("/api/admin/verify").status_code == 401

    c.cookies.set("itz_admin_token", create_jwt("admin", role="admin"))
    assert c.get("/api/admin/verify").status_code == 401


def test_admin_login_locks_after_five_failures(_env):
    codes = []
    for i in range(7):
        codes.append(_env.post("/api/admin/login", json={"username": "admin", "password": f"bad{i}"}).status_code)
    assert codes[:5] == [401] * 5, codes
    assert codes[5] == 429, "harus terkunci setelah 5 gagal"
    assert codes[6] == 429


def test_admin_logout_invalidates_issued_token(monkeypatch):
    """Token admin yang diterbitkan sebelum logout harus mati (sv naik)."""
    from fastapi.testclient import TestClient

    import backend.api.admin as admin
    import backend.api.main as m
    from backend.security.auth import create_jwt

    state = {"sv": 0}

    def _settings():
        return {"admin_session_version": state["sv"]}

    monkeypatch.setattr(admin.DatabaseService, "get_app_settings", staticmethod(_settings))

    c = TestClient(m.app)
    token = create_jwt("admin", role="admin", extra={"sv": 0})
    c.cookies.set("itz_admin_token", token)
    assert c.get("/api/admin/verify").status_code == 200

    # simulasi logout: versi sesi naik 1
    state["sv"] = 1
    assert c.get("/api/admin/verify").status_code == 401

    c.cookies.set("itz_admin_token", create_jwt("admin", role="admin", extra={"sv": 1}))
    assert c.get("/api/admin/verify").status_code == 200


# ── OAuth Google ─────────────────────────────────────────────────────────────


def test_google_status_reports_boolean(_env):
    r = _env.get("/api/auth/google-status")
    assert r.status_code == 200
    assert isinstance(r.json()["enabled"], bool)


def test_google_login_issues_state_cookie_and_url(_env):
    r = _env.get("/api/auth/google-login")
    if r.status_code == 503:
        pytest.skip("GOOGLE_CLIENT_ID/SECRET belum diisi")
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert "accounts.google.com" in url
    assert "redirect_uri=" in url and "state=" in url
    cookie = _env.cookies.get("google_oauth_state")
    assert cookie, "state cookie wajib terpasang (anti-CSRF)"


def test_google_callback_rejects_missing_state(_env):
    r = _env.get("/api/auth/google-callback", params={"state": "", "code": ""}, follow_redirects=False)
    assert r.status_code == 302
    assert "/login?auth_error=" in r.headers["location"]


def test_google_callback_rejects_tampered_state_before_contacting_google(_env):
    r = _env.get("/api/auth/google-login")
    if r.status_code == 503:
        pytest.skip("GOOGLE_CLIENT_ID/SECRET belum diisi")
    real = _env.cookies.get("google_oauth_state")
    assert real
    r = _env.get("/api/auth/google-callback", params={"code": "abc", "state": "tampered"}, follow_redirects=False)
    assert r.status_code == 302
    assert "state" in r.headers["location"]
    assert _env.cookies.get("google_oauth_state") == real


def test_google_callback_rejects_provider_error(_env):
    r = _env.get("/api/auth/google-callback", params={"error": "access_denied", "state": "s"}, follow_redirects=False)
    assert r.status_code == 302
    assert "auth_error=" in r.headers["location"]


def test_google_login_not_advertised_when_unconfigured(monkeypatch):
    """google-status harus false bila konfigurasi Google kosong."""
    import backend.api.auth as auth

    monkeypatch.setattr(auth, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(auth, "GOOGLE_CLIENT_SECRET", "")
    from fastapi.testclient import TestClient

    import backend.api.main as m

    c = TestClient(m.app)
    assert c.get("/api/auth/google-status").json()["enabled"] is False
    assert c.get("/api/auth/google-login").status_code == 503
