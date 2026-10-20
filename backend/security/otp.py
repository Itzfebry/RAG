"""Kode OTP 6 digit untuk verifikasi email dan reset kata sandi.

- Kode disimpan sebagai HMAC-SHA256 (bukan plaintext) memakai JWT_SECRET_KEY.
- Berlaku OTP_TTL_MINUTES menit, maksimal OTP_MAX_ATTEMPTS salah per kode.
- Pengiriman email (urutan prioritas):
    1. SMTP Gmail: SMTP_USER + SMTP_PASSWORD (App Password), bisa kirim ke siapa saja.
    2. Resend: RESEND_API_KEY (perlu domain terverifikasi untuk kirim ke luar akun).
    3. Dev only: kode dicetak ke console. Di production tanpa keduanya, pengiriman gagal.
"""

import hashlib
import hmac
import logging
import os
import secrets
import smtplib
import ssl
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage

import httpx

try:
    from backend.config.config import settings
except ImportError:
    from config.config import settings  # type: ignore

logger = logging.getLogger("itz.otp")

OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", "10"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
PURPOSE_VERIFY = "verify_email"
PURPOSE_RESET = "reset_password"


class MailError(RuntimeError):
    pass


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(email: str, purpose: str, code: str) -> str:
    msg = f"{email.lower()}|{purpose}|{code}".encode()
    return hmac.new(settings.JWT_SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def expires_at_iso() -> str:
    return (datetime.now(UTC) + timedelta(minutes=OTP_TTL_MINUTES)).isoformat()


def is_expired(expires_at: str) -> bool:
    try:
        exp = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
    except ValueError:
        return True
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=UTC)
    return datetime.now(UTC) > exp


def _send_smtp(to: str, subject: str, html: str) -> None:
    host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    # App Password Google ditampilkan dengan spasi; spasi tidak ikut dikirim.
    password = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
    sender = os.getenv("MAIL_FROM", "").strip() or f"ITZ AI <{user}>"

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content("Buka email ini dengan klien yang mendukung HTML.")
    msg.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(host, port, timeout=20) as s:
            s.ehlo()
            s.starttls(context=ssl.create_default_context())
            s.ehlo()
            s.login(user, password)
            s.send_message(msg)
    except (smtplib.SMTPException, OSError) as e:
        logger.error("SMTP gagal: %s", e)
        raise MailError("Gagal mengirim email. Coba lagi beberapa saat.") from e


def _send_resend(to: str, subject: str, html: str, api_key: str) -> None:
    sender = os.getenv("MAIL_FROM", "ITZ AI <onboarding@resend.dev>").strip()
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"from": sender, "to": [to], "subject": subject, "html": html},
            )
    except httpx.HTTPError as e:
        logger.error("Resend network error: %s", e)
        raise MailError("Gagal mengirim email. Coba lagi beberapa saat.") from e
    if resp.status_code >= 300:
        logger.error("Resend gagal: %s %s", resp.status_code, resp.text[:200])
        raise MailError("Gagal mengirim email. Coba lagi beberapa saat.")


def send_otp_email(to: str, code: str, purpose: str) -> None:
    """Kirim kode OTP. Raise MailError jika pengiriman gagal."""
    if purpose == PURPOSE_RESET:
        subject = "Kode reset kata sandi ITZ AI"
        intro = "Gunakan kode ini untuk mengatur ulang kata sandi Anda:"
    else:
        subject = "Kode verifikasi email ITZ AI"
        intro = "Gunakan kode ini untuk memverifikasi email Anda:"
    html = (
        f"<p>{intro}</p>"
        f"<p style='font-size:24px;font-weight:bold;letter-spacing:4px'>{code}</p>"
        f"<p>Kode berlaku {OTP_TTL_MINUTES} menit. Jika Anda tidak meminta ini, abaikan email ini.</p>"
    )

    if os.getenv("SMTP_USER", "").strip() and os.getenv("SMTP_PASSWORD", "").strip():
        _send_smtp(to, subject, html)
        return

    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    if resend_key:
        _send_resend(to, subject, html, resend_key)
        return

    if settings.NODE_ENV == "production":
        logger.error("Tidak ada provider email (SMTP_* / RESEND_API_KEY) di production")
        raise MailError("Layanan email belum dikonfigurasi.")

    logger.info(f"[otp-dev] {purpose} untuk {to}: {code}")
