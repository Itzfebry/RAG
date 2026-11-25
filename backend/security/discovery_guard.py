"""Pembatas akses chat discovery publik (tanpa login).

Tiga lapis, semuanya durable (Supabase) bila tersedia:
1. per IP per menit - menahan burst.
2. per IP per hari  - menahan biaya token harian.
3. per sesi (total) - membatasi panjang satu sesi discovery.

Session id dibuat client (UUID) dan dipakai sebagai kunci hitungan; klien yang
merotasi id tetap tertahan oleh batas per-IP. Nilai batas diatur admin lewat
app_settings (lihat migrations/supabase_migration_discovery.sql).
"""

import re

from fastapi import HTTPException

try:
    from backend.database.db import DatabaseService
    from backend.security.rate_limiter import enforce_rate_limit, get_client_ip
except ImportError:
    from database.db import DatabaseService  # type: ignore
    from security.rate_limiter import enforce_rate_limit, get_client_ip  # type: ignore

SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
# Jendela hitungan sesi jauh lebih panjang dari durasi wajar satu sesi chat,
# supaya "total turn" tidak ikut ter-reset di tengah percakapan.
SESSION_WINDOW_S = 7 * 24 * 3600


def normalize_session_id(raw: str | None) -> str | None:
    """Validasi id sesi dari client; None bila kosong, 400 bila formatnya aneh."""
    value = (raw or "").strip()
    if not value:
        return None
    if not SESSION_ID_RE.match(value):
        raise HTTPException(status_code=400, detail="ID sesi discovery tidak valid")
    return value


def _as_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def discovery_limits() -> dict[str, int]:
    """Batas aktif dari app_settings (fallback ke default kode)."""
    settings = DatabaseService.get_app_settings()
    return {
        "max_turns": _as_int(settings.get("discovery_max_turns"), 10),
        "per_min": _as_int(settings.get("discovery_ip_per_min"), 12),
        "per_day": _as_int(settings.get("discovery_ip_per_day"), 60),
    }


def is_authenticated(request) -> bool:
    """True bila request membawa sesi login yang valid (best-effort).

    Dipakai halaman discovery untuk menandai status login (mis. akses unduh
    brief). Akun bermasalah (belum verifikasi email, nonaktif, kuota habis)
    diperlakukan sebagai tamu, bukan error.
    """
    try:
        try:
            from backend.api.chat import get_current_chat_user_optional
        except ImportError:
            from api.chat import get_current_chat_user_optional  # type: ignore

        return get_current_chat_user_optional(request) is not None
    except HTTPException:
        return False
    except Exception:
        return False


def enforce_discovery_limits(
    request, session_id: str | None, *, turns: int = 1
) -> dict[str, int]:
    """Terapkan ketiga lapis pembatas; raise 429 bila salah satu terlampaui.

    `turns` menandai berapa "giliran" yang dihabiskan satu request (mode
    perbandingan memakai 2 karena memanggil model dua kali).
    """
    ip = get_client_ip(request)
    limits = discovery_limits()
    for _ in range(max(1, int(turns))):
        enforce_rate_limit(
            f"disc:min:{ip}",
            limits["per_min"],
            60,
            durable=True,
            detail="Terlalu banyak permintaan. Coba lagi dalam {retry} detik.",
        )
        enforce_rate_limit(
            f"disc:day:{ip}",
            limits["per_day"],
            86400,
            durable=True,
            detail="Batas harian demo discovery tercapai. Hubungi kami untuk melanjutkan.",
        )
        if session_id:
            enforce_rate_limit(
                f"disc:turn:{session_id}",
                limits["max_turns"],
                SESSION_WINDOW_S,
                durable=True,
                detail="Sesi discovery ini sudah mencapai batas pesan. Mulai sesi baru untuk melanjutkan.",
            )
    return limits
