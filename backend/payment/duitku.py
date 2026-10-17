"""Klien payment gateway Duitku (POP API) — aktivasi pembayaran otomatis.

Alur: order dibuat -> backend buat invoice ( dapat paymentUrl ) -> user bayar
di halaman Duitku (QRIS / VA / e-wallet) -> Duitku kirim callback ke
/api/payment/duitku/callback -> signature divalidasi -> order paid + kuota
ditambah tanpa acc user. Endpoint admin confirm/cancel tetap ada sebagai
jaga-jaga (notifikasi gagal, order nyangkut, koreksi nominal).

Konfigurasi env (kosongkan = gateway mati, order tetap jalan tanpa invoice):
  DUITKU_MERCHANT_CODE  kode merchant/project dari passport.duitku.com
  DUITKU_API_KEY        API key (merchant key) proyek
  DUITKU_ENV            sandbox | production (default production)
  PUBLIC_BASE_URL       origin publik app, mis. https://itzfebry.vercel.app
                        dipakai untuk callbackUrl + returnUrl invoice

Spesifikasi: https://docs.duitku.com/pop/id/ (createInvoice + callback).
Signature lama MD5/SHA256 plain sudah obsolete; pakai HMAC-SHA256.
"""
import hashlib
import hmac
import os
import time
from typing import Any, Dict, Optional

import httpx

PROD_BASE = "https://api-prod.duitku.com"
SANDBOX_BASE = "https://api-sandbox.duitku.com"
CALLBACK_PATH = "/api/payment/duitku/callback"
# ExpiryPeriod POP hanya menerima 5, 10, atau 60 menit.
EXPIRY_MINUTES = 60
TIMEOUT_SECONDS = 15


class DuitkuError(RuntimeError):
    """Request ke Duitku gagal atau respons bukan sukses."""


def _cfg() -> Dict[str, str]:
    code = os.getenv("DUITKU_MERCHANT_CODE", "").strip()
    api_key = os.getenv("DUITKU_API_KEY", "").strip()
    env = os.getenv("DUITKU_ENV", "production").strip().lower()
    base = SANDBOX_BASE if env == "sandbox" else PROD_BASE
    return {"code": code, "api_key": api_key, "base": base}


def configured() -> bool:
    """True kalau credential Duitku lengkap -> alur bayar otomatis aktif."""
    cfg = _cfg()
    return bool(cfg["code"] and cfg["api_key"])


def _sign(string_to_sign: str, api_key: str) -> str:
    return hmac.new(api_key.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_callback_signature(merchant_code: str, amount: Any, merchant_order_id: str, signature: str) -> bool:
    """Validasi signature callback: HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)."""
    api_key = _cfg()["api_key"]
    if not api_key or not signature:
        return False
    expected = _sign(f"{merchant_code}{amount}{merchant_order_id}", api_key)
    return hmac.compare_digest(expected, str(signature).strip().lower())


def _public_base() -> str:
    return os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")


def create_invoice(
    *,
    merchant_order_id: str,
    amount: int,
    product_details: str,
    email: str,
    customer_name: str,
    phone_number: str = "",
) -> Dict[str, str]:
    """Buat invoice Duitku POP. Return {"reference", "payment_url"}.

    merchantOrderId = id order (uuid, <=50 char). Request gagal / respons
    bukan statusCode 00 -> lempar DuitkuError (caller fallback ke QRIS manual).
    """
    cfg = _cfg()
    if not configured():
        raise DuitkuError("DUITKU_MERCHANT_CODE / DUITKU_API_KEY belum diisi")
    base = _public_base()
    if not base:
        raise DuitkuError("PUBLIC_BASE_URL belum diisi (dipakai callbackUrl & returnUrl)")

    timestamp = str(int(time.time() * 1000))
    signature = _sign(cfg["code"] + timestamp, cfg["api_key"])
    payload: Dict[str, Any] = {
        "paymentAmount": int(amount),
        "merchantOrderId": str(merchant_order_id)[:50],
        "productDetails": str(product_details)[:255],
        "email": str(email or "noemail@itzai.local")[:255],
        "customerVaName": str(customer_name or "Customer")[:20],
        "phoneNumber": str(phone_number or "")[:50],
        "additionalParam": "",
        "merchantUserInfo": "",
        "callbackUrl": base + CALLBACK_PATH,
        "returnUrl": f"{base}/pricing?order={merchant_order_id}",
        "expiryPeriod": EXPIRY_MINUTES,
    }

    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            res = client.post(
                f"{cfg['base']}/api/merchant/createInvoice",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-duitku-timestamp": timestamp,
                    "x-duitku-signature": signature,
                    "x-duitku-merchantcode": cfg["code"],
                },
            )
    except httpx.HTTPError as exc:
        raise DuitkuError(f"network error: {exc}") from exc

    body: Dict[str, Any] = {}
    try:
        body = res.json() if res.content else {}
    except ValueError:
        body = {}

    if res.status_code != 200 or str(body.get("statusCode") or "") != "00" or not body.get("paymentUrl"):
        message = str(body.get("statusMessage") or body.get("Message") or res.text)[:300]
        raise DuitkuError(f"createInvoice HTTP {res.status_code}: {message}")

    return {
        "reference": str(body.get("reference") or ""),
        "payment_url": str(body["paymentUrl"]),
    }
