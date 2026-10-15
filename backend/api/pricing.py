"""
Pricing & orders: paket prompt, pembayaran (QRIS/instruksi), aktivasi manual admin.

Alur: user pilih paket -> buat order (pending) -> bayar -> admin konfirmasi (paid) ->
kuota user ditambah (max_prompts += prompts). Tanpa payment gateway otomatis.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

try:
    from backend.database.db import DatabaseService
    from backend.security.rate_limiter import get_client_ip, check_rate_limit
    from backend.security.audit import log_action as audit_log
    from backend.api.users import get_current_user
    from backend.api.admin import get_current_admin
except ImportError:
    from database.db import DatabaseService  # type: ignore
    from security.rate_limiter import get_client_ip, check_rate_limit  # type: ignore
    from security.audit import log_action as audit_log  # type: ignore
    from api.users import get_current_user  # type: ignore
    from api.admin import get_current_admin  # type: ignore

router = APIRouter(prefix="/api", tags=["Pricing"])
admin_router = APIRouter(prefix="/api/admin", tags=["Admin Pricing"])

MAX_AMOUNT = 100_000_000
MAX_PLANS = 12
# Batas karakter QRIS: data URL base64 gambar (~400 KB) masih muat.
# Harus < MAX_BODY_BYTES (1 MB) di middleware agar body tidak ditolak 413.
MAX_QRIS_CHARS = 600_000


def _public_pricing() -> Dict[str, Any]:
    cfg = DatabaseService.get_pricing()
    plans = []
    for p in (cfg.get("plans") or []):
        if not isinstance(p, dict):
            continue
        try:
            prompts = int(p.get("prompts") or 0)
            amount = int(p.get("amount") or 0)
        except Exception:
            continue
        if prompts <= 0 or not str(p.get("id") or "").strip():
            continue
        plans.append({
            "id": str(p.get("id")),
            "label": str(p.get("label") or f"Paket {prompts} Prompt"),
            "prompts": prompts,
            "amount": amount,
            "popular": bool(p.get("popular")),
        })
    return {
        "plans": plans,
        "payment_qris": str(cfg.get("payment_qris") or ""),
        "payment_instructions": str(cfg.get("payment_instructions") or ""),
        "contact": str(cfg.get("contact") or ""),
        "order_note": str(cfg.get("order_note") or ""),
    }


# ── user endpoints ──

class OrderCreate(BaseModel):
    plan_id: str = Field(min_length=1, max_length=64)
    note: Optional[str] = Field(default=None, max_length=500)


@router.get("/pricing")
def public_pricing():
    return _public_pricing()


@router.post("/user/orders")
def user_create_order(payload: OrderCreate, request: Request, user: dict = Depends(get_current_user)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"order:{user.get('id')}:{ip}", 10, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})

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

    # Tolak order pending ganda untuk paket yang sama
    for o in DatabaseService.list_orders(str(user["id"]), limit=50):
        if str(o.get("status")) == "pending" and str(o.get("plan_id")) == str(payload.plan_id):
            raise HTTPException(status_code=409, detail="Sudah ada order paket ini yang menunggu konfirmasi admin.")

    order = DatabaseService.create_order(str(user["id"]), plan, note=(payload.note or "").strip())
    return {"status": "success", "order": order}


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
            }
            for o in rows
        ]
    }


# ── admin endpoints ──

class PricingUpdate(BaseModel):
    plans: Optional[List[Dict[str, Any]]] = Field(default=None, max_length=MAX_PLANS)
    # QRIS disimpan sebagai URL gambar / data URL base64. Gambar QR kecil (~100 KB)
    # jadi base64 bisa ratusan ribu karakter - batas 20k lama membuat simpan selalu gagal.
    payment_qris: Optional[str] = Field(default=None, max_length=MAX_QRIS_CHARS)
    payment_instructions: Optional[str] = Field(default=None, max_length=4000)
    contact: Optional[str] = Field(default=None, max_length=200)
    order_note: Optional[str] = Field(default=None, max_length=500)


def _clean_plans(plans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
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
        seen.add(pid)
        out.append({"id": pid, "label": label, "prompts": prompts, "amount": amount, "popular": bool(p.get("popular"))})
    return out


@admin_router.get("/pricing")
def admin_get_pricing(admin: str = Depends(get_current_admin)):
    return {"pricing": _public_pricing()}


@admin_router.put("/pricing")
def admin_update_pricing(payload: PricingUpdate, request: Request, admin: str = Depends(get_current_admin)):
    ip = get_client_ip(request)
    allowed, retry = check_rate_limit(f"admin:pricing:{ip}", 20, 60)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Retry after {retry}s", headers={"Retry-After": str(retry)})

    patch: Dict[str, Any] = {}
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
def admin_list_orders(status: Optional[str] = None, admin: str = Depends(get_current_admin)):
    rows = DatabaseService.list_orders(None, limit=200)
    if status in ("pending", "paid", "cancelled"):
        rows = [o for o in rows if str(o.get("status")) == status]
    users = {str(u.get("id")): u for u in DatabaseService.list_users()}
    items = []
    for o in rows:
        u = users.get(str(o.get("user_id"))) or {}
        items.append({
            **{k: o.get(k) for k in ("id", "plan_id", "plan_label", "prompts", "amount", "status", "note", "created_at", "paid_at", "confirmed_by")},
            "username": u.get("username"),
            "display_name": u.get("display_name"),
        })
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
    current_max = int(user.get("max_prompts", 0) or 0)
    # 0 = unlimited: jangan tambah, cukup tandai paid
    new_max = current_max if current_max == 0 else current_max + prompts
    if current_max != 0:
        DatabaseService.update_user(str(user["id"]), {"max_prompts": new_max})

    updated = DatabaseService.set_order_status(order_id, "paid", confirmed_by=admin)
    audit_log(admin, "order_confirm", detail=f"order={order_id} user={user.get('username')} prompts={prompts}", ip=ip)
    return {"status": "success", "order": updated, "max_prompts": new_max}


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