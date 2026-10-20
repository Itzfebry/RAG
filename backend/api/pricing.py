"""
Pricing & orders: paket prompt, pembayaran (QRIS), aktivasi otomatis.

Alur: user pilih paket -> order dibuat + invoice gateway (paymentUrl) -> user
bayar di halaman gateway -> callback gateway datang begitu dana masuk -> order
paid + kuota ditambah otomatis. User TIDAK bisa menandai sendiri: endpoint
"Sudah Bayar" sudah dihapus (user tidak boleh acc). Orders = log pembayaran
yang dipantau admin. Admin confirm/cancel tetap ada sebagai jaga-jaga (notifikasi
gangguan, order nyangkut, koreksi).
"""

import re
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from backend.database.billing_repo import MAX_PLAN_DAYS, order_expiry, parse_dt

try:
    from backend.api.admin import get_current_admin
    from backend.api.users import get_current_user
    from backend.database.db import DatabaseService
    from backend.payment import duitku
    from backend.security.audit import log_action as audit_log
    from backend.security.rate_limiter import enforce_rate_limit, get_client_ip
except ImportError:
    from database.billing_repo import MAX_PLAN_DAYS, order_expiry, parse_dt  # type: ignore
    from database.db import DatabaseService  # type: ignore
    from payment import duitku  # type: ignore
    from security.audit import log_action as audit_log  # type: ignore
    from security.rate_limiter import enforce_rate_limit, get_client_ip  # type: ignore

    from api.admin import get_current_admin  # type: ignore
    from api.users import get_current_user  # type: ignore

router = APIRouter(prefix="/api", tags=["Pricing"])
admin_router = APIRouter(prefix="/api/admin", tags=["Admin Pricing"])
payment_router = APIRouter(prefix="/api/payment", tags=["Payment Callback"])

MAX_AMOUNT = 100_000_000
MAX_PLANS = 12
# Batas karakter QRIS: data URL base64 gambar (~400 KB) masih muat.
# Harus < MAX_BODY_BYTES (1 MB) di middleware agar body tidak ditolak 413.
MAX_QRIS_CHARS = 600_000


def wa_link(contact: str) -> str:
    """Tautan WhatsApp dari field kontak admin.

    Terima: 08xx, 8xx, 628xx, +62 8xx, teks campur ("WA 08xx"). Nomor non-ID
    atau terlalu pendek dianggap bukan nomor (mis. email) -> "" (fallback teks).
    """
    digits = re.sub(r"\D", "", str(contact or ""))
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("8"):
        digits = "62" + digits
    if not digits.startswith("62") or not (9 <= len(digits) <= 15):
        return ""
    return f"https://wa.me/{digits}"


def _public_pricing() -> dict[str, Any]:
    cfg = DatabaseService.get_pricing()
    plans = []
    for p in cfg.get("plans") or []:
        if not isinstance(p, dict):
            continue
        try:
            prompts = int(p.get("prompts") or 0)
            amount = int(p.get("amount") or 0)
            days = int(p.get("days") or 0)
        except Exception:
            continue
        if prompts <= 0 or not str(p.get("id") or "").strip():
            continue
        try:
            original = int(p.get("original_amount") or 0)
        except Exception:
            original = 0
        # Diskon aktif hanya kalau harga coret benar-benar di atas harga akhir.
        discounted = original > amount > 0
        plans.append(
            {
                "id": str(p.get("id")),
                "label": str(p.get("label") or f"Paket {prompts} Prompt"),
                "prompts": prompts,
                # Masa aktif paket dalam hari (0 = tanpa batas waktu).
                "days": days,
                "amount": amount,
                "popular": bool(p.get("popular")),
                "original_amount": original if discounted else None,
                "discount_percent": round((1 - amount / original) * 100) if discounted else None,
            }
        )
    contact = str(cfg.get("contact") or "").strip()
    note = str(cfg.get("order_note") or "")
    # Legacy: instalasi lama masih menyimpan teks default alur manual -> tukar diam-diam.
    if note == "Aktivasi manual oleh admin setelah pembayaran dikonfirmasi.":
        note = "Pembayaran tercatat otomatis — kuota aktif sendiri begitu dana masuk."
    return {
        "plans": plans,
        "payment_qris": str(cfg.get("payment_qris") or ""),
        "payment_instructions": str(cfg.get("payment_instructions") or ""),
        "contact": contact,
        "contact_wa": wa_link(contact),
        "order_note": note,
        # True = alur bayar otomatis aktif: order dapat paymentUrl, kuota
        # menyala sendiri lewat callback gateway begitu dana masuk.
        "auto_checkout": duitku.configured(),
    }


def _order_expiry_fields(o: dict[str, Any]) -> dict[str, Any]:
    """Info masa aktif order untuk UI: tanggal expired & sisa hari (paid saja)."""
    expired, expiry = order_expiry(o)
    out: dict[str, Any] = {"days": int(o.get("days") or 0)}
    if expiry is None:
        out["expires_at"] = None
        out["expired"] = False
        out["expires_in_days"] = None
        return out
    paid = parse_dt(o.get("paid_at"))
    now_dt = datetime.now(expiry.tzinfo) if expiry.tzinfo else datetime.now()
    if paid is not None:
        delta = expiry - max(now_dt, paid)  # sisa hari tidak minus sejak awal
        out["expires_in_days"] = max(0, (delta + timedelta(days=1)).days)
    else:
        out["expires_in_days"] = None
    out["expires_at"] = expiry.isoformat()
    out["expired"] = expired
    return out


# ── user endpoints ──


class OrderCreate(BaseModel):
    plan_id: str = Field(min_length=1, max_length=64)
    note: str | None = Field(default=None, max_length=500)


def _grant_order_quota(order: dict[str, Any], user_row: dict[str, Any], confirmed_by: str) -> int | None:
    """Satu-satunya jalur aktivasi: tandai paid (transisi kondisional) + tambah kuota.

    Transisi pending->paid dilakukan DULUAN via set_order_status_paid; kuota
    HANYA ditambah oleh jalur yang berhasil menang transisi (mencegah double
    grant saat callback gateway dan admin confirm balapan). Return max_prompts
    baru, atau None bila transisi tidak terjadi (order sudah diproses jalur lain).
    """
    prompts = int(order.get("prompts") or 0)
    current_max = int(user_row.get("max_prompts", 0) or 0)
    # 0 = unlimited: jangan tambah, cukup tandai paid
    new_max = current_max if current_max == 0 else current_max + prompts
    transitioned = DatabaseService.set_order_status_paid(str(order["id"]), confirmed_by=confirmed_by)
    if not transitioned:
        return None
    if current_max != 0:
        DatabaseService.update_user(str(user_row["id"]), {"max_prompts": new_max})
    return new_max


@router.get("/pricing")
def public_pricing():
    return _public_pricing()


@router.post("/user/orders")
def user_create_order(payload: OrderCreate, request: Request, user: dict = Depends(get_current_user)):
    ip = get_client_ip(request)
    enforce_rate_limit(f"order:{user.get('id')}:{ip}", 10, 60)

    plan = DatabaseService.find_plan(payload.plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    try:
        prompts = int(plan.get("prompts") or 0)
        amount = int(plan.get("amount") or 0)
    except Exception:
        raise HTTPException(status_code=400, detail="Paket tidak valid")
    if prompts <= 0 or amount < 0:
        raise HTTPException(status_code=400, detail="Paket tidak valid")

    # Order lama yang belum dikonfirmasi diganti order baru - tak menumpuk, tak macet409.
    for o in DatabaseService.list_orders(str(user["id"]), limit=50):
        if str(o.get("status")) == "pending":
            DatabaseService.set_order_status(str(o.get("id")), "cancelled")

    order = DatabaseService.create_order(str(user["id"]), plan, note=(payload.note or "").strip())

    # Invoice gateway: paymentUrl untuk user bayar. Callback-nya (bukan klik
    # user) yang mengaktifkan kuota. Gagal bikin invoice bukan batal order —
    # fallback QRIS manual + konfirmasi admin tetap jalan.
    payment_url = None
    if duitku.configured():
        user_row = DatabaseService.get_user_by_id(str(user["id"])) or {}
        try:
            invoice = duitku.create_invoice(
                merchant_order_id=str(order["id"]),
                amount=int(order.get("amount") or 0),
                product_details=f"{order.get('plan_label')} - {order.get('prompts')} prompt ITZ AI",
                email=str(user_row.get("email") or ""),
                customer_name=str(user_row.get("display_name") or user_row.get("username") or "Customer"),
                phone_number=str(user_row.get("phone") or ""),
            )
            payment_url = invoice["payment_url"]
            DatabaseService.update_order(str(order["id"]), {"proof": f"duitku:{invoice['reference']}"})
            order = DatabaseService.get_order(str(order["id"])) or order
            audit_log(
                str(user.get("username") or user.get("id")),
                "order_invoice_created",
                detail=f"order={order['id']} reference={invoice['reference']}",
                ip=ip,
            )
        except duitku.DuitkuError as exc:
            audit_log(
                str(user.get("username") or user.get("id")),
                "order_invoice_failed",
                detail=f"order={order['id']} err={exc}",
                ip=ip,
            )

    return {"status": "success", "order": order, "payment_url": payment_url}


@router.get("/user/orders")
def user_list_orders(user: dict = Depends(get_current_user)):
    rows = DatabaseService.list_orders(str(user["id"]), limit=50)
    return {
        "items": [
            {
                "id": o.get("id"),
                "plan_id": o.get("plan_id"),
                "plan_label": o.get("plan_label"),
                "prompts": o.get("prompts"),
                "amount": o.get("amount"),
                "status": o.get("status"),
                "note": o.get("note"),
                "created_at": o.get("created_at"),
                "paid_at": o.get("paid_at"),
                **_order_expiry_fields(o),
            }
            for o in rows
        ]
    }


# ── callback gateway: satu-satunya jalur aktivasi otomatis ──


def _parse_form(raw: bytes) -> dict[str, str]:
    """Parse body x-www-form-urlencoded tanpa dependensi python-multipart."""
    from urllib.parse import parse_qs

    parsed = parse_qs(raw.decode("utf-8", errors="replace"), keep_blank_values=True)
    return {k: (v[0] if v else "") for k, v in parsed.items()}


@payment_router.post("/duitku/callback")
async def duitku_payment_callback(request: Request):
    """Notifikasi Duitku: dana masuk -> order paid + kuota aktif otomatis.

    User tidak acc apa pun di sini; admin konfirmasi tetap tersedia untuk
    kasus gangguan (endpoint /api/admin/orders/{id}/confirm).
    """
    form = _parse_form(await request.body())
    ip = get_client_ip(request)

    if not duitku.configured():
        raise HTTPException(status_code=400, detail="Gateway pembayaran belum dikonfigurasi")

    merchant_code = form.get("merchantCode", "")
    amount = form.get("amount", "")
    order_id = form.get("merchantOrderId", "")
    signature = form.get("signature", "")
    if not (merchant_code and amount and order_id and signature):
        audit_log("gateway", "callback_bad_parameter", detail=f"order={order_id or '?'} ip={ip}", ip=ip)
        raise HTTPException(status_code=400, detail="Parameter callback tidak lengkap")
    if not duitku.verify_callback_signature(merchant_code, amount, order_id, signature):
        audit_log("gateway", "callback_bad_signature", detail=f"order={order_id} ip={ip}", ip=ip)
        raise HTTPException(status_code=403, detail="Signature tidak valid")

    order = DatabaseService.get_order(order_id)
    if order is None:
        audit_log("gateway", "callback_unknown_order", detail=f"order={order_id} ip={ip}", ip=ip)
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")

    # Nominal wajib persis: tolak notifikasi salah tagih / salah order.
    if int(amount or 0) != int(order.get("amount") or 0):
        audit_log(
            "gateway",
            "callback_amount_mismatch",
            detail=f"order={order_id} callback={amount} order_amount={order.get('amount')}",
            ip=ip,
        )
        raise HTTPException(status_code=403, detail="Nominal tidak sesuai order")

    if str(form.get("resultCode") or "") != "00":
        # Pembayaran gagal / dibatalkan di kanal bayar: order tetap pending.
        return {"status": "ignored"}

    status = str(order.get("status") or "")
    if status == "paid":
        return {"status": "success", "idempotent": True}
    if status == "cancelled":
        # Order diganti user saat menunggu, tapi dana tetap masuk. Jangan
        # aktifkan sendiri — lempar ke admin (jaga-jaga), kuota tidak hilang.
        audit_log(
            "gateway",
            "callback_paid_after_cancel",
            detail=f"order={order_id} user={order.get('user_id')} amount={amount}",
            ip=ip,
        )
        return {"status": "needs_admin"}

    user_row = DatabaseService.get_user_by_id(str(order.get("user_id")))
    if user_row is None:
        audit_log("gateway", "callback_user_missing", detail=f"order={order_id} ip={ip}", ip=ip)
        raise HTTPException(status_code=404, detail="User pemilik order tidak ditemukan")

    transitioned = _grant_order_quota(order, user_row, confirmed_by="duitku")
    if transitioned is None:
        # Order bukan pending lagi saat update (jalur lain sudah menang):
        # dana masuk dua kali dianggap idempotent, tanpa grant ganda.
        return {"status": "success", "idempotent": True}
    new_max = transitioned
    audit_log(
        "gateway",
        "order_paid_auto",
        detail=f"order={order_id} user={user_row.get('username')} prompts={order.get('prompts')} max_prompts={new_max}",
        ip=ip,
    )
    return {"status": "success", "max_prompts": new_max}


# ── admin endpoints ──


class PricingUpdate(BaseModel):
    plans: list[dict[str, Any]] | None = Field(default=None, max_length=MAX_PLANS)
    # QRIS disimpan sebagai URL gambar / data URL base64. Gambar QR kecil (~100 KB)
    # jadi base64 bisa ratusan ribu karakter - batas 20k lama membuat simpan selalu gagal.
    payment_qris: str | None = Field(default=None, max_length=MAX_QRIS_CHARS)
    payment_instructions: str | None = Field(default=None, max_length=4000)
    contact: str | None = Field(default=None, max_length=200)
    order_note: str | None = Field(default=None, max_length=500)


def _clean_plans(plans: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen = set()
    for p in plans:
        if not isinstance(p, dict):
            continue
        pid = str(p.get("id") or "").strip()
        label = str(p.get("label") or "").strip()
        try:
            prompts = int(p.get("prompts") or 0)
            amount = int(p.get("amount") or 0)
        except Exception:
            raise HTTPException(status_code=400, detail="prompts dan amount harus angka")
        if not pid or len(pid) > 64 or not pid.replace("-", "").replace("_", "").isalnum():
            raise HTTPException(status_code=400, detail=f"id paket tidak valid: {pid}")
        if pid in seen:
            raise HTTPException(status_code=400, detail=f"id paket duplikat: {pid}")
        if not label or len(label) > 80:
            raise HTTPException(status_code=400, detail=f"label paket tidak valid: {pid}")
        if prompts <= 0 or prompts > 10_000_000:
            raise HTTPException(status_code=400, detail=f"jumlah prompt tidak valid: {pid}")
        if amount < 0 or amount > MAX_AMOUNT:
            raise HTTPException(status_code=400, detail=f"harga tidak valid: {pid}")
        # Harga coret (diskon): opsional, harus angka dan di atas harga akhir.
        raw_original = p.get("original_amount")
        original: int | None = None
        if raw_original not in (None, "", 0, "0"):
            try:
                original = int(raw_original)
            except Exception:
                raise HTTPException(status_code=400, detail=f"harga coret harus angka: {pid}")
            if original <= amount:
                raise HTTPException(
                    status_code=400, detail=f"harga coret harus lebih besar dari harga akhir ({amount}): {pid}"
                )
            if original > MAX_AMOUNT:
                raise HTTPException(status_code=400, detail=f"harga coret terlalu besar: {pid}")
        # Masa aktif (hari): opsional. 0/kosong = tanpa batas waktu (order lama
        # tetap kompatibel). Hanya boleh bilangan bulat 0..3650.
        raw_days = p.get("days")
        days = 0
        if raw_days not in (None, "", 0, "0"):
            try:
                days = int(raw_days)
            except Exception:
                raise HTTPException(status_code=400, detail=f"masa aktif harus angka hari: {pid}")
            if days < 0 or days > MAX_PLAN_DAYS:
                raise HTTPException(status_code=400, detail=f"masa aktif 0-{MAX_PLAN_DAYS} hari: {pid}")
        seen.add(pid)
        out.append(
            {
                "id": pid,
                "label": label,
                "prompts": prompts,
                "days": days,
                "amount": amount,
                "popular": bool(p.get("popular")),
                "original_amount": original,
            }
        )
    return out


@admin_router.get("/pricing")
def admin_get_pricing(admin: str = Depends(get_current_admin)):
    return {"pricing": _public_pricing()}


@admin_router.put("/pricing")
def admin_update_pricing(payload: PricingUpdate, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    enforce_rate_limit(f"admin:pricing:{ip}", 20, 60)

    patch: dict[str, Any] = {}
    if payload.plans is not None:
        patch["plans"] = _clean_plans(payload.plans)
    if payload.payment_qris is not None:
        patch["payment_qris"] = payload.payment_qris.strip()
    if payload.payment_instructions is not None:
        patch["payment_instructions"] = payload.payment_instructions.strip()
    if payload.contact is not None:
        patch["contact"] = payload.contact.strip()
    if payload.order_note is not None:
        patch["order_note"] = payload.order_note.strip()

    DatabaseService.update_pricing(patch)
    audit_log(admin, "pricing_update", detail=f"plans={len(patch.get('plans') or [])}", ip=ip)
    return {"status": "success", "pricing": _public_pricing()}


@admin_router.get("/orders")
def admin_list_orders(status: str | None = None, admin: str = Depends(get_current_admin)):
    rows = DatabaseService.list_orders(None, limit=200)
    if status in ("pending", "paid", "cancelled"):
        rows = [o for o in rows if str(o.get("status")) == status]
    users = {str(u.get("id")): u for u in DatabaseService.list_users()}
    items = []
    for o in rows:
        u = users.get(str(o.get("user_id"))) or {}
        items.append(
            {
                **{
                    k: o.get(k)
                    for k in (
                        "id",
                        "plan_id",
                        "plan_label",
                        "prompts",
                        "amount",
                        "status",
                        "note",
                        "created_at",
                        "paid_at",
                        "confirmed_by",
                    )
                },
                **_order_expiry_fields(o),
                "username": u.get("username"),
                "display_name": u.get("display_name"),
            }
        )
    return {"items": items, "counts": DatabaseService.count_orders_by_status()}


@admin_router.post("/orders/{order_id}/confirm")
def admin_confirm_order(order_id: str, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    order = DatabaseService.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    if str(order.get("status")) == "paid":
        raise HTTPException(status_code=409, detail="Order ini sudah dikonfirmasi sebelumnya")

    user = DatabaseService.get_user_by_id(str(order.get("user_id")))
    if user is None:
        raise HTTPException(status_code=404, detail="User pemilik order tidak ditemukan")

    prompts = int(order.get("prompts") or 0)
    new_max = _grant_order_quota(order, user, confirmed_by=admin)
    if new_max is None:
        # Race dengan callback/instance lain: order sudah bukan pending.
        raise HTTPException(status_code=409, detail="Order ini sudah dikonfirmasi sebelumnya")
    audit_log(admin, "order_confirm", detail=f"order={order_id} user={user.get('username')} prompts={prompts}", ip=ip)
    return {"status": "success", "order": DatabaseService.get_order(order_id), "max_prompts": new_max}


@admin_router.post("/orders/{order_id}/cancel")
def admin_cancel_order(order_id: str, request: Request, admin: str = Depends(get_current_admin)):
    order = DatabaseService.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    if str(order.get("status")) == "paid":
        raise HTTPException(status_code=409, detail="Order yang sudah dibayar tidak bisa dibatalkan")
    updated = DatabaseService.set_order_status(order_id, "cancelled", confirmed_by=admin)
    audit_log(admin, "order_cancel", detail=f"order={order_id}", ip=get_client_ip(request))
    return {"status": "success", "order": updated}
