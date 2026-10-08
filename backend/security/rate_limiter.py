"""
In-memory sliding-window rate limiter.
No external deps. Process-local — ok for single instance.
For multi-instance, replace with Redis.
"""
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

def get_client_ip(request) -> str:
    # honor X-Forwarded-For (Vercel / proxy) — take first
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    x_real = request.headers.get("x-real-ip")
    if x_real:
        return x_real.strip()
    client = getattr(request, "client", None)
    if client and getattr(client, "host", None):
        return client.host
    return "unknown"
