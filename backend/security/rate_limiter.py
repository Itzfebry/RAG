"""
In-memory sliding-window rate limiter (fallback dev lokal / single instance).
No external deps. Process-local.

Untuk endpoint sensitif (login, register, OTP) dipakai varian `*_durable` yang
menyimpan hitungan di Supabase (atomik, konsisten lintas instance). Varian
in-memory di sini otomatis dipakai bila Supabase tidak tersedia.
"""
import os
import time
from collections import defaultdict, deque
from typing import Dict, Deque

# ip -> deque[timestamps]
_buckets: Dict[str, Deque[float]] = defaultdict(deque)
_failed_logins: Dict[str, Deque[float]] = defaultdict(deque)
_lockouts: Dict[str, float] = {}

def _now() -> float:
    return time.monotonic()

def is_rate_limited(key: str, max_requests: int, window_seconds: int) -> bool:
    """True if key exceeded limit in window. Also prunes old entries."""
    now = _now()
    dq = _buckets[key]
    while dq and now - dq[0] > window_seconds:
        dq.popleft()
    if len(dq) >= max_requests:
        return True
    dq.append(now)
    return False

def check_rate_limit(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
    """
    Returns (allowed, retry_after_seconds).
    allowed=True means request may proceed.
    """
    now = _now()
    dq = _buckets[key]
    while dq and now - dq[0] > window_seconds:
        dq.popleft()
    if len(dq) >= max_requests:
        retry_after = int(window_seconds - (now - dq[0])) + 1
        return False, max(1, retry_after)
    dq.append(now)
    return True, 0

def record_failed_login(ip: str) -> None:
    now = _now()
    dq = _failed_logins[ip]
    while dq and now - dq[0] > 900:  # 15 min window
        dq.popleft()
    dq.append(now)
    # lockout if >=5 fails in 15 min
    if len(dq) >= 5:
        _lockouts[ip] = now + 900  # lock 15 min

def is_locked_out(ip: str) -> tuple[bool, int]:
    now = _now()
    exp = _lockouts.get(ip)
    if exp and now < exp:
        return True, int(exp - now)
    if exp and now >= exp:
        _lockouts.pop(ip, None)
        _failed_logins.pop(ip, None)
    return False, 0

def clear_failed_login(ip: str) -> None:
    _failed_logins.pop(ip, None)
    _lockouts.pop(ip, None)


# ── Versi terpusat (DB) untuk endpoint sensitif: login, register, OTP. ──
# Konsisten lintas instance Vercel. Bila Supabase tidak tersedia (dev lokal),
# jatuh ke limiter in-memory di atas sehingga perilaku tetap sama.
LOCKOUT_WINDOW_SECONDS = 900
LOCKOUT_THRESHOLD = 5


def _db():
    try:
        from backend.database.db import DatabaseService
    except ImportError:
        from database.db import DatabaseService  # type: ignore
    return DatabaseService


def check_rate_limit_durable(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
    """Seperti check_rate_limit, tapi hitungan disimpan di DB (atomik) bila ada."""
    try:
        res = _db().bump_rate_limit(key, window_seconds)
    except Exception:
        res = None
    if res is None:
        return check_rate_limit(key, max_requests, window_seconds)
    count, reset_in = res
    if count > max_requests:
        return False, max(1, int(reset_in))
    return True, 0


def record_failed_login_durable(key: str) -> None:
    try:
        res = _db().bump_rate_limit(f"lock:{key}", LOCKOUT_WINDOW_SECONDS)
    except Exception:
        res = None
    if res is None:
        record_failed_login(key)


def is_locked_out_durable(key: str) -> tuple[bool, int]:
    try:
        count = _db().peek_rate_limit(f"lock:{key}")
    except Exception:
        count = None
    if count is None:
        return is_locked_out(key)
    if count >= LOCKOUT_THRESHOLD:
        return True, LOCKOUT_WINDOW_SECONDS
    return False, 0


def clear_failed_login_durable(key: str) -> None:
    try:
        done = _db().reset_rate_limit(f"lock:{key}")
    except Exception:
        done = False
    if not done:
        clear_failed_login(key)

def get_client_ip(request) -> str:
    # Di belakang proxy tepercaya (Vercel), proxy menambahkan IP client di AKHIR
    # X-Forwarded-For; entri awal bisa dipalsukan client. Jadi ambil yang terakhir.
    # Di luar proxy (lokal) tidak ada header tepercaya -> pakai IP socket.
    if os.getenv("VERCEL"):
        x_real = (request.headers.get("x-real-ip") or "").strip()
        if x_real:
            return x_real
        xff = (request.headers.get("x-forwarded-for") or "").split(",")
        last = xff[-1].strip() if xff else ""
        if last:
            return last
    client = getattr(request, "client", None)
    if client and getattr(client, "host", None):
        return client.host
    return "unknown"
